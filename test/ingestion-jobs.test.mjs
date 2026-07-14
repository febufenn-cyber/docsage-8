import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryIngestionJobStore,
  IngestionJobConflictError,
  canTransitionIngestionJob,
  normalizeIngestionJob,
  transitionIngestionJob
} from '../packages/ingestion/src/jobs.mjs';

const projectId = 'project_alpha';
const sourceId = 'source_docs';
const base = {
  projectId,
  sourceId,
  idempotencyKey: 'refresh-2026-07-14T10:00Z',
  requestedVersion: 'v4',
  requestedRuntime: 'cloudflare',
  trigger: 'manual',
  configuration: { include: ['docs/'] },
  maxAttempts: 3
};
const t0 = '2026-07-14T10:00:00.000Z';

function createStore() {
  const store = new MemoryIngestionJobStore();
  const created = store.create(base, { now: () => t0, actor: 'operator' });
  return { store, job: created.job };
}

test('normalizes deterministic immutable job identity', () => {
  const first = normalizeIngestionJob(base, { now: () => t0 });
  const second = normalizeIngestionJob(base, { now: () => '2026-07-14T11:00:00.000Z' });
  assert.equal(first.id, second.id);
  assert.equal(first.requestHash, second.requestHash);
  assert.equal(first.state, 'queued');
  assert.equal(first.recordVersion, 1);
});

test('exact idempotency replay returns the existing job', () => {
  const { store, job } = createStore();
  const replay = store.create(base, { now: () => '2026-07-14T11:00:00.000Z' });
  assert.equal(replay.created, false);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.job, job);
  assert.equal(store.list(projectId).length, 1);
});

test('conflicting idempotency replay is blocked', () => {
  const { store } = createStore();
  assert.throws(
    () => store.create({ ...base, requestedVersion: 'v5' }),
    (error) => error instanceof IngestionJobConflictError && error.code === 'INGEST_JOB_CONFLICT'
  );
});

test('transition graph blocks invalid and stale writes', () => {
  const job = normalizeIngestionJob(base, { now: () => t0 });
  assert.equal(canTransitionIngestionJob('queued', 'discovering'), true);
  assert.equal(canTransitionIngestionJob('queued', 'succeeded'), false);
  assert.throws(
    () => transitionIngestionJob(job, 'succeeded', { expectedVersion: 1 }),
    (error) => error.code === 'INGEST_INVALID_TRANSITION'
  );
  assert.throws(
    () => transitionIngestionJob(job, 'discovering', { expectedVersion: 2 }),
    (error) => error.code === 'INGEST_VERSION_CONFLICT'
  );
});

test('lease ownership protects running transitions and live leases', () => {
  const { store, job } = createStore();
  const claimed = store.claim(projectId, job.id, {
    worker: 'worker-a', now: t0, leaseMs: 60_000, expectedVersion: 1
  });
  assert.equal(claimed.leaseOwner, 'worker-a');
  assert.equal(claimed.recordVersion, 2);
  assert.throws(
    () => store.claim(projectId, job.id, { worker: 'worker-b', now: '2026-07-14T10:00:30.000Z' }),
    (error) => error.code === 'INGEST_LEASE_CONFLICT'
  );
  const discovering = store.transition(projectId, job.id, 'discovering', {
    worker: 'worker-a', expectedVersion: 2, at: '2026-07-14T10:00:01.000Z'
  });
  assert.equal(discovering.attempt, 1);
  assert.equal(discovering.leaseOwner, 'worker-a');
  assert.throws(
    () => store.transition(projectId, job.id, 'fetching', { worker: 'worker-b', expectedVersion: 3 }),
    (error) => error.code === 'INGEST_LEASE_CONFLICT'
  );
});

test('expired lease can be recovered by another worker', () => {
  const { store, job } = createStore();
  const claimed = store.claim(projectId, job.id, { worker: 'worker-a', now: t0, leaseMs: 1_000 });
  const recovered = store.claim(projectId, job.id, {
    worker: 'worker-b', now: '2026-07-14T10:00:02.000Z', leaseMs: 10_000,
    expectedVersion: claimed.recordVersion
  });
  assert.equal(recovered.leaseOwner, 'worker-b');
  assert.equal(recovered.recordVersion, 3);
});

