import { assertOriginAllowed, normalizeOrigin, OriginPolicyError } from './origin.mjs';
import { readBearerToken, verifyWidgetToken, WidgetTokenError } from './token.mjs';
import { MemoryRateLimiter, rateLimitHeaders } from './rate-limit.mjs';
import { MemoryFeedbackStore, validateFeedback } from './feedback.mjs';

const PUBLIC_STATES = new Set([
  'supported', 'partially_supported', 'conflicting_sources', 'version_ambiguous',
  'runtime_ambiguous', 'not_found', 'account_specific', 'out_of_scope', 'unsafe_or_untrusted'
]);
const MAX_ANSWER_CHARS = 20_000;

function requestId() {
  return `req_${crypto.randomUUID()}`;
}

function baseHeaders(origin = null, extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    ...(origin ? {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'vary': 'Origin'
    } : {}),
    ...extra
  };
}

function json(payload, status, id, origin = null, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: baseHeaders(origin, { 'x-docsage-request-id': id, ...extra })
  });
}

function errorResponse(code, message, status, id, origin = null, retryable = false, extra = {}) {
  return json({ error: { code, message, requestId: id, retryable } }, status, id, origin, extra);
}

function publicError(error) {
  if (error instanceof WidgetTokenError) {
    if (error.code === 'TOKEN_REQUIRED') return [error.code, error.message, 401, false];
    if (error.code === 'TOKEN_EXPIRED') return [error.code, error.message, 401, false];
    if (error.code === 'TOKEN_INVALID') return [error.code, error.message, 401, false];
  }
  if (error instanceof OriginPolicyError) {
    if (error.code === 'ORIGIN_REQUIRED') return [error.code, error.message, 400, false];
    if (error.code === 'ORIGIN_NOT_ALLOWED') return [error.code, error.message, 403, false];
    return ['BAD_REQUEST', 'The request origin is invalid.', 400, false];
  }
  if (error?.code === 'BAD_REQUEST') return ['BAD_REQUEST', error.message, 400, false];
  if (error?.code === 'FEEDBACK_INVALID') return ['FEEDBACK_INVALID', error.message, 400, false];
  if (error?.code === 'ANSWER_UNAVAILABLE') return ['ANSWER_UNAVAILABLE', 'The documentation answer is temporarily unavailable.', 503, true];
  return ['INTERNAL_ERROR', 'The request could not be completed.', 500, true];
}

async function readJsonBody(request, maxBytes) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Content-Type must be application/json.'), { code: 'BAD_REQUEST' });
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw Object.assign(new Error('The request body is too large.'), { code: 'BAD_REQUEST' });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw Object.assign(new Error('The request body is too large.'), { code: 'BAD_REQUEST' });
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw Object.assign(new Error('The request body is not valid JSON.'), { code: 'BAD_REQUEST' });
  }
}

function validatePageUrl(value, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw Object.assign(new Error('pageUrl is invalid.'), { code: 'BAD_REQUEST' });
  }
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error('pageUrl is invalid.'), { code: 'BAD_REQUEST' }); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw Object.assign(new Error('pageUrl is invalid.'), { code: 'BAD_REQUEST' });
  }
  return url.href;
}

function validateQuestion(value, maxCharacters) {
  if (typeof value !== 'string') throw Object.assign(new Error('question is required.'), { code: 'BAD_REQUEST' });
  const question = value.trim();
  const length = Array.from(question).length;
  if (!length || length > maxCharacters) {
    throw Object.assign(new Error(`question must contain between 1 and ${maxCharacters} characters.`), { code: 'BAD_REQUEST' });
  }
  return question;
}

function clientKey(context) {
  return typeof context.clientKey === 'string' && context.clientKey
    ? context.clientKey.slice(0, 200)
    : 'anonymous';
}

