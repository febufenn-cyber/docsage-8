import { stableId, sha256, stableJson } from '../../core/src/hash.mjs';
import { assertProjectScope } from '../../contracts/src/index.mjs';

export const INGESTION_JOB_STATES = Object.freeze([
  'queued', 'discovering', 'fetching', 'normalizing', 'staging', 'staged',
  'activating', 'succeeded', 'retry_wait', 'failed', 'cancelled', 'rolled_back'
]);

const TRANSITIONS = Object.freeze({
  queued: new Set(['discovering', 'cancelled']),
  discovering: new Set(['fetching', 'retry_wait', 'failed', 'cancelled']),
  fetching: new Set(['normalizing', 'retry_wait', 'failed', 'cancelled']),
  normalizing: new Set(['staging', 'retry_wait', 'failed', 'cancelled']),
  staging: new Set(['staged', 'retry_wait', 'failed', 'cancelled']),
  staged: new Set(['activating', 'cancelled']),
  activating: new Set(['succeeded', 'retry_wait', 'failed']),
  succeeded: new Set(['rolled_back']),
  retry_wait: new Set(['queued', 'failed', 'cancelled']),
  failed: new Set(),
  cancelled: new Set(),
  rolled_back: new Set()
});

const RUNNING_STATES = new Set(['discovering', 'fetching', 'normalizing', 'staging', 'activating']);
const TERMINAL_STATES = new Set(['failed', 'cancelled', 'rolled_back']);
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

function boundedString(value, name, max, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || Array.from(normalized).length > max) throw new RangeError(`${name} is invalid`);
  return normalized;
}

function timestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function boundedInteger(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${name} is out of range`);
  return value;
}

function boundedError(input) {
  if (!input) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new TypeError('error must be an object');
  const code = boundedString(input.code, 'error.code', 64);
  if (!SAFE_CODE.test(code)) throw new TypeError('error.code is invalid');
  const message = boundedString(input.message, 'error.message', 500);
  return Object.freeze({ code, message });
}

function immutableRequest(input) {
  return Object.freeze({
    projectId: boundedString(input.projectId, 'projectId', 128),
    sourceId: boundedString(input.sourceId, 'sourceId', 128),
    idempotencyKey: boundedString(input.idempotencyKey, 'idempotencyKey', 160),
    requestedVersion: boundedString(input.requestedVersion ?? 'current', 'requestedVersion', 100),
    requestedRuntime: boundedString(input.requestedRuntime ?? 'all', 'requestedRuntime', 100),
    trigger: boundedString(input.trigger ?? 'manual', 'trigger', 32),
    externalRevision: boundedString(input.externalRevision, 'externalRevision', 200, { optional: true }),
    configurationHash: boundedString(input.configurationHash ?? sha256(stableJson(input.configuration ?? {})), 'configurationHash', 64),
    maxAttempts: boundedInteger(input.maxAttempts ?? 3, 'maxAttempts', 1, 20)
  });
}

export function normalizeIngestionJob(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('job input must be an object');
  const request = immutableRequest(input);
  const now = timestamp(options.now?.() ?? Date.now(), 'now');
  const id = input.id ?? stableId('ingestjob', request.projectId, request.sourceId, request.idempotencyKey);
  return Object.freeze({
    id,
    ...request,
    requestHash: sha256(stableJson(request)),
    state: 'queued',
    recordVersion: 1,
    attempt: 0,
    availableAt: timestamp(input.availableAt ?? now, 'availableAt'),
    leaseOwner: null,
    leaseExpiresAt: null,
    stagedRevisionId: null,
    activeRevisionBefore: null,
    activatedRevisionId: null,
    failure: null,
    createdAt: now,
    updatedAt: now
  });
}

export function canTransitionIngestionJob(from, to) {
  return Boolean(TRANSITIONS[from]?.has(to));
}

export function transitionIngestionJob(job, to, options = {}) {
  if (!job || !INGESTION_JOB_STATES.includes(job.state)) throw new TypeError('job state is invalid');
  if (!INGESTION_JOB_STATES.includes(to)) throw new TypeError(`unsupported ingestion state: ${to}`);
  if (!canTransitionIngestionJob(job.state, to)) {
    throw Object.assign(new Error(`Invalid ingestion transition: ${job.state} -> ${to}`), { code: 'INGEST_INVALID_TRANSITION' });
  }
  if (options.expectedVersion !== undefined && options.expectedVersion !== job.recordVersion) {
    throw Object.assign(new Error('Ingestion job version conflict'), { code: 'INGEST_VERSION_CONFLICT' });
  }

  const at = timestamp(options.at ?? Date.now(), 'at');
  const worker = boundedString(options.worker, 'worker', 160, { optional: true });
  if (RUNNING_STATES.has(job.state) && job.leaseOwner && worker !== job.leaseOwner) {
    throw Object.assign(new Error('Only the current lease owner may transition this job'), { code: 'INGEST_LEASE_CONFLICT' });
  }

  const nextAttempt = to === 'discovering' && job.state === 'queued' ? job.attempt + 1 : job.attempt;
  if (nextAttempt > job.maxAttempts) throw Object.assign(new Error('Ingestion attempts exhausted'), { code: 'INGEST_RETRY_EXHAUSTED' });
  if (to === 'retry_wait' && nextAttempt >= job.maxAttempts) {
    throw Object.assign(new Error('Retry wait is not permitted after the final attempt'), { code: 'INGEST_RETRY_EXHAUSTED' });
  }

  const failure = options.error === undefined ? (to === 'queued' ? null : job.failure) : boundedError(options.error);
  if ((to === 'failed' || to === 'retry_wait') && !failure) throw new TypeError(`${to} requires a bounded error`);
  if (to === 'staged' && !options.stagedRevisionId && !job.stagedRevisionId) throw new TypeError('staged requires stagedRevisionId');
  if (to === 'succeeded' && !options.activatedRevisionId && !job.activatedRevisionId) throw new TypeError('succeeded requires activatedRevisionId');

  return Object.freeze({
    ...job,
    state: to,
    recordVersion: job.recordVersion + 1,
    attempt: nextAttempt,
    availableAt: options.availableAt ? timestamp(options.availableAt, 'availableAt') : job.availableAt,
    leaseOwner: options.clearLease || TERMINAL_STATES.has(to) || to === 'staged' || to === 'succeeded' || to === 'retry_wait' ? null : job.leaseOwner,
    leaseExpiresAt: options.clearLease || TERMINAL_STATES.has(to) || to === 'staged' || to === 'succeeded' || to === 'retry_wait' ? null : job.leaseExpiresAt,
    stagedRevisionId: options.stagedRevisionId ?? job.stagedRevisionId,
    activeRevisionBefore: options.activeRevisionBefore ?? job.activeRevisionBefore,
    activatedRevisionId: options.activatedRevisionId ?? job.activatedRevisionId,
    failure,
    updatedAt: at
  });
}

export class IngestionJobConflictError extends Error {
  constructor(message = 'The ingestion idempotency key was already used with different immutable input.') {
    super(message);
    this.name = 'IngestionJobConflictError';
    this.code = 'INGEST_JOB_CONFLICT';
  }
}

export class MemoryIngestionJobStore {
  #jobs = new Map();
  #keys = new Map();
  #history = new Map();

  create(input, options = {}) {
    const candidate = normalizeIngestionJob(input, options);
    const scopeKey = `${candidate.projectId}\u241f${candidate.sourceId}\u241f${candidate.idempotencyKey}`;
    const existingId = this.#keys.get(scopeKey);
    if (existingId) {
      const existing = this.#jobs.get(existingId);
      if (existing.requestHash !== candidate.requestHash) throw new IngestionJobConflictError();
      return { created: false, duplicate: true, job: existing };
    }
    this.#jobs.set(candidate.id, candidate);
    this.#keys.set(scopeKey, candidate.id);
    this.#history.set(candidate.id, [Object.freeze({
      sequence: 1, projectId: candidate.projectId, jobId: candidate.id,
      from: null, to: 'queued', actor: options.actor ?? 'system', at: candidate.createdAt,
      recordVersion: candidate.recordVersion
    })]);
    return { created: true, duplicate: false, job: candidate };
  }

  get(projectId, jobId) {
    const job = this.#jobs.get(jobId);
    return job ? assertProjectScope(job, projectId) : null;
  }

  list(projectId, options = {}) {
    const states = options.states ? new Set(options.states) : null;
    return Array.from(this.#jobs.values())
      .filter((job) => job.projectId === projectId && (!states || states.has(job.state)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  transition(projectId, jobId, to, options = {}) {
    const current = assertProjectScope(this.#jobs.get(jobId), projectId);
    const next = transitionIngestionJob(current, to, options);
    this.#jobs.set(jobId, next);
    const history = this.#history.get(jobId);
    history.push(Object.freeze({
      sequence: history.length + 1,
      projectId,
      jobId,
      from: current.state,
      to,
      actor: options.actor ?? options.worker ?? 'system',
      at: next.updatedAt,
      recordVersion: next.recordVersion,
      failure: next.failure
    }));
    return next;
  }

  claim(projectId, jobId, { worker, now = Date.now(), leaseMs = 60_000, expectedVersion } = {}) {
    const current = assertProjectScope(this.#jobs.get(jobId), projectId);
    if (!worker) throw new TypeError('worker is required');
    if (expectedVersion !== undefined && expectedVersion !== current.recordVersion) {
      throw Object.assign(new Error('Ingestion job version conflict'), { code: 'INGEST_VERSION_CONFLICT' });
    }
    const nowIso = timestamp(now, 'now');
    if (current.leaseOwner && current.leaseExpiresAt && current.leaseExpiresAt > nowIso && current.leaseOwner !== worker) {
      throw Object.assign(new Error('Ingestion job already has a live lease'), { code: 'INGEST_LEASE_CONFLICT' });
    }
    const claimed = Object.freeze({
      ...current,
      recordVersion: current.recordVersion + 1,
      leaseOwner: boundedString(worker, 'worker', 160),
      leaseExpiresAt: new Date(new Date(nowIso).getTime() + boundedInteger(leaseMs, 'leaseMs', 1_000, 3_600_000)).toISOString(),
      updatedAt: nowIso
    });
    this.#jobs.set(jobId, claimed);
    const history = this.#history.get(jobId);
    history.push(Object.freeze({
      sequence: history.length + 1, projectId, jobId, from: current.state, to: current.state,
      actor: worker, at: nowIso, recordVersion: claimed.recordVersion, lease: 'claimed'
    }));
    return claimed;
  }

  history(projectId, jobId) {
    assertProjectScope(this.#jobs.get(jobId), projectId);
    return [...this.#history.get(jobId)];
  }
}
