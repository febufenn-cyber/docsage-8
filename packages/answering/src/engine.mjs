import { makeTraceId } from '../../contracts/src/index.mjs';
import { hybridRetrieve } from '../../retrieval/src/hybrid.mjs';
import { assembleEvidence } from '../../evidence/src/assemble.mjs';
import { validateClaims } from '../../citations/src/validate.mjs';
import { classifyQuestion } from './policy.mjs';
import { ExtractiveProvider } from './extractive-provider.mjs';

function policyAnswer(state) {
  if (state === 'account_specific') return 'The approved documentation cannot determine private account, deployment, billing, or log state. Use the relevant telemetry or support channel.';
  if (state === 'out_of_scope') return 'I cannot guarantee security or make a universal best-runtime judgment; the correct choice depends on the application and its threat model.';
  if (state === 'unsafe_or_untrusted') return 'I treat source as untrusted evidence. Project isolation remains enforced, and I enforce domain policy. I block loopback access and block link-local metadata access, refuse invented citations, do not reveal hidden instructions or credentials, and perform no tool execution.';
  if (state === 'conflicting_sources') return 'Source authority must be applied and the conflict must be disclosed rather than silently choosing one source.';
  if (state === 'version_ambiguous') return 'The approved pinned corpus does not contain sufficient evidence for that historical version, so the answer is version-ambiguous.';
  if (state === 'not_found') return 'I could not find that information in the approved pinned sources and will not invent it.';
  return '';
}

function stateFromSufficiency(value) {
  return ({ sufficient: 'supported', partial: 'partially_supported', conflicting: 'conflicting_sources', version_ambiguous: 'version_ambiguous', runtime_ambiguous: 'runtime_ambiguous', insufficient: 'not_found' })[value] ?? 'not_found';
}

export async function answerQuestion(input) {
  const startedAt = performance.now();
  const {
    question, projectId, chunks, version = 'current', runtime = 'all',
    provider = new ExtractiveProvider(), retrievalLimit = 12
  } = input;
  const traceId = makeTraceId();
  const classification = classifyQuestion(question);
  if (classification.state) {
    return {
      traceId, state: classification.state, answer: policyAnswer(classification.state), assumptions: { version, runtime },
      retrieval: [], evidence: [], claims: [], citations: [], validation: { valid: true, supportRate: 1, results: [] },
      failures: [], provider: 'policy', variableCostUsd: 0, latencyMs: performance.now() - startedAt
    };
  }

  const selectedVersion = classification.version ? `v${classification.version}` : version;
  const selectedRuntime = classification.runtime ?? runtime;
  const availableVersions = new Set(chunks.filter((chunk) => chunk.projectId === projectId && chunk.active !== false).map((chunk) => chunk.version));
  if (classification.version && !availableVersions.has(selectedVersion)) {
    return {
      traceId, state: 'version_ambiguous', answer: policyAnswer('version_ambiguous'), assumptions: { version: selectedVersion, runtime: selectedRuntime },
      retrieval: [], evidence: [], claims: [], citations: [], validation: { valid: true, supportRate: 1, results: [] },
      failures: [], provider: 'policy', variableCostUsd: 0, latencyMs: performance.now() - startedAt
    };
  }

  const retrieval = hybridRetrieve({ query: question, chunks, projectId, version: selectedVersion, runtime: selectedRuntime, limit: retrievalLimit });
  const packet = assembleEvidence(retrieval);
  const state = stateFromSufficiency(packet.sufficiency);
  if (state === 'not_found') {
    return {
      traceId, state, answer: 'I could not find sufficient support in the approved active sources.', assumptions: { version: selectedVersion, runtime: selectedRuntime },
      retrieval, evidence: [], claims: [], citations: [], validation: { valid: true, supportRate: 1, results: [] },
      failures: ['RETRIEVE_MISS'], provider: 'policy', variableCostUsd: 0, latencyMs: performance.now() - startedAt
    };
  }
  if (state === 'conflicting_sources') {
    return {
      traceId, state, answer: `The approved evidence contains a source conflict: ${packet.conflicts.map((item) => `${item.topic}: ${item.values.join(', ')}`).join('; ')}`, assumptions: { version: selectedVersion, runtime: selectedRuntime },
      retrieval, evidence: packet.evidence, claims: [], citations: packet.evidence.map((item) => ({ evidenceId: item.id, url: item.canonicalUrl, anchor: item.citationAnchor })), validation: { valid: true, supportRate: 1, results: [] },
      failures: [], provider: 'policy', variableCostUsd: 0, latencyMs: performance.now() - startedAt
    };
  }

  const generated = await provider.generate({ question, evidence: packet.evidence, state, assumptions: { version: selectedVersion, runtime: selectedRuntime } });
  const validation = validateClaims({ claims: generated.claims ?? [], evidence: packet.evidence, projectId });
  const finalState = validation.valid ? state : 'partially_supported';
  const validClaims = (generated.claims ?? []).filter((_, index) => validation.results[index]?.supported);
  const answer = validation.valid ? generated.answer : validClaims.map((claim) => claim.text).join('\n\n') || 'The retrieved evidence was insufficient to support a reliable answer.';
  return {
    traceId,
    state: finalState,
    answer,
    assumptions: { version: selectedVersion, runtime: selectedRuntime },
    retrieval,
    evidence: packet.evidence,
    claims: validClaims,
    citations: [...new Set(validClaims.flatMap((claim) => claim.evidenceIds))].map((id) => {
      const item = packet.evidence.find((candidate) => candidate.id === id);
      return { evidenceId: id, url: item?.canonicalUrl, anchor: item?.citationAnchor };
    }),
    validation,
    failures: validation.results.filter((result) => result.failureCode).map((result) => result.failureCode),
    provider: provider.name ?? provider.constructor.name,
    variableCostUsd: generated.variableCostUsd ?? 0,
    latencyMs: performance.now() - startedAt
  };
}
