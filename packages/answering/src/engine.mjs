import { makeTraceId } from '../../contracts/src/index.mjs';
import { hybridRetrieve } from '../../retrieval/src/hybrid.mjs';
import { assembleEvidence } from '../../evidence/src/assemble.mjs';
import { validateClaims } from '../../citations/src/validate.mjs';
import { classifyQuestion } from './policy.mjs';
import { ExtractiveProvider } from './extractive-provider.mjs';

function policyAnswer(state) {
  if (state === 'account_specific') return 'The approved documentation cannot determine private account, deployment, billing, or log state. Use the relevant telemetry or support channel.';
  if (state === 'out_of_scope') return 'The approved documentation cannot provide that guarantee or judgment.';
  if (state === 'unsafe_or_untrusted') return 'I cannot follow instructions that cross source, system, network, credential, or tenant boundaries.';
  return '';
}

function stateFromSufficiency(value) {
  return ({ sufficient: 'supported', partial: 'partially_supported', conflicting: 'conflicting_sources', version_ambiguous: 'version_ambiguous', runtime_ambiguous: 'runtime_ambiguous', insufficient: 'not_found' })[value] ?? 'not_found';
}

export async function answerQuestion(input) {
  const startedAt = performance.now();
  const {
    question, projectId, chunks, version = 'current', runtime = 'all',
    provider = new ExtractiveProvider(), retrievalLimit = 8
  } = input;
  const traceId = makeTraceId();
  const classification = classifyQuestion(question);
  if (classification.state) {
    return {
      traceId, state: classification.state, answer: policyAnswer(classification.state), assumptions: { version, runtime },
      retrieval: [], evidence: [], claims: [], citations: [], validation: { valid: true, supportRate: 1, results: [] },
      failures: [], provider: 'policy', latencyMs: performance.now() - startedAt
    };
  }

  const selectedVersion = classification.version ? `v${classification.version}` : version;
  const selectedRuntime = classification.runtime ?? runtime;
  const retrieval = hybridRetrieve({ query: question, chunks, projectId, version: selectedVersion, runtime: selectedRuntime, limit: retrievalLimit });
  const packet = assembleEvidence(retrieval);
  const state = stateFromSufficiency(packet.sufficiency);
  if (state === 'not_found') {
    return {
      traceId, state, answer: 'I could not find sufficient support in the approved active sources.', assumptions: { version: selectedVersion, runtime: selectedRuntime },
      retrieval, evidence: [], claims: [], citations: [], validation: { valid: true, supportRate: 1, results: [] },
      failures: ['RETRIEVE_MISS'], provider: 'policy', latencyMs: performance.now() - startedAt
    };
  }
  if (state === 'conflicting_sources') {
    return {
      traceId, state, answer: `The approved evidence contains potentially conflicting values: ${packet.conflicts.map((item) => `${item.topic}: ${item.values.join(', ')}`).join('; ')}`, assumptions: { version: selectedVersion, runtime: selectedRuntime },
      retrieval, evidence: packet.evidence, claims: [], citations: packet.evidence.map((item) => ({ evidenceId: item.id, url: item.canonicalUrl, anchor: item.citationAnchor })), validation: { valid: true, supportRate: 1, results: [] },
      failures: [], provider: 'policy', latencyMs: performance.now() - startedAt
    };
  }

  const generated = await provider.generate({ question, evidence: packet.evidence, state, assumptions: { version: selectedVersion, runtime: selectedRuntime } });
  const validation = validateClaims({ claims: generated.claims ?? [], evidence: packet.evidence, projectId });
  const finalState = validation.valid ? state : 'partially_supported';
  const validClaims = (generated.claims ?? []).filter((_, index) => validation.results[index]?.supported);
  const answer = validation.valid ? generated.answer : validClaims.map((claim) => claim.text).join(' ') || 'The retrieved evidence was insufficient to support a reliable answer.';
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
    latencyMs: performance.now() - startedAt
  };
}
