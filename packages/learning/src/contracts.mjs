import { fingerprintQuestion, redactSensitiveText } from './privacy.mjs';

export const LEARNING_EVENT_TYPES = Object.freeze([
  'answer.completed',
  'answer.refused',
  'feedback.recorded',
  'source.health',
  'evaluation.failed'
]);

export const LEARNING_SOURCES = Object.freeze([
  'answer', 'widget', 'feedback', 'ingestion', 'evaluation', 'system'
]);

const ANSWER_STATES = new Set([
  'supported', 'partially_supported', 'conflicting_sources', 'version_ambiguous',
  'runtime_ambiguous', 'not_found', 'account_specific', 'out_of_scope', 'unsafe_or_untrusted'
]);
const FEEDBACK_RATINGS = new Set(['useful', 'not_useful']);
const SOURCE_STATUSES = new Set(['healthy', 'degraded', 'failed', 'unknown']);
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const RAW_TEXT_KEYS = new Set([
  'question', 'prompt', 'answer', 'body', 'html', 'content', 'authorization',
  'cookie', 'token', 'access_token', 'api_key', 'password', 'secret'
]);

function boundedString(value, name, max, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || Array.from(normalized).length > max) {
    throw new RangeError(`${name} must contain between 1 and ${max} characters`);
  }
  return normalized;
}

function isoTimestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

function boundedNumber(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = true } = {}) {
  if ((value === undefined || value === null) && optional) return null;
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${name} is out of range`);
  return value;
}

export function normalizeLearningMetadata(input = {}) {
  if (input === null || input === undefined) return Object.freeze({});
  if (typeof input !== 'object' || Array.isArray(input)) throw new TypeError('metadata must be a flat object');
  const output = Object.create(null);
  let accepted = 0;
  for (const [key, value] of Object.entries(input)) {
    if (accepted >= 24) break;
    if (!SAFE_KEY.test(key) || FORBIDDEN_KEYS.has(key) || RAW_TEXT_KEYS.has(key)) continue;
    if (value === null || typeof value === 'boolean') {
      output[key] = value;
      accepted += 1;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      output[key] = Math.max(-1_000_000_000, Math.min(1_000_000_000, value));
      accepted += 1;
      continue;
    }
    if (typeof value === 'string') {
      const redacted = redactSensitiveText(value, { maxCharacters: 160 });
      output[key] = redacted.text;
      accepted += 1;
    }
  }
  return Object.freeze(output);
}

export async function normalizeLearningEvent(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('learning event must be an object');
  const eventId = boundedString(input.eventId, 'eventId', 64);
  if (!EVENT_ID.test(eventId)) throw new TypeError('eventId must be a UUID');
  const projectId = boundedString(input.projectId, 'projectId', 128);
  const type = boundedString(input.type, 'type', 64);
  if (!LEARNING_EVENT_TYPES.includes(type)) throw new TypeError(`unsupported learning event type: ${type}`);
  const source = boundedString(input.source, 'source', 32);
  if (!LEARNING_SOURCES.includes(source)) throw new TypeError(`unsupported learning source: ${source}`);

  const occurredAt = isoTimestamp(input.occurredAt ?? options.now?.() ?? Date.now(), 'occurredAt');
  const receivedAt = isoTimestamp(options.receivedAt ?? options.now?.() ?? Date.now(), 'receivedAt');
  const traceId = boundedString(input.traceId, 'traceId', 200, { optional: true });
  const answerState = boundedString(input.answerState, 'answerState', 64, { optional: true });
  if (answerState && !ANSWER_STATES.has(answerState)) throw new TypeError('answerState is invalid');
  const feedbackRating = boundedString(input.feedbackRating, 'feedbackRating', 32, { optional: true });
  if (feedbackRating && !FEEDBACK_RATINGS.has(feedbackRating)) throw new TypeError('feedbackRating is invalid');
  const feedbackReason = boundedString(input.feedbackReason, 'feedbackReason', 64, { optional: true });
  const sourceStatus = boundedString(input.sourceStatus, 'sourceStatus', 32, { optional: true });
  if (sourceStatus && !SOURCE_STATUSES.has(sourceStatus)) throw new TypeError('sourceStatus is invalid');
  const failureCode = boundedString(input.failureCode, 'failureCode', 100, { optional: true });

  let questionFingerprint = null;
  let questionExcerpt = null;
  let redactionCount = 0;
  if (typeof input.question === 'string' && input.question.trim()) {
    const projectSalt = options.projectSalt ?? input.projectSalt;
    const result = await fingerprintQuestion({ projectSalt, question: input.question });
    questionFingerprint = result.fingerprint;
    const excerpt = redactSensitiveText(input.question, { maxCharacters: 240 });
    questionExcerpt = excerpt.text || null;
    redactionCount = Math.max(result.redacted.redactionCount, excerpt.redactionCount);
  } else if (input.questionFingerprint) {
    const fingerprint = boundedString(input.questionFingerprint, 'questionFingerprint', 64);
    if (!/^[0-9a-f]{64}$/i.test(fingerprint)) throw new TypeError('questionFingerprint must be a SHA-256 hex digest');
    questionFingerprint = fingerprint.toLowerCase();
    if (input.questionExcerpt) {
      const excerpt = redactSensitiveText(input.questionExcerpt, { maxCharacters: 240 });
      questionExcerpt = excerpt.text || null;
      redactionCount = excerpt.redactionCount;
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    eventId,
    projectId,
    type,
    source,
    occurredAt,
    receivedAt,
    traceId,
    answerState,
    feedbackRating,
    feedbackReason,
    sourceStatus,
    failureCode,
    citationCount: boundedNumber(input.citationCount, 'citationCount', { min: 0, max: 100 }),
    latencyMs: boundedNumber(input.latencyMs, 'latencyMs', { min: 0, max: 300_000 }),
    questionFingerprint,
    questionExcerpt,
    redactionCount,
    metadata: normalizeLearningMetadata(input.metadata)
  });
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]);
    return output;
  }
  return value;
}

export function canonicalLearningEvent(event) {
  return JSON.stringify(canonicalize(event));
}
