#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  MemoryLearningEventStore,
  LearningEventConflictError,
  LearningProjectionStore,
  canonicalLearningSnapshot,
  createLearningConsoleApp
} from '../packages/learning/src/index.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, '.tmp', 'learning-gate');
const receivedAt = '2026-07-14T10:00:00.000Z';
const alpha = 'project_alpha';
const beta = 'project_beta';
const seededSecrets = [
  'owner@example.com',
  '10.1.2.3',
  'secret-value-12345678901234567890',
  'private-fragment'
];

function alphaEvent(index, overrides = {}) {
  return {
    eventId: `018f6b5c-7f11-7d10-9f24-${String(index).padStart(12, '0')}`,
    projectId: alpha,
    type: 'answer.completed',
    source: 'answer',
    occurredAt: `2026-07-${String(10 + Math.floor(index / 10)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
    traceId: `trace_${index}`,
    answerState: 'supported',
    citationCount: 2,
    latencyMs: 120 + index,
    question: 'How do I start?',
    metadata: {},
    ...overrides
  };
}

async function seed() {
  const store = new MemoryLearningEventStore();
  const inputs = [
    alphaEvent(1, {
      question: 'Email owner@example.com from 10.1.2.3 using api_key=secret-value-12345678901234567890 and https://docs.example.com/start?token=hidden#private-fragment'
    }),
    alphaEvent(2, {
      type: 'answer.refused',
      answerState: 'not_found',
      question: 'How do I configure undocumented mode?'
    }),
    alphaEvent(3, {
      type: 'feedback.recorded',
      source: 'feedback',
      answerState: 'not_found',
      feedbackRating: 'not_useful',
      feedbackReason: 'missing_detail',
      question: 'How do I configure undocumented mode?'
    }),
    alphaEvent(4, {
      answerState: 'partially_supported',
      question: 'Does this work in every runtime?'
    }),
    alphaEvent(5, {
      type: 'source.health',
      source: 'ingestion',
      answerState: null,
      question: null,
      sourceStatus: 'degraded',
      failureCode: 'STALE_REVISION',
      metadata: { source_id: 'docs-primary' }
    }),
    alphaEvent(6, {
      type: 'source.health',
      source: 'ingestion',
      answerState: null,
      question: null,
      sourceStatus: 'healthy',
      metadata: { source_id: 'docs-primary' }
    }),
    alphaEvent(7, {
      type: 'evaluation.failed',
      source: 'evaluation',
      answerState: null,
      question: null,
      failureCode: 'CITATION_ENTAILMENT',
      metadata: { case_id: 'hono_case_7' }
    })
  ];

  const accepted = [];
  for (const input of inputs) {
    const result = await store.ingest(input, { projectSalt: 'alpha-private-project-salt', receivedAt });
    accepted.push(result.event);
  }

  const duplicate = await store.ingest(inputs[1], { projectSalt: 'alpha-private-project-salt', receivedAt });
  let conflictBlocked = false;
  try {
    await store.ingest({ ...inputs[1], citationCount: 99 }, { projectSalt: 'alpha-private-project-salt', receivedAt });
  } catch (error) {
    conflictBlocked = error instanceof LearningEventConflictError;
  }

  await store.ingest({
    ...alphaEvent(101),
    projectId: beta,
    traceId: 'trace_beta',
    question: 'Beta project private question'
  }, { projectSalt: 'beta-private-project-salt', receivedAt });

  return { store, inputs, accepted, duplicate, conflictBlocked };
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const seeded = await seed();
  const alphaEvents = seeded.store.list(alpha);
  const betaEvents = seeded.store.list(beta);
  const projectionStore = new LearningProjectionStore();
  const forward = projectionStore.rebuild(alphaEvents, alpha);
  const canonicalForward = forward.canonical;
  const reverse = projectionStore.rebuild([...alphaEvents].reverse(), alpha);
  projectionStore.rebuild(betaEvents, beta);

  const app = createLearningConsoleApp({
    eventStore: seeded.store,
    projectionStore,
    authorize: async ({ request, projectId }) => request.headers.get('x-operator') === `${projectId}:owner`
  });
  const summaryResponse = await app(new Request(`https://console.test/v1/learning/projects/${alpha}/summary`, {
    headers: { 'x-operator': `${alpha}:owner` }
  }));
  const summary = await summaryResponse.json();
  const deniedResponse = await app(new Request(`https://console.test/v1/learning/projects/${beta}/summary`, {
    headers: { 'x-operator': `${alpha}:owner` }
  }));
  const eventResponse = await app(new Request(`https://console.test/v1/learning/projects/${alpha}/events?limit=100`, {
    headers: { 'x-operator': `${alpha}:owner` }
  }));
  const publicEvents = await eventResponse.json();

  const persistedText = JSON.stringify(alphaEvents);
  const consoleSource = await readFile(path.join(root, 'apps/console/src/docsage-learning-console.mjs'), 'utf8');
  const forbiddenPatterns = [
    /\.innerHTML\s*=/,
    /\beval\s*\(/,
    /new\s+Function\b/,
    /on(?:click|load|error)\s*=/i
  ].filter((pattern) => pattern.test(consoleSource)).map(String);
  const consoleGzipBytes = gzipSync(consoleSource).byteLength;

  const checks = {
    acceptedEventCount: alphaEvents.length === 7,
    duplicateReplay: seeded.duplicate.duplicate === true && seeded.store.count(alpha) === 7,
    conflictingReplayBlocked: seeded.conflictBlocked,
    privacyRedaction: seededSecrets.every((secret) => !persistedText.includes(secret)),
    rawQuestionAbsent: alphaEvents.every((event) => !Object.hasOwn(event, 'question')),
    projectIsolation: seeded.store.count(beta) === 1 && deniedResponse.status === 403,
    exactReconciliation: forward.reconciliation.valid === true,
    deterministicRebuild: reverse.unchanged === true && reverse.canonical === canonicalForward,
    summaryMatchesEvents: summaryResponse.status === 200 && summary.eventCount === alphaEvents.length,
    publicResponseMinimized: publicEvents.items.every((event) => !('metadata' in event) && !('questionFingerprint' in event)),
    sourceHealthLatest: reverse.snapshot.sourceHealth.length === 1 && reverse.snapshot.sourceHealth[0].status === 'healthy',
    consoleSafeRendering: forbiddenPatterns.length === 0,
    consoleAccessibility: [/role: 'tablist'/, /role: 'tabpanel'/, /aria-live/, /attachShadow/].every((pattern) => pattern.test(consoleSource)),
    consoleSizeBudget: consoleGzipBytes <= 60 * 1024
  };
  const engineeringPassed = Object.values(checks).every(Boolean);
  const blockers = [
    'Independent human review: 0/15',
    'Credentialed Cloudflare embedding/reranking and Claude benchmark remains incomplete.',
    'No real public documentation-site pilot has produced learning events.'
  ];
  const gate = {
    createdAt: new Date().toISOString(),
    decision: engineeringPassed ? 'CONDITIONAL_GO' : 'REPEAT_PHASE_3',
    engineeringPassed,
    projectId: alpha,
    metrics: {
      acceptedEventCount: alphaEvents.length,
      betaEventCount: betaEvents.length,
      actionableCount: reverse.snapshot.actionableCount,
      clusterCount: reverse.snapshot.clusters.length,
      dailyMetricCount: reverse.snapshot.daily.length,
      sourceHealthCount: reverse.snapshot.sourceHealth.length,
      redactionCount: reverse.snapshot.redactionCount,
      consoleRawBytes: Buffer.byteLength(consoleSource),
      consoleGzipBytes,
      forbiddenPatternCount: forbiddenPatterns.length
    },
    checks,
    reconciliation: forward.reconciliation,
    canonicalSnapshotBytes: Buffer.byteLength(canonicalLearningSnapshot(reverse.snapshot)),
    blockers
  };

  const report = [
    '# Phase 3 Learning Gate',
    '',
    `Decision: **${gate.decision}**`,
    '',
    `Engineering passed: **${engineeringPassed}**`,
    '',
    `Accepted project events: ${gate.metrics.acceptedEventCount}`,
    `Actionable events: ${gate.metrics.actionableCount}`,
    `Clusters: ${gate.metrics.clusterCount}`,
    `Console gzip bytes: ${gate.metrics.consoleGzipBytes}`,
    `Forbidden source patterns: ${gate.metrics.forbiddenPatternCount}`,
    '',
    '## Checks',
    '',
    ...Object.entries(checks).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'} — ${name}`),
    '',
    '## External blockers',
    '',
    ...blockers.map((item) => `- ${item}`),
    ''
  ].join('\n');

  await Promise.all([
    writeFile(path.join(outDir, 'gate.json'), `${JSON.stringify(gate, null, 2)}\n`),
    writeFile(path.join(outDir, 'report.md'), report)
  ]);
  console.log(JSON.stringify(gate, null, 2));
  if (!engineeringPassed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
