const PROJECT_PATH = /^\/v1\/learning\/projects\/([^/]+)\/(summary|clusters|events|source-health)$/;
const SAFE_EVENT_TYPES = new Set([
  'answer.completed', 'answer.refused', 'feedback.recorded', 'source.health', 'evaluation.failed'
]);

function headers(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    ...extra
  };
}

function json(payload, status = 200, extra = {}) {
  return new Response(JSON.stringify(payload), { status, headers: headers(extra) });
}

function error(code, message, status) {
  return json({ error: { code, message } }, status);
}

function integerParam(url, name, fallback, min, max) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw Object.assign(new Error(`${name} must be an integer`), { code: 'BAD_REQUEST' });
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw Object.assign(new Error(`${name} must be between ${min} and ${max}`), { code: 'BAD_REQUEST' });
  }
  return value;
}

function timestampParam(url, name) {
  const raw = url.searchParams.get(name);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw Object.assign(new Error(`${name} is invalid`), { code: 'BAD_REQUEST' });
  return date.toISOString();
}

function publicEvent(event) {
  return {
    eventId: event.eventId,
    type: event.type,
    source: event.source,
    occurredAt: event.occurredAt,
    traceId: event.traceId,
    answerState: event.answerState,
    feedbackRating: event.feedbackRating,
    feedbackReason: event.feedbackReason,
    sourceStatus: event.sourceStatus,
    failureCode: event.failureCode,
    citationCount: event.citationCount,
    latencyMs: event.latencyMs,
    questionExcerpt: event.questionExcerpt,
    redactionCount: event.redactionCount
  };
}

function publicCluster(cluster) {
  return {
    key: cluster.key,
    category: cluster.category,
    severity: cluster.severity,
    actionable: cluster.actionable,
    count: cluster.count,
    negativeFeedbackCount: cluster.negativeFeedbackCount,
    firstSeenAt: cluster.firstSeenAt,
    latestSeenAt: cluster.latestSeenAt,
    questionExcerpt: cluster.questionExcerpt,
    answerStates: cluster.answerStates,
    eventTypes: cluster.eventTypes,
    failureCodes: cluster.failureCodes
  };
}

export function createLearningConsoleApp(options = {}) {
  const { authorize, eventStore, projectionStore } = options;
  if (typeof authorize !== 'function') throw new TypeError('authorize is required');
  if (!eventStore?.list) throw new TypeError('eventStore is required');
  if (!projectionStore?.get) throw new TypeError('projectionStore is required');

  return async function handleLearningRequest(request) {
    if (request.method !== 'GET') return error('METHOD_NOT_ALLOWED', 'Only GET is supported.', 405);
    const url = new URL(request.url);
    const match = PROJECT_PATH.exec(url.pathname);
    if (!match) return error('NOT_FOUND', 'The requested endpoint does not exist.', 404);
    const projectId = decodeURIComponent(match[1]);
    if (!projectId || projectId.length > 128) return error('BAD_REQUEST', 'projectId is invalid.', 400);

    let allowed = false;
    try {
      allowed = await authorize({ request, projectId });
    } catch {
      return error('FORBIDDEN', 'Access to this project is denied.', 403);
    }
    if (allowed !== true) return error('FORBIDDEN', 'Access to this project is denied.', 403);

    try {
      const resource = match[2];
      const snapshot = projectionStore.get(projectId);
      if (!snapshot) return error('NOT_FOUND', 'No learning projection exists for this project.', 404);

      if (resource === 'summary') {
        return json({
          projectId,
          eventCount: snapshot.eventCount,
          actionableCount: snapshot.actionableCount,
          redactionCount: snapshot.redactionCount,
          range: snapshot.range,
          totals: snapshot.totals,
          daily: snapshot.daily
        });
      }

      const limit = integerParam(url, 'limit', 25, 1, 100);
      const offset = integerParam(url, 'offset', 0, 0, 10_000);

      if (resource === 'clusters') {
        const severity = url.searchParams.get('severity');
        const actionable = url.searchParams.get('actionable');
        if (severity && !['info', 'low', 'medium', 'high', 'critical'].includes(severity)) {
          throw Object.assign(new Error('severity is invalid'), { code: 'BAD_REQUEST' });
        }
        if (actionable && !['true', 'false'].includes(actionable)) {
          throw Object.assign(new Error('actionable is invalid'), { code: 'BAD_REQUEST' });
        }
        const filtered = snapshot.clusters.filter((cluster) =>
          (!severity || cluster.severity === severity)
          && (!actionable || cluster.actionable === (actionable === 'true'))
        );
        return json({ projectId, total: filtered.length, items: filtered.slice(offset, offset + limit).map(publicCluster) });
      }

      if (resource === 'events') {
        const type = url.searchParams.get('type');
        if (type && !SAFE_EVENT_TYPES.has(type)) throw Object.assign(new Error('type is invalid'), { code: 'BAD_REQUEST' });
        const since = timestampParam(url, 'since');
        const until = timestampParam(url, 'until');
        const events = eventStore.list(projectId, { type, since, until, limit: 5000 });
        return json({ projectId, total: events.length, items: events.slice(offset, offset + limit).map(publicEvent) });
      }

      return json({ projectId, total: snapshot.sourceHealth.length, items: snapshot.sourceHealth.slice(offset, offset + limit) });
    } catch (cause) {
      if (cause?.code === 'BAD_REQUEST') return error('BAD_REQUEST', cause.message, 400);
      return error('INTERNAL_ERROR', 'The learning request could not be completed.', 500);
    }
  };
}
