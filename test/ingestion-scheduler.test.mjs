import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryIngestionJobStore } from '../packages/ingestion/src/jobs.mjs';
import {
  deterministicBackoff,
  normalizeIngestionSchedule,
  MemoryIngestionScheduler,
  recoverExpiredIngestionJobs,
  sourceHealthFromIngestionJob,
  makeSourceHealthLearningEvent,
  MemorySourceHealthStore
} from '../packages/ingestion/src/scheduler.mjs';

const projectId = 'project_alpha';
const sourceId = 'source_docs';
const t0 = '2026-07-14T10:00:00.000Z';

function scheduleInput(overrides = {}) {
  return {
    id: 'schedule_docs', projectId, sourceId, name: 'Docs refresh',
    intervalMs: 60_000, nextRunAt: t0, requestedVersion: 'v4',
    requestedRuntime: 'cloudflare', maxAttempts: 3,
    configuration: { include: ['docs/'] }, ...overrides
  };
}

function runningJob({ maxAttempts = 3, leaseMs = 1_000 } = {}) {
  const store = new MemoryIngestionJobStore();
  const created = store.create({
    projectId, sourceId, idempotencyKey: `job-${maxAttempts}`,
    requestedVersion: 'v4', maxAttempts
  }, { now: () => t0 }).job;
  let current = store.claim(projectId, created.id, { worker: 'worker-a', now: t0, leaseMs });
  current = store.transition(projectId, created.id, 'discovering', {
    worker: 'worker-a', expectedVersion: current.recordVersion,
    at: '2026-07-14T10:00:00.100Z'
  });
  return { store, job: current };
}

test('backoff is deterministic, exponential, jitter-bounded, and capped', () => {
  assert.equal(deterministicBackoff({ attempt: 1, baseMs: 1_000, maxMs: 10_000, jitterRatio: 0.2, jitter: 0.5 }), 1_000);
  assert.equal(deterministicBackoff({ attempt: 2, baseMs: 1_000, maxMs: 10_000, jitterRatio: 0.2, jitter: 0.5 }), 2_000);
  assert.equal(deterministicBackoff({ attempt: 10, baseMs: 1_000, maxMs: 10_000, jitterRatio: 0.2, jitter: 1 }), 10_000);
  assert.equal(deterministicBackoff({ attempt: 1, baseMs: 1_000, maxMs: 10_000, jitterRatio: 0.2, jitter: 0 }), 800);
  assert.throws(() => deterministicBackoff({ attempt: 0 }), /attempt/);
});

test('schedule bounds and stable identity are enforced', () => {
  const first = normalizeIngestionSchedule(scheduleInput(), { now: () => t0 });
  const second = normalizeIngestionSchedule(scheduleInput(), { now: () => t0 });
  assert.equal(first.id, second.id);
  assert.equal(first.configurationHash, second.configurationHash);
  assert.throws(() => normalizeIngestionSchedule(scheduleInput({ intervalMs: 1_000 })), /intervalMs/);
});

test('concurrent due delivery converges on one idempotent job', () => {
  const jobs = new MemoryIngestionJobStore();
  const schedulerA = new MemoryIngestionScheduler();
  const schedulerB = new MemoryIngestionScheduler();
  schedulerA.add(scheduleInput(), { now: () => t0 });
  schedulerB.add(scheduleInput(), { now: () => t0 });
  const first = schedulerA.enqueueDue(projectId, jobs, { now: t0 });
  const second = schedulerB.enqueueDue(projectId, jobs, { now: t0 });
  assert.equal(first.length, 1);
  assert.equal(first[0].duplicate, false);
  assert.equal(second.length, 1);
  assert.equal(second[0].duplicate, true);
  assert.equal(jobs.list(projectId).length, 1);
  assert.match(first[0].job.idempotencyKey, /^schedule:schedule_docs:/);
});

test('scheduler advances beyond now and does not enqueue an unbounded catch-up backlog', () => {
  const jobs = new MemoryIngestionJobStore();
  const scheduler = new MemoryIngestionScheduler();
  scheduler.add(scheduleInput(), { now: () => t0 });
  const results = scheduler.enqueueDue(projectId, jobs, { now: '2026-07-14T10:10:30.000Z' });
  assert.equal(results.length, 1);
  assert.equal(scheduler.due(projectId, '2026-07-14T10:10:30.000Z').length, 0);
  assert.equal(jobs.list(projectId).length, 1);
  assert.equal(scheduler.get(projectId, 'schedule_docs').nextRunAt, '2026-07-14T10:11:00.000Z');
});