test('staging and success require revision pointers and clear leases', () => {
  const { store, job } = createStore();
  let current = store.claim(projectId, job.id, { worker: 'worker-a', now: t0 });
  for (const [state, at] of [
    ['discovering', '2026-07-14T10:00:01.000Z'],
    ['fetching', '2026-07-14T10:00:02.000Z'],
    ['normalizing', '2026-07-14T10:00:03.000Z'],
    ['staging', '2026-07-14T10:00:04.000Z']
  ]) current = store.transition(projectId, job.id, state, { worker: 'worker-a', expectedVersion: current.recordVersion, at });
  assert.throws(
    () => store.transition(projectId, job.id, 'staged', { worker: 'worker-a', expectedVersion: current.recordVersion }),
    /stagedRevisionId/
  );
  current = store.transition(projectId, job.id, 'staged', {
    worker: 'worker-a', expectedVersion: current.recordVersion,
    stagedRevisionId: 'revision_v4', at: '2026-07-14T10:00:05.000Z'
  });
  assert.equal(current.leaseOwner, null);
  current = store.transition(projectId, job.id, 'activating', {
    expectedVersion: current.recordVersion, at: '2026-07-14T10:00:06.000Z'
  });
  assert.throws(
    () => store.transition(projectId, job.id, 'succeeded', { expectedVersion: current.recordVersion }),
    /activatedRevisionId/
  );
  current = store.transition(projectId, job.id, 'succeeded', {
    expectedVersion: current.recordVersion, activatedRevisionId: 'revision_v4',
    activeRevisionBefore: 'revision_v3', at: '2026-07-14T10:00:07.000Z'
  });
  assert.equal(current.state, 'succeeded');
  assert.equal(current.activatedRevisionId, 'revision_v4');
  assert.equal(current.activeRevisionBefore, 'revision_v3');
});

test('retry states require bounded errors and enforce attempts', () => {
  const { store, job } = createStore();
  let current = store.claim(projectId, job.id, { worker: 'worker-a', now: t0 });
  current = store.transition(projectId, job.id, 'discovering', {
    worker: 'worker-a', expectedVersion: current.recordVersion, at: '2026-07-14T10:00:01.000Z'
  });
  assert.throws(
    () => store.transition(projectId, job.id, 'retry_wait', { worker: 'worker-a', expectedVersion: current.recordVersion }),
    /bounded error/
  );
  current = store.transition(projectId, job.id, 'retry_wait', {
    worker: 'worker-a', expectedVersion: current.recordVersion,
    error: { code: 'INGEST_FETCH_FAIL', message: 'Temporary upstream failure' },
    availableAt: '2026-07-14T10:01:00.000Z', at: '2026-07-14T10:00:02.000Z'
  });
  assert.equal(current.leaseOwner, null);
  assert.equal(current.failure.code, 'INGEST_FETCH_FAIL');
  current = store.transition(projectId, job.id, 'queued', {
    expectedVersion: current.recordVersion, at: '2026-07-14T10:01:00.000Z'
  });
  assert.equal(current.failure, null);
});

test('job and history access are project isolated and append-only snapshots', () => {
  const { store, job } = createStore();
  assert.throws(() => store.get('project_beta', job.id), (error) => error.code === 'SAFE_TENANT_LEAK');
  const history = store.history(projectId, job.id);
  assert.equal(history.length, 1);
  history.push({ sequence: 999 });
  assert.equal(store.history(projectId, job.id).length, 1);
});

test('migration defines project RLS, append-only history, leases, and unique idempotency', async () => {
  const sql = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../supabase/migrations/20260714000300_reliable_ingestion_jobs.sql', import.meta.url), 'utf8'));
  for (const expected of [
    'unique(project_id, source_id, idempotency_key)',
    'ingestion_job_transitions is append-only',
    'enable row level security',
    'public.owns_project(project_id)',
    'lease_expires_at',
    'record_version'
  ]) assert.match(sql, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
