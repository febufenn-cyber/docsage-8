import { stableId, sha256, stableJson } from '../../core/src/hash.mjs';
import { assertProjectScope } from '../../contracts/src/index.mjs';
import { normalizeLearningEvent } from '../../learning/src/contracts.mjs';

const RUNNING_STATES = Object.freeze(['discovering', 'fetching', 'normalizing', 'staging', 'activating']);

function boundedString(value, name, max) {
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

function clockValue(value) {
  return typeof value === 'function' ? value() : (value ?? Date.now());
}

function scheduleIdentity(schedule) {
  const { createdAt, updatedAt, nextRunAt, ...identity } = schedule;
  return stableJson(identity);
}

export function deterministicBackoff(input = {}) {
  const attempt = input.attempt;
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 20) throw new RangeError('attempt must be between 1 and 20');
  const baseMs = input.baseMs ?? 5_000;
  const maxMs = input.maxMs ?? 900_000;
  const jitterRatio = input.jitterRatio ?? 0.2;
  const jitter = input.jitter ?? 0.5;
  if (!Number.isFinite(baseMs) || baseMs < 100 || !Number.isFinite(maxMs) || maxMs < baseMs) throw new RangeError('backoff bounds are invalid');
  if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) throw new RangeError('jitterRatio is invalid');
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) throw new RangeError('jitter must be between 0 and 1');
  const exponential = Math.min(maxMs, baseMs * (2 ** (attempt - 1)));
  const factor = 1 - jitterRatio + (2 * jitterRatio * jitter);
  return Math.max(100, Math.min(maxMs, Math.round(exponential * factor)));
}

export function normalizeIngestionSchedule(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('schedule must be an object');
  const projectId = boundedString(input.projectId, 'projectId', 128);
  const sourceId = boundedString(input.sourceId, 'sourceId', 128);
  const intervalMs = input.intervalMs;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 60_000 || intervalMs > 31 * 24 * 60 * 60 * 1_000) {
    throw new RangeError('intervalMs must be between one minute and 31 days');
  }
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new RangeError('maxAttempts must be between 1 and 20');
  const now = timestamp(clockValue(options.now), 'now');
  const id = input.id ?? stableId('schedule', projectId, sourceId, input.name ?? intervalMs);
  return Object.freeze({
    id,
    projectId,
    sourceId,
    name: boundedString(input.name ?? id, 'name', 160),
    intervalMs,
    enabled: input.enabled !== false,
    nextRunAt: timestamp(input.nextRunAt ?? now, 'nextRunAt'),
    requestedVersion: boundedString(input.requestedVersion ?? 'current', 'requestedVersion', 100),
    requestedRuntime: boundedString(input.requestedRuntime ?? 'all', 'requestedRuntime', 100),
    maxAttempts,
    configuration: Object.freeze(input.configuration && typeof input.configuration === 'object' && !Array.isArray(input.configuration) ? { ...input.configuration } : {}),
    configurationHash: sha256(stableJson(input.configuration ?? {})),
    createdAt: now,
    updatedAt: now
  });
}

export class MemoryIngestionScheduler {
  #schedules = new Map();

  add(input, options = {}) {
    const schedule = normalizeIngestionSchedule(input, options);
    const existing = this.#schedules.get(schedule.id);
    if (existing && scheduleIdentity(existing) !== scheduleIdentity(schedule)) {
      throw Object.assign(new Error('Schedule identity conflict'), { code: 'INGEST_SCHEDULE_CONFLICT' });
    }
    if (existing) return { created: false, schedule: existing };
    this.#schedules.set(schedule.id, schedule);
    return { created: true, schedule };
  }

  get(projectId, scheduleId) {
    const schedule = this.#schedules.get(scheduleId);
    return schedule ? assertProjectScope(schedule, projectId) : null;
  }

