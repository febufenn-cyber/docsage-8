const STATES = new Set([
  'supported', 'partially_supported', 'conflicting_sources', 'version_ambiguous',
  'runtime_ambiguous', 'not_found', 'account_specific', 'out_of_scope', 'unsafe_or_untrusted'
]);
const FEEDBACK_RATINGS = new Set(['useful', 'not_useful']);
const FEEDBACK_REASONS = new Set(['clear_answer', 'incomplete', 'incorrect', 'missing_source', 'outdated', 'other']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const STATE_LABELS = Object.freeze({
  supported: 'Supported by the documentation',
  partially_supported: 'Partially supported',
  conflicting_sources: 'Sources conflict',
  version_ambiguous: 'Version needs clarification',
  runtime_ambiguous: 'Runtime needs clarification',
  not_found: 'Not found in the documentation',
  account_specific: 'Needs account or deployment data',
  out_of_scope: 'Outside documentation scope',
  unsafe_or_untrusted: 'Request blocked for safety'
});

function boundedString(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

export function normalizeEndpoint(value, base = 'https://invalid.local') {
  let url;
  try { url = new URL(value, base); } catch { throw new TypeError('Widget endpoint is invalid'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('Widget endpoint must use HTTP or HTTPS without credentials');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeWidgetConfig(input = {}) {
  const project = input.project ?? {};
  const widget = input.widget ?? {};
  const limit = Number(input.limits?.questionCharacters);
  return {
    project: {
      id: boundedString(project.id, '', 128),
      name: boundedString(project.name, 'Documentation', 200)
    },
    title: boundedString(widget.title, `Ask ${boundedString(project.name, 'the docs', 120)}`, 200),
    placeholder: boundedString(widget.placeholder, 'Ask a documentation question…', 300),
    theme: ['light', 'dark', 'auto'].includes(widget.theme) ? widget.theme : 'auto',
    questionCharacters: Number.isInteger(limit) && limit > 0 && limit <= 5000 ? limit : 1000
  };
}

export function normalizeAnswerPayload(input) {
  if (!input || typeof input !== 'object' || !STATES.has(input.state)) {
    throw new TypeError('Answer response is invalid');
  }
  const citations = Array.isArray(input.citations)
    ? input.citations.map((item) => {
      const url = safeExternalUrl(item?.url);
      if (!url) return null;
      return {
        label: boundedString(item?.label, new URL(url).hostname, 300),
        url
      };
    }).filter(Boolean).slice(0, 8)
    : [];
  return {
    requestId: boundedString(input.requestId, '', 200),
    traceId: boundedString(input.traceId, '', 200),
    state: input.state,
    stateLabel: STATE_LABELS[input.state],
    answer: typeof input.answer === 'string' ? input.answer.slice(0, 20_000) : '',
    assumptions: {
      version: boundedString(input.assumptions?.version, 'current', 100),
      runtime: boundedString(input.assumptions?.runtime, 'all', 100)
    },
    citations
  };
}

export function normalizePublicError(input) {
  const error = input?.error ?? {};
  return {
    code: boundedString(error.code, 'INTERNAL_ERROR', 100),
    message: boundedString(error.message, 'The request could not be completed.', 500),
    requestId: boundedString(error.requestId, '', 200),
    retryable: error.retryable === true
  };
}

export function buildAnswerRequest(question, pageUrl, maxCharacters = 1000) {
  if (typeof question !== 'string') throw new TypeError('Question is required');
  const normalized = question.trim();
  const length = Array.from(normalized).length;
  if (!length || length > maxCharacters) {
    throw new RangeError(`Question must contain between 1 and ${maxCharacters} characters`);
  }
  const payload = { question: normalized };
  const url = safeExternalUrl(pageUrl);
  if (url) payload.pageUrl = url;
  return payload;
}

export function buildFeedbackRequest(options = {}) {
  const {
    eventId = crypto.randomUUID(),
    traceId,
    rating,
    reason = rating === 'useful' ? 'clear_answer' : 'incomplete'
  } = options;
  if (typeof eventId !== 'string' || !UUID.test(eventId)) throw new TypeError('Feedback event ID is invalid');
  if (typeof traceId !== 'string' || !traceId.trim() || traceId.length > 200) throw new TypeError('Feedback trace ID is invalid');
  if (!FEEDBACK_RATINGS.has(rating)) throw new TypeError('Feedback rating is invalid');
  if (!FEEDBACK_REASONS.has(reason)) throw new TypeError('Feedback reason is invalid');
  return { eventId: eventId.toLowerCase(), traceId: traceId.trim(), rating, reason };
}

export function normalizeFeedbackResponse(input) {
  if (!input || typeof input !== 'object' || input.accepted !== true) {
    throw new TypeError('Feedback response is invalid');
  }
  return { accepted: true, duplicate: input.duplicate === true };
}