function safeCitation(item) {
  if (!item || typeof item !== 'object') return null;
  let url;
  try { url = new URL(item.url); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const label = typeof item.label === 'string' && item.label.trim()
    ? item.label.trim().slice(0, 300)
    : url.hostname;
  return { label, url: url.href };
}

function sanitizeAnswer(result, id) {
  if (!result || typeof result !== 'object' || !PUBLIC_STATES.has(result.state)) {
    throw Object.assign(new Error('Answer service returned an invalid state.'), { code: 'ANSWER_UNAVAILABLE' });
  }
  const answer = typeof result.answer === 'string' ? result.answer.slice(0, MAX_ANSWER_CHARS) : '';
  const citations = Array.isArray(result.citations)
    ? result.citations.map((item) => safeCitation({
      label: item.label ?? [item.title, item.anchor].filter(Boolean).join(' > '),
      url: item.url
    })).filter(Boolean).slice(0, 8)
    : [];
  return {
    requestId: id,
    traceId: typeof result.traceId === 'string' ? result.traceId.slice(0, 200) : null,
    state: result.state,
    answer,
    assumptions: {
      version: typeof result.assumptions?.version === 'string' ? result.assumptions.version.slice(0, 100) : 'current',
      runtime: typeof result.assumptions?.runtime === 'string' ? result.assumptions.runtime.slice(0, 100) : 'all'
    },
    citations
  };
}

export function createWidgetApp(options) {
  const {
    tokenSecret,
    projectResolver,
    answerService,
    rateLimiter = new MemoryRateLimiter(),
    feedbackRateLimiter = new MemoryRateLimiter({ limit: 60, windowMs: 300_000 }),
    feedbackStore = new MemoryFeedbackStore(),
    limits = {}
  } = options ?? {};
  if (typeof projectResolver !== 'function') throw new TypeError('projectResolver is required');
  if (typeof answerService !== 'function') throw new TypeError('answerService is required');
  if (!feedbackStore || typeof feedbackStore.record !== 'function') throw new TypeError('feedbackStore.record is required');
  const maxBodyBytes = limits.maxBodyBytes ?? 8192;
  const maxQuestionCharacters = limits.maxQuestionCharacters ?? 1000;
  const maxPageUrlCharacters = limits.maxPageUrlCharacters ?? 2048;
  const maxFeedbackCommentCharacters = limits.maxFeedbackCommentCharacters ?? 500;
  const allowFeedbackComment = limits.allowFeedbackComment === true;

  return async function handleWidgetRequest(request, context = {}) {
    const id = requestId();
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/v1/widget/')) {
      return errorResponse('NOT_FOUND', 'The requested endpoint does not exist.', 404, id);
    }

    if (request.method === 'OPTIONS') {
      // Preflight grants no data. The actual request always verifies the signed token and origin.
      try {
        const origin = normalizeOrigin(request.headers.get('origin'));
        return new Response(null, {
          status: 204,
          headers: baseHeaders(origin, {
            'access-control-max-age': '300',
            'x-docsage-request-id': id
          })
        });
      } catch (error) {
        const [code, message, status, retryable] = publicError(error);
        return errorResponse(code, message, status, id, null, retryable);
      }
    }

    let origin = null;
    try {
      const token = readBearerToken(request);
      const verified = await verifyWidgetToken(token, { secret: tokenSecret });
      origin = assertOriginAllowed(request.headers.get('origin'), verified.payload.origins);
      const project = await projectResolver(verified.payload.sub);
      if (!project || project.id !== verified.payload.sub || project.active === false) {
        return errorResponse('TOKEN_INVALID', 'The widget token project is unavailable.', 401, id, origin);
      }

      if (request.method === 'GET' && url.pathname === '/v1/widget/config') {
        return json({
          project: { id: project.id, name: String(project.name ?? project.id).slice(0, 200) },
          widget: {
            title: String(project.widget?.title ?? `Ask ${project.name ?? 'the docs'}`).slice(0, 200),
            placeholder: String(project.widget?.placeholder ?? 'Ask a documentation question…').slice(0, 300),
            theme: ['light', 'dark', 'auto'].includes(project.widget?.theme) ? project.widget.theme : 'auto'
          },
          limits: { questionCharacters: maxQuestionCharacters }
        }, 200, id, origin);
      }

      if (request.method === 'POST' && url.pathname === '/v1/widget/answer') {
        const body = await readJsonBody(request, maxBodyBytes);
        const question = validateQuestion(body?.question, maxQuestionCharacters);
        const pageUrl = validatePageUrl(body?.pageUrl, maxPageUrlCharacters);
        const limitResult = await rateLimiter.consume(`${project.id}|${origin}|${clientKey(context)}|answer`);
        if (!limitResult.allowed) {
          return errorResponse(
            'RATE_LIMITED',
            'Too many questions were submitted. Try again later.',
            429,
            id,
            origin,
            true,
            rateLimitHeaders(limitResult)
          );
        }
        let answer;
        try {
          answer = await answerService({
            question,
            pageUrl,
            projectId: project.id,
            requestId: id,
            tokenId: verified.payload.jti
          });
        } catch (cause) {
          throw Object.assign(new Error('Answer service failed.', { cause }), { code: 'ANSWER_UNAVAILABLE' });
        }
        return json(sanitizeAnswer(answer, id), 200, id, origin, rateLimitHeaders(limitResult));
      }

      if (request.method === 'POST' && url.pathname === '/v1/widget/feedback') {
        const body = await readJsonBody(request, maxBodyBytes);
        const feedback = validateFeedback(body, {
          allowComment: allowFeedbackComment,
          maxCommentCharacters: maxFeedbackCommentCharacters
        });
        const limitResult = await feedbackRateLimiter.consume(`${project.id}|${origin}|${clientKey(context)}|feedback`);
        if (!limitResult.allowed) {
          return errorResponse(
            'RATE_LIMITED',
            'Too much feedback was submitted. Try again later.',
            429,
            id,
            origin,
            true,
            rateLimitHeaders(limitResult)
          );
        }
        const recorded = await feedbackStore.record({
          ...feedback,
          projectId: project.id,
          origin,
          tokenId: verified.payload.jti
        });
        return json(
          { accepted: recorded.accepted === true, duplicate: recorded.duplicate === true },
          recorded.duplicate ? 200 : 202,
          id,
          origin,
          rateLimitHeaders(limitResult)
        );
      }

      return errorResponse('NOT_FOUND', 'The requested endpoint does not exist.', 404, id, origin);
    } catch (error) {
      const [code, message, status, retryable] = publicError(error);
      return errorResponse(code, message, status, id, origin, retryable);
    }
  };
}
