#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stableJson } from '../packages/core/src/hash.mjs';
import { MemoryIngestionJobStore, IngestionJobConflictError } from '../packages/ingestion/src/jobs.mjs';
import { buildSourceManifest, MemoryCorpusRevisionStore } from '../packages/ingestion/src/manifest.mjs';
import {
  MemoryIngestionScheduler,
  recoverExpiredIngestionJobs,
  makeSourceHealthLearningEvent
} from '../packages/ingestion/src/scheduler.mjs';
import { MemoryCorpusActivationStore } from '../packages/ingestion/src/activation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, '.tmp', 'ingestion-gate');
const projectId = 'project_alpha';
const sourceId = 'source_docs';
const version = 'v4';
const runtime = 'cloudflare';
const t0 = '2026-07-14T10:00:00.000Z';

function manifest(items, overrides = {}) {
  return buildSourceManifest({ projectId, sourceId, version, runtime, ...overrides, items });
}

function activeRevision(id, manifestValue) {
  return {
    id,
    projectId,
    sourceId,
    version: manifestValue.version,
    runtime: manifestValue.runtime,
    state: 'active',
    active: true,
    manifest: manifestValue,
    documents: manifestValue.items.map((item, index) => ({
      locator: item.locator,
      contentHash: item.contentHash,
      metadataHash: item.metadataHash,
      documentRevisionId: `${id}_doc_${index}`,
      chunkIds: item.quarantined ? [] : [`${id}_chunk_${index}`],
      reused: false
    })),
    tombstones: []
  };
}

const checks = {};
const metrics = {};
const failures = [];

function check(name, value, detail = null) {
  checks[name] = Boolean(value);
  if (!value) failures.push({ name, detail });
}

await mkdir(outDir, { recursive: true });

// Job replay and lease recovery.
const jobs = new MemoryIngestionJobStore();
const request = {
  projectId,
  sourceId,
  idempotencyKey: 'manual-refresh-001',
  requestedVersion: version,
  requestedRuntime: runtime,
  maxAttempts: 3,
  configuration: { include: ['docs/'] }
};
const firstJob = jobs.create(request, { now: () => t0 }).job;
const replay = jobs.create(request, { now: () => '2026-07-14T10:01:00.000Z' });
let conflictBlocked = false;
try {
  jobs.create({ ...request, requestedVersion: 'v5' });
} catch (error) {
  conflictBlocked = error instanceof IngestionJobConflictError;
}
check('idempotent_job_replay', replay.duplicate && jobs.list(projectId).length === 1);
check('conflicting_job_replay_blocked', conflictBlocked);

let running = jobs.claim(projectId, firstJob.id, { worker: 'worker-a', now: t0, leaseMs: 1_000 });
running = jobs.transition(projectId, firstJob.id, 'discovering', {
  worker: 'worker-a', expectedVersion: running.recordVersion, at: '2026-07-14T10:00:00.100Z'
});
const recovered = recoverExpiredIngestionJobs(jobs, projectId, {
  now: '2026-07-14T10:00:02.000Z', baseMs: 5_000, maxMs: 60_000, jitterRatio: 0.2, jitter: 0.5
});
check('expired_lease_recovered', recovered.length === 1 && recovered[0].job.state === 'retry_wait' && recovered[0].delayMs === 5_000);

const healthEvent = await makeSourceHealthLearningEvent(recovered[0].job, {
  eventId: '018f6b5c-7f11-7d10-9f24-000000000401',
  occurredAt: recovered[0].job.updatedAt,
  receivedAt: recovered[0].job.updatedAt
});
const healthJson = JSON.stringify(healthEvent);
check('source_health_privacy', healthEvent.type === 'source.health'
  && healthEvent.questionExcerpt === null
  && healthEvent.questionFingerprint === null
  && !healthJson.includes('https://')
  && !healthJson.toLowerCase().includes('authorization'));

// Schedule delivery converges.
const schedulerA = new MemoryIngestionScheduler();
const schedulerB = new MemoryIngestionScheduler();
const schedule = {
  id: 'schedule_docs', projectId, sourceId, name: 'Docs refresh', intervalMs: 60_000,
  nextRunAt: '2026-07-14T11:00:00.000Z', requestedVersion: version, requestedRuntime: runtime,
  configuration: { include: ['docs/'] }, maxAttempts: 3
};
schedulerA.add(schedule, { now: () => t0 });
schedulerB.add(schedule, { now: () => t0 });
const scheduleJobs = new MemoryIngestionJobStore();
const scheduledA = schedulerA.enqueueDue(projectId, scheduleJobs, { now: '2026-07-14T11:00:00.000Z' });
const scheduledB = schedulerB.enqueueDue(projectId, scheduleJobs, { now: '2026-07-14T11:00:00.000Z' });
check('concurrent_schedule_delivery_idempotent', scheduledA[0]?.duplicate === false && scheduledB[0]?.duplicate === true && scheduleJobs.list(projectId).length === 1);

// Initial active corpus and unchanged refresh.
const v1Manifest = manifest([
  { locator: 'docs/guide.md', text: '# Guide\nOld guide.' },
  { locator: 'docs/remove.md', text: '# Remove\nRetire me.' }
]);
const staging = new MemoryCorpusRevisionStore();
const v1 = staging.seedActive(activeRevision('corpus_v1', v1Manifest));
const unchanged = staging.stage({ projectId, sourceId, manifest: manifest([...v1Manifest.items].map((item) => ({
  locator: item.locator,
  title: item.title,
  contentHash: item.contentHash,
  metadata: {},
  byteLength: item.byteLength,
  quarantined: item.quarantined
}))) });
check('unchanged_refresh_no_duplicates', unchanged.duplicate && unchanged.revision.id === v1.id);

