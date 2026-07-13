export const FEEDBACK_RATINGS = Object.freeze(['useful', 'not_useful']);
export const FEEDBACK_REASONS = Object.freeze([
  'clear_answer', 'incomplete', 'incorrect', 'missing_source', 'outdated', 'other'
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateFeedback(input, options = {}) {
  const { allowComment = false, maxCommentCharacters = 500 } = options;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Feedback payload is invalid.'), { code: 'FEEDBACK_INVALID' });
  }
  if (typeof input.eventId !== 'string' || !UUID.test(input.eventId)) {
    throw Object.assign(new Error('eventId must be a UUID.'), { code: 'FEEDBACK_INVALID' });
  }
  if (typeof input.traceId !== 'string' || !input.traceId.trim() || input.traceId.length > 200) {
    throw Object.assign(new Error('traceId is invalid.'), { code: 'FEEDBACK_INVALID' });
  }
  if (!FEEDBACK_RATINGS.includes(input.rating)) {
    throw Object.assign(new Error('rating is invalid.'), { code: 'FEEDBACK_INVALID' });
  }
  if (input.reason !== undefined && !FEEDBACK_REASONS.includes(input.reason)) {
    throw Object.assign(new Error('reason is invalid.'), { code: 'FEEDBACK_INVALID' });
  }
  let comment = null;
  if (input.comment !== undefined && input.comment !== null && input.comment !== '') {
    if (!allowComment) {
      throw Object.assign(new Error('Free-text feedback is disabled.'), { code: 'FEEDBACK_INVALID' });
    }
    if (typeof input.comment !== 'string') {
      throw Object.assign(new Error('comment is invalid.'), { code: 'FEEDBACK_INVALID' });
    }
    comment = input.comment.trim();
    if (Array.from(comment).length > maxCommentCharacters || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(comment)) {
      throw Object.assign(new Error('comment is invalid.'), { code: 'FEEDBACK_INVALID' });
    }
  }
  return {
    eventId: input.eventId.toLowerCase(),
    traceId: input.traceId.trim(),
    rating: input.rating,
    reason: input.reason ?? null,
    comment
  };
}

export class MemoryFeedbackStore {
  constructor(options = {}) {
    const { maxEntries = 10_000, now = () => Date.now() } = options;
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new TypeError('maxEntries must be a positive integer');
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  async record(entry) {
    const existing = this.entries.get(entry.eventId);
    if (existing) return { accepted: true, duplicate: true, entry: existing };
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    const stored = Object.freeze({ ...entry, createdAt: new Date(this.now()).toISOString() });
    this.entries.set(entry.eventId, stored);
    return { accepted: true, duplicate: false, entry: stored };
  }

  async get(eventId) {
    return this.entries.get(String(eventId).toLowerCase()) ?? null;
  }

  async list() {
    return [...this.entries.values()];
  }
}
