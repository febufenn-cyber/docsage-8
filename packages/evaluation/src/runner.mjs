import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { answerQuestion } from '../../answering/src/engine.mjs';
import { stableJson, sha256 } from '../../core/src/hash.mjs';

export async function readJsonl(filePath) {
  const text = await readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch (error) { throw new Error(`${filePath}:${index + 1}: ${error.message}`); }
  });
}

function includesConcept(answer, concept) {
  return answer.toLowerCase().includes(String(concept).toLowerCase());
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values, value) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

export async function runEvaluation(options) {
  const {
    cases,
    chunks,
    projectId,
    provider,
    version = 'current',
    runtime = 'all',
    allowCandidate = false,
    outputDirectory = null,
    configuration = {}
  } = options;
  const selectedCases = cases.filter((item) => item.annotation_status === 'verified' || allowCandidate);
  if (!selectedCases.length) throw new Error('No verified cases. Pass allowCandidate only for non-gating smoke runs.');

  const results = [];
  for (const item of selectedCases) {
    const response = await answerQuestion({ question: item.question, projectId, chunks, provider, version, runtime });
    const sourceRecall = item.expected_sources.length === 0
      ? null
      : item.expected_sources.some((source) => response.retrieval.slice(0, 8).some((chunk) => chunk.canonicalUrl === source));
    const included = item.must_include.map((concept) => ({ concept, found: includesConcept(response.answer, concept) }));
    const forbidden = item.must_not_claim.map((concept) => ({ concept, found: includesConcept(response.answer, concept) }));
    results.push({
      caseId: item.id,
      expectedState: item.expected_state,
      actualState: response.state,
      stateCorrect: item.expected_state === response.state || (item.expected_state === 'supported' && response.state === 'partially_supported'),
      sourceRecall,
      conceptCoverage: included.length ? included.filter((entry) => entry.found).length / included.length : 1,
      forbiddenClaimFree: forbidden.every((entry) => !entry.found),
      citationValid: response.validation.valid,
      latencyMs: response.latencyMs,
      traceId: response.traceId,
      answer: response.answer,
      failures: response.failures,
      retrieval: response.retrieval.map((chunk) => ({ id: chunk.id, url: chunk.canonicalUrl, score: chunk.score, headingPath: chunk.headingPath })),
      included,
      forbidden
    });
  }

  const answerable = results.filter((_, index) => selectedCases[index].answerable);
  const unanswerable = results.filter((_, index) => !selectedCases[index].answerable);
  const highRisk = results.filter((_, index) => selectedCases[index].risk === 'high' && selectedCases[index].answerable);
  const recallValues = answerable.filter((item) => item.sourceRecall !== null);
  const metrics = {
    caseCount: results.length,
    stateAccuracy: mean(results.map((item) => Number(item.stateCorrect))),
    retrievalRecallAt8: mean(recallValues.map((item) => Number(item.sourceRecall))),
    highRiskRecallAt8: mean(highRisk.filter((item) => item.sourceRecall !== null).map((item) => Number(item.sourceRecall))),
    conceptCoverage: mean(answerable.map((item) => item.conceptCoverage)),
    forbiddenClaimSafety: mean(results.map((item) => Number(item.forbiddenClaimFree))),
    citationValidationRate: mean(answerable.map((item) => Number(item.citationValid))),
    abstentionAccuracy: mean(unanswerable.map((item) => Number(['not_found','account_specific','out_of_scope','unsafe_or_untrusted','version_ambiguous','runtime_ambiguous'].includes(item.actualState)))),
    medianLatencyMs: percentile(results.map((item) => item.latencyMs), 0.5),
    p95LatencyMs: percentile(results.map((item) => item.latencyMs), 0.95)
  };
  const manifest = {
    runId: `eval_${Date.now()}`,
    createdAt: new Date().toISOString(),
    projectId,
    candidateMode: allowCandidate,
    casesHash: sha256(stableJson(selectedCases)),
    chunksHash: sha256(stableJson(chunks.map(({ id, contentHash, sourceRevisionId }) => ({ id, contentHash, sourceRevisionId })))),
    configuration,
    metrics
  };

  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(outputDirectory, 'results.jsonl'), `${results.map((item) => JSON.stringify(item)).join('\n')}\n`);
    await writeFile(path.join(outputDirectory, 'metrics.json'), JSON.stringify(metrics, null, 2));
    await writeFile(path.join(outputDirectory, 'report.md'), renderReport(manifest, metrics));
  }
  return { manifest, metrics, results };
}

export function renderReport(manifest, metrics) {
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  return `# DocSage evaluation run\n\n- Run: \`${manifest.runId}\`\n- Candidate mode: **${manifest.candidateMode}**\n- Cases: **${metrics.caseCount}**\n\n| Metric | Result |\n|---|---:|\n| State accuracy | ${percent(metrics.stateAccuracy)} |\n| Retrieval recall@8 | ${percent(metrics.retrievalRecallAt8)} |\n| High-risk recall@8 | ${percent(metrics.highRiskRecallAt8)} |\n| Concept coverage | ${percent(metrics.conceptCoverage)} |\n| Forbidden-claim safety | ${percent(metrics.forbiddenClaimSafety)} |\n| Citation validation | ${percent(metrics.citationValidationRate)} |\n| Abstention accuracy | ${percent(metrics.abstentionAccuracy)} |\n| Median latency | ${metrics.medianLatencyMs.toFixed(1)} ms |\n| p95 latency | ${metrics.p95LatencyMs.toFixed(1)} ms |\n`;
}