// Changed refresh with deletion and reuse.
const v2Manifest = manifest([
  { locator: 'docs/guide.md', text: '# Guide\nNew guide.' },
  { locator: 'docs/add.md', text: '# Add\nAdded page.' }
]);
const staged = staging.stage({ projectId, sourceId, id: 'corpus_v2', manifest: v2Manifest }, {
  now: () => '2026-07-14T11:10:00.000Z',
  materialize(item) {
    return { documentRevisionId: `v2_${item.contentHash.slice(0, 8)}`, chunkIds: [`v2_chunk_${item.contentHash.slice(0, 8)}`] };
  }
}).revision;
check('deletion_staged_not_active', staged.tombstones.some((item) => item.locator === 'docs/remove.md')
  && staging.activeRevisionId(projectId, sourceId, version, runtime) === v1.id);

// Atomic activation, simulated failure, success, and rollback.
const activation = new MemoryCorpusActivationStore();
activation.seedActive(v1, { actor: 'seed', at: t0 });
activation.register(staged);
const originalChunks = activation.activeChunkIds(projectId, sourceId, version, runtime);
let failedActivationBlocked = false;
try {
  activation.activate(projectId, staged.id, {
    actor: 'worker-a', expectedActiveRevisionId: v1.id,
    commitGuard() { throw new Error('simulated commit failure'); }
  });
} catch (error) {
  failedActivationBlocked = error.message === 'simulated commit failure';
}
check('failed_activation_preserves_active', failedActivationBlocked
  && activation.active(projectId, sourceId, version, runtime).id === v1.id
  && stableJson(activation.activeChunkIds(projectId, sourceId, version, runtime)) === stableJson(originalChunks));

const activated = activation.activate(projectId, staged.id, {
  actor: 'worker-a', expectedActiveRevisionId: v1.id,
  sourceId, version, runtime, at: '2026-07-14T11:11:00.000Z'
});
check('activation_switches_exact_scope', activated.active.id === staged.id
  && activation.activeDocuments(projectId, sourceId, version, runtime).every((document) => document.locator !== 'docs/remove.md'));

const rollback = activation.rollback(projectId, v1.id, {
  actor: 'operator', expectedActiveRevisionId: staged.id, at: '2026-07-14T11:12:00.000Z'
});
check('rollback_restores_prior_corpus', rollback.active.id === v1.id
  && stableJson(activation.activeChunkIds(projectId, sourceId, version, runtime)) === stableJson(originalChunks));

// Independent version/runtime scope.
const v5Manifest = manifest([{ locator: 'docs/v5.md', text: '# V5\nVersion five.' }], { version: 'v5', runtime: 'node' });
const v5 = { ...activeRevision('corpus_v5', v5Manifest), version: 'v5', runtime: 'node' };
activation.seedActive(v5, { actor: 'seed', at: t0 });
check('zero_mixed_version_contamination', activation.active(projectId, sourceId, version, runtime).id === v1.id
  && activation.active(projectId, sourceId, 'v5', 'node').id === v5.id
  && activation.activeChunkIds(projectId, sourceId, version, runtime).every((chunk) => chunk.startsWith('corpus_v1_'))
  && activation.activeChunkIds(projectId, sourceId, 'v5', 'node').every((chunk) => chunk.startsWith('corpus_v5_')));

metrics.jobCount = jobs.list(projectId).length;
metrics.jobHistoryCount = jobs.history(projectId, firstJob.id).length;
metrics.scheduleJobCount = scheduleJobs.list(projectId).length;
metrics.initialItemCount = v1Manifest.itemCount;
metrics.stagedItemCount = staged.manifest.itemCount;
metrics.stagedTombstones = staged.tombstones.length;
metrics.activationEvents = activation.history(projectId).length;
metrics.activeV4Chunks = activation.activeChunkIds(projectId, sourceId, version, runtime).length;
metrics.activeV5Chunks = activation.activeChunkIds(projectId, sourceId, 'v5', 'node').length;
metrics.checkCount = Object.keys(checks).length;
metrics.passedCheckCount = Object.values(checks).filter(Boolean).length;

const engineeringPassed = failures.length === 0;
const gate = {
  createdAt: new Date().toISOString(),
  decision: engineeringPassed ? 'CONDITIONAL_GO' : 'REPEAT',
  engineeringPassed,
  realSchedulerRefreshExecuted: false,
  checks,
  metrics,
  failures,
  blockers: [
    'No deployed scheduler has completed a real source refresh.',
    'Independent Phase 1 benchmark review remains 0/15.',
    'Credentialed hosted-model benchmark remains incomplete.',
    'Public widget pilot remains incomplete.'
  ]
};

const report = [
  '# Phase 4 Reliable Ingestion Gate',
  '',
  `Decision: **${gate.decision}**`,
  `Engineering passed: **${engineeringPassed}**`,
  '',
  '## Checks',
  '',
  ...Object.entries(checks).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'} — ${name}`),
  '',
  '## Metrics',
  '',
  ...Object.entries(metrics).map(([name, value]) => `- ${name}: ${value}`),
  '',
  '## External blockers',
  '',
  ...gate.blockers.map((item) => `- ${item}`),
  ''
].join('\n');

await Promise.all([
  writeFile(path.join(outDir, 'gate.json'), `${JSON.stringify(gate, null, 2)}\n`),
  writeFile(path.join(outDir, 'report.md'), report)
]);
console.log(JSON.stringify(gate, null, 2));
if (!engineeringPassed) process.exitCode = 1;
