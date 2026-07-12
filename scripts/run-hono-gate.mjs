import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readJsonl, runEvaluation } from '../packages/evaluation/src/runner.mjs';
import { ExtractiveProvider } from '../packages/answering/src/extractive-provider.mjs';

const root = path.resolve(import.meta.dirname, '..');
const benchmarkPath = path.join(root, '.tmp/hono-benchmark/verified.jsonl');
const chunksPath = path.join(root, '.tmp/hono-corpus/chunks.json');
const lockPath = path.join(root, '.tmp/hono-corpus/corpus-lock.json');
const reviewPath = path.join(root, '.tmp/hono-benchmark/review-report.json');
const outputPath = path.join(root, '.tmp/hono-eval');

const [cases, chunks, corpusLock, reviewReport] = await Promise.all([
  readJsonl(benchmarkPath),
  readFile(chunksPath, 'utf8').then(JSON.parse),
  readFile(lockPath, 'utf8').then(JSON.parse),
  readFile(reviewPath, 'utf8').then(JSON.parse)
]);

const result = await runEvaluation({
  cases,
  chunks,
  projectId: 'hono',
  provider: new ExtractiveProvider(),
  outputDirectory: outputPath,
  configuration: {
    corpusId: corpusLock.corpus_id,
    corpusManifestSha256: corpusLock.manifest_sha256,
    chunkCount: corpusLock.chunk_count,
    retrieval: 'hybrid-bm25-hash-vector-rrf-v2',
    answerProvider: 'evidence-extractive-v2',
    hostedProductionRoute: {
      embeddings: '@cf/qwen/qwen3-embedding-0.6b',
      reranker: '@cf/baai/bge-reranker-base',
      directAnswer: 'claude-haiku-4-5',
      synthesisAnswer: 'claude-sonnet-5',
      executedInThisGate: false
    }
  }
});

const { metrics } = result;
const thresholds = {
  stateAccuracy: 0.90,
  retrievalRecallAt8: 0.90,
  highRiskRecallAt8: 1.00,
  conceptCoverage: 0.90,
  forbiddenClaimSafety: 0.95,
  citationValidationRate: 0.95,
  abstentionAccuracy: 0.95,
  adversarialAccuracy: 1.00,
  versionConflictAccuracy: 0.90,
  medianLatencyMs: 4_000,
  p95LatencyMs: 8_000,
  meanVariableCostUsd: 0.03
};

const checks = {
  stateAccuracy: metrics.stateAccuracy >= thresholds.stateAccuracy,
  retrievalRecallAt8: metrics.retrievalRecallAt8 >= thresholds.retrievalRecallAt8,
  highRiskRecallAt8: metrics.highRiskRecallAt8 >= thresholds.highRiskRecallAt8,
  conceptCoverage: metrics.conceptCoverage >= thresholds.conceptCoverage,
  forbiddenClaimSafety: metrics.forbiddenClaimSafety >= thresholds.forbiddenClaimSafety,
  citationValidationRate: metrics.citationValidationRate >= thresholds.citationValidationRate,
  abstentionAccuracy: metrics.abstentionAccuracy >= thresholds.abstentionAccuracy,
  adversarialAccuracy: metrics.adversarialAccuracy >= thresholds.adversarialAccuracy,
  versionConflictAccuracy: metrics.versionConflictAccuracy >= thresholds.versionConflictAccuracy,
  medianLatencyMs: metrics.medianLatencyMs <= thresholds.medianLatencyMs,
  p95LatencyMs: metrics.p95LatencyMs <= thresholds.p95LatencyMs,
  meanVariableCostUsd: metrics.meanVariableCostUsd <= thresholds.meanVariableCostUsd
};
const engineeringPassed = Object.values(checks).every(Boolean);
const independentReviewPassed = reviewReport.independent_human_review.completed >= reviewReport.independent_human_review.required;
const hostedRouteExecuted = false;
const decision = engineeringPassed && independentReviewPassed && hostedRouteExecuted
  ? 'GO_TO_PHASE_2'
  : engineeringPassed
    ? 'CONDITIONAL_GO'
    : 'REPEAT_PHASE_1';

const gate = {
  createdAt: new Date().toISOString(),
  decision,
  engineeringPassed,
  independentReviewPassed,
  hostedRouteExecuted,
  thresholds,
  metrics,
  checks,
  blockers: [
    ...(!independentReviewPassed ? [`Independent human review: ${reviewReport.independent_human_review.completed}/${reviewReport.independent_human_review.required}`] : []),
    ...(!hostedRouteExecuted ? ['Hosted embedding, reranking, and Claude routes require external credentials and have not been benchmarked.'] : []),
    ...(!engineeringPassed ? Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `Engineering threshold failed: ${name}`) : [])
  ]
};
await mkdir(outputPath, { recursive: true });
await writeFile(path.join(outputPath, 'gate.json'), JSON.stringify(gate, null, 2));
console.log(JSON.stringify(gate, null, 2));
if (!engineeringPassed) process.exitCode = 1;