test('expired lease moves a recoverable job to retry_wait with deterministic availability', () => {
  const { store, job } = runningJob({ maxAttempts: 3 });
  const results = recoverExpiredIngestionJobs(store, projectId, {
    now: '2026-07-14T10:00:02.000Z', baseMs: 5_000, maxMs: 60_000,
    jitterRatio: 0.2, jitter: 0.5
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].outcome, 'retry_wait');
  assert.equal(results[0].delayMs, 5_000);
  assert.equal(results[0].job.state, 'retry_wait');
  assert.equal(results[0].job.availableAt, '2026-07-14T10:00:07.000Z');
  assert.equal(results[0].job.leaseOwner, null);
  assert.equal(results[0].job.failure.code, 'INGEST_WORKER_LEASE_EXPIRED');
  assert.equal(store.history(projectId, job.id).at(-1).actor, 'lease-recovery');
});

test('expired final-attempt job becomes failed instead of retrying', () => {
  const { store } = runningJob({ maxAttempts: 1 });
  const results = recoverExpiredIngestionJobs(store, projectId, { now: '2026-07-14T10:00:02.000Z' });
  assert.equal(results[0].outcome, 'failed');
  assert.equal(results[0].job.state, 'failed');
  assert.equal(results[0].job.leaseOwner, null);
});

test('live leases are ignored by recovery', () => {
  const { store } = runningJob({ maxAttempts: 3, leaseMs: 60_000 });
  assert.deepEqual(recoverExpiredIngestionJobs(store, projectId, { now: '2026-07-14T10:00:02.000Z' }), []);
});

test('source health mapping and learning event are privacy bounded', async () => {
  const { store, job } = runningJob({ maxAttempts: 1 });
  const failed = recoverExpiredIngestionJobs(store, projectId, { now: '2026-07-14T10:00:02.000Z' })[0].job;
  const health = sourceHealthFromIngestionJob(failed);
  assert.deepEqual(health, {
    projectId, sourceId, status: 'failed', jobId: failed.id,
    jobState: 'failed', attempt: 1,
    failureCode: 'INGEST_WORKER_LEASE_EXPIRED', checkedAt: failed.updatedAt
  });
  const event = await makeSourceHealthLearningEvent(failed, {
    eventId: '018f6b5c-7f11-7d10-9f24-000000000101',
    occurredAt: failed.updatedAt,
    receivedAt: failed.updatedAt
  });
  assert.equal(event.type, 'source.health');
  assert.equal(event.sourceStatus, 'failed');
  assert.equal(event.questionExcerpt, null);
  assert.equal(event.questionFingerprint, null);
  assert.deepEqual({ ...event.metadata }, { source_id: sourceId, job_state: 'failed', attempt: 1 });
  assert.equal(JSON.stringify(event).includes('https://'), false);
  assert.equal(JSON.stringify(event).includes('token'), false);
  assert.equal(job.projectId, projectId);
});

test('latest source health is project isolated', () => {
  const store = new MemorySourceHealthStore();
  const first = { projectId, sourceId, id: 'job-1', state: 'retry_wait', attempt: 1, failure: { code: 'INGEST_FETCH_FAIL' }, updatedAt: t0 };
  const latest = { ...first, id: 'job-2', state: 'succeeded', failure: null, updatedAt: '2026-07-14T11:00:00.000Z' };
  store.record(latest);
  store.record(first);
  assert.equal(store.get(projectId, sourceId).status, 'healthy');
  assert.equal(store.list(projectId).length, 1);
  assert.equal(store.get('project_beta', sourceId), null);
});

test('migration defines due scheduling, health state, project RLS, and bounded intervals', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(new URL('../supabase/migrations/20260714000500_ingestion_schedules_health.sql', import.meta.url), 'utf8');
  for (const expected of [
    'ingestion_schedules_due_idx', 'interval_ms between 60000 and 2678400000',
    'source_health', "status in ('healthy','degraded','failed','unknown')",
    'enable row level security', 'public.owns_project(project_id)'
  ]) assert.ok(sql.includes(expected), `missing SQL invariant: ${expected}`);
});