  due(projectId, now = Date.now(), limit = 100) {
    const nowIso = timestamp(clockValue(now), 'now');
    return [...this.#schedules.values()]
      .filter((schedule) => schedule.projectId === projectId && schedule.enabled && schedule.nextRunAt <= nowIso)
      .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt) || a.id.localeCompare(b.id))
      .slice(0, Math.max(1, Math.min(1_000, limit)));
  }

  enqueueDue(projectId, jobStore, options = {}) {
    if (!jobStore?.create) throw new TypeError('jobStore is required');
    const nowIso = timestamp(clockValue(options.now), 'now');
    const results = [];
    for (const schedule of this.due(projectId, nowIso, options.limit ?? 100)) {
      const occurrenceAt = schedule.nextRunAt;
      const result = jobStore.create({
        projectId,
        sourceId: schedule.sourceId,
        idempotencyKey: `schedule:${schedule.id}:${occurrenceAt}`,
        requestedVersion: schedule.requestedVersion,
        requestedRuntime: schedule.requestedRuntime,
        trigger: 'schedule',
        configurationHash: schedule.configurationHash,
        maxAttempts: schedule.maxAttempts,
        availableAt: occurrenceAt
      }, { now: () => nowIso, actor: 'scheduler' });
      let nextMs = new Date(occurrenceAt).getTime();
      const nowMs = new Date(nowIso).getTime();
      do nextMs += schedule.intervalMs; while (nextMs <= nowMs);
      const advanced = Object.freeze({ ...schedule, nextRunAt: new Date(nextMs).toISOString(), updatedAt: nowIso });
      this.#schedules.set(schedule.id, advanced);
      results.push(Object.freeze({ scheduleId: schedule.id, occurrenceAt, job: result.job, duplicate: result.duplicate }));
    }
    return results;
  }
}

export function recoverExpiredIngestionJobs(jobStore, projectId, options = {}) {
  if (!jobStore?.list || !jobStore?.transition) throw new TypeError('jobStore is required');
  const nowIso = timestamp(clockValue(options.now), 'now');
  const recovered = [];
  for (const job of jobStore.list(projectId, { states: RUNNING_STATES })) {
    if (!job.leaseOwner || !job.leaseExpiresAt || job.leaseExpiresAt > nowIso) continue;
    const failure = { code: 'INGEST_WORKER_LEASE_EXPIRED', message: 'The worker lease expired before the ingestion stage completed.' };
    if (job.attempt >= job.maxAttempts) {
      const failed = jobStore.transition(projectId, job.id, 'failed', {
        worker: job.leaseOwner,
        actor: 'lease-recovery',
        expectedVersion: job.recordVersion,
        error: failure,
        at: nowIso,
        clearLease: true
      });
      recovered.push(Object.freeze({ job: failed, outcome: 'failed' }));
      continue;
    }
    const delayMs = deterministicBackoff({
      attempt: Math.max(1, job.attempt),
      baseMs: options.baseMs,
      maxMs: options.maxMs,
      jitterRatio: options.jitterRatio,
      jitter: options.jitter ?? 0.5
    });
    const retry = jobStore.transition(projectId, job.id, 'retry_wait', {
      worker: job.leaseOwner,
      actor: 'lease-recovery',
      expectedVersion: job.recordVersion,
      error: failure,
      availableAt: new Date(new Date(nowIso).getTime() + delayMs).toISOString(),
      at: nowIso,
      clearLease: true
    });
    recovered.push(Object.freeze({ job: retry, outcome: 'retry_wait', delayMs }));
  }
  return recovered;
}

export function sourceHealthFromIngestionJob(job) {
  const status = job.state === 'succeeded' ? 'healthy'
    : job.state === 'failed' ? 'failed'
      : job.state === 'retry_wait' ? 'degraded'
        : 'unknown';
  return Object.freeze({
    projectId: job.projectId,
    sourceId: job.sourceId,
    status,
    jobId: job.id,
    jobState: job.state,
    attempt: job.attempt,
    failureCode: job.failure?.code ?? null,
    checkedAt: job.updatedAt
  });
}

export async function makeSourceHealthLearningEvent(job, options = {}) {
  const health = sourceHealthFromIngestionJob(job);
  return normalizeLearningEvent({
    eventId: options.eventId ?? crypto.randomUUID(),
    projectId: health.projectId,
    type: 'source.health',
    source: 'ingestion',
    occurredAt: options.occurredAt ?? health.checkedAt,
    sourceStatus: health.status,
    failureCode: health.failureCode,
    metadata: {
      source_id: health.sourceId,
      job_state: health.jobState,
      attempt: health.attempt
    }
  }, { receivedAt: options.receivedAt ?? options.occurredAt ?? health.checkedAt });
}

export class MemorySourceHealthStore {
  #health = new Map();

  record(job) {
    const health = sourceHealthFromIngestionJob(job);
    const key = `${health.projectId}\u241f${health.sourceId}`;
    const existing = this.#health.get(key);
    if (!existing || health.checkedAt >= existing.checkedAt) this.#health.set(key, health);
    return this.#health.get(key);
  }

  get(projectId, sourceId) {
    const health = this.#health.get(`${projectId}\u241f${sourceId}`);
    return health ? assertProjectScope(health, projectId) : null;
  }

  list(projectId) {
    return [...this.#health.values()].filter((item) => item.projectId === projectId)
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }
}
