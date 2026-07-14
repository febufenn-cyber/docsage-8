import { canonicalLearningEvent, normalizeLearningEvent } from './contracts.mjs';

export class LearningEventConflictError extends Error {
  constructor(message = 'The learning event id was already used with different content.') {
    super(message);
    this.name = 'LearningEventConflictError';
    this.code = 'LEARNING_EVENT_CONFLICT';
  }
}

export class MemoryLearningEventStore {
  #projects = new Map();

  async ingest(input, options = {}) {
    const projectId = typeof input?.projectId === 'string' ? input.projectId.trim() : '';
    const eventId = typeof input?.eventId === 'string' ? input.eventId.trim() : '';
    const existing = this.#projects.get(projectId)?.get(eventId) ?? null;
    const normalizedInput = existing && !input.occurredAt
      ? { ...input, occurredAt: existing.occurredAt }
      : input;
    const event = await normalizeLearningEvent(normalizedInput, {
      ...options,
      receivedAt: existing?.receivedAt ?? options.receivedAt
    });

    let events = this.#projects.get(event.projectId);
    if (!events) {
      events = new Map();
      this.#projects.set(event.projectId, events);
    }
    const current = events.get(event.eventId);
    if (current) {
      if (canonicalLearningEvent(current) !== canonicalLearningEvent(event)) {
        throw new LearningEventConflictError();
      }
      return { accepted: false, duplicate: true, event: current };
    }
    events.set(event.eventId, event);
    return { accepted: true, duplicate: false, event };
  }

  get(projectId, eventId) {
    return this.#projects.get(projectId)?.get(eventId) ?? null;
  }

  list(projectId, options = {}) {
    const { type = null, since = null, until = null, limit = 1000 } = options;
    const lower = since ? new Date(since).getTime() : Number.NEGATIVE_INFINITY;
    const upper = until ? new Date(until).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(lower) && lower !== Number.NEGATIVE_INFINITY) throw new TypeError('since is invalid');
    if (!Number.isFinite(upper) && upper !== Number.POSITIVE_INFINITY) throw new TypeError('until is invalid');
    return Array.from(this.#projects.get(projectId)?.values() ?? [])
      .filter((event) => (!type || event.type === type)
        && new Date(event.occurredAt).getTime() >= lower
        && new Date(event.occurredAt).getTime() <= upper)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId))
      .slice(0, Math.max(0, Math.min(5000, limit)));
  }

  count(projectId) {
    return this.#projects.get(projectId)?.size ?? 0;
  }

  projectIds() {
    return Array.from(this.#projects.keys()).sort();
  }
}
