import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWidgetApp,
  issueWidgetToken,
  verifyWidgetToken,
  isOriginAllowed,
  MemoryFeedbackStore,
  MemoryRateLimiter
} from '../packages/widget-api/src/index.mjs';

const secret = 'phase-2-widget-test-secret-32-characters';

async function token(options = {}) {
  return issueWidgetToken({
    secret,
    projectId: 'project_demo',
    origins: ['https://docs.example.com', 'https://*.preview.example.com'],
    expiresInSeconds: 3600,
    ...options
  });
}

function request(path, widgetToken, options = {}) {
  const { method = 'GET', origin = 'https://docs.example.com', body, headers = {} } = options;
  return new Request(`https://api.example.test${path}`, {
    method,
    headers: {
      origin,
      authorization: `Bearer ${widgetToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function app(options = {}) {
  return createWidgetApp({
    tokenSecret: secret,
    projectResolver: async (id) => id === 'project_demo' ? {
      id,
      name: 'Example Docs',
      active: true,
      widget: { title: 'Ask Example Docs', placeholder: 'Ask the docs', theme: 'auto' }
    } : null,
    answerService: async ({ question }) => ({
      traceId: 'run_widget_test',
      state: 'supported',
      answer: `Supported answer for ${question}`,
      assumptions: { version: 'current', runtime: 'all' },
      citations: [
        { label: 'Usage', url: 'https://docs.example.com/usage' },
        { label: 'unsafe', url: 'javascript:alert(1)' }
      ]
    }),
    ...options
  });
}

test('issues and verifies scoped widget tokens', async () => {
  const value = await token({ now: 1_000_000 });
  const verified = await verifyWidgetToken(value, { secret, now: 1_001_000 });
  assert.equal(verified.payload.sub, 'project_demo');
  assert.deepEqual(verified.payload.origins, ['https://docs.example.com', 'https://*.preview.example.com']);
});

test('rejects tampered and expired widget tokens', async () => {
  const value = await token({ now: 0, expiresInSeconds: 60 });
  const [header, payload, signature] = value.split('.');
  const replacement = payload[0] === 'A' ? 'B' : 'A';
  const tampered = `${header}.${replacement}${payload.slice(1)}.${signature}`;
  await assert.rejects(() => verifyWidgetToken(tampered, { secret, now: 1_000 }), /signature/i);
  await assert.rejects(() => verifyWidgetToken(value, { secret, now: 61_000 }), (error) => error.code === 'TOKEN_EXPIRED');
});

test('matches exact origins and wildcard subdomains without matching the apex', () => {
  const policy = ['https://docs.example.com', 'https://*.preview.example.com'];
  assert.equal(isOriginAllowed('https://docs.example.com', policy), true);
  assert.equal(isOriginAllowed('https://a.preview.example.com', policy), true);
  assert.equal(isOriginAllowed('https://deep.a.preview.example.com', policy), true);
  assert.equal(isOriginAllowed('https://preview.example.com', policy), false);
  assert.equal(isOriginAllowed('http://docs.example.com', policy), false);
});

test('returns public widget config only to an allowed origin', async () => {
  const response = await app()(request('/v1/widget/config', await token()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://docs.example.com');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.project.name, 'Example Docs');
  assert.equal(body.limits.questionCharacters, 1000);
});

test('blocks a valid token from an unapproved origin', async () => {
  const response = await app()(request('/v1/widget/config', await token(), { origin: 'https://evil.example' }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const body = await response.json();
  assert.equal(body.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('returns a bounded public answer and filters unsafe citation schemes', async () => {
  const response = await app()(request('/v1/widget/answer', await token(), {
    method: 'POST',
    body: { question: 'How do I start?', pageUrl: 'https://docs.example.com/start' }
  }), { clientKey: 'client-1' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.state, 'supported');
  assert.equal(body.traceId, 'run_widget_test');
  assert.equal(body.citations.length, 1);
  assert.equal(body.citations[0].url, 'https://docs.example.com/usage');
  assert.equal('retrieval' in body, false);
  assert.equal('claims' in body, false);
});

test('rejects oversized questions before calling the answer service', async () => {
  let calls = 0;
  const widgetApp = app({ answerService: async () => { calls += 1; return {}; } });
  const response = await widgetApp(request('/v1/widget/answer', await token(), {
    method: 'POST',
    body: { question: 'x'.repeat(1001) }
  }));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.equal((await response.json()).error.code, 'BAD_REQUEST');
});

test('rate limits by project, origin, and client key', async () => {
  const limiter = new MemoryRateLimiter({ limit: 1, windowMs: 60_000, now: () => 10_000 });
  const widgetApp = app({ rateLimiter: limiter });
  const widgetToken = await token();
  const make = () => request('/v1/widget/answer', widgetToken, { method: 'POST', body: { question: 'Hello' } });
  assert.equal((await widgetApp(make(), { clientKey: 'same-client' })).status, 200);
  const blocked = await widgetApp(make(), { clientKey: 'same-client' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  assert.equal((await widgetApp(make(), { clientKey: 'other-client' })).status, 200);
});

test('records bounded feedback idempotently', async () => {
  const store = new MemoryFeedbackStore({ now: () => 1_700_000_000_000 });
  const widgetApp = app({ feedbackStore: store });
  const widgetToken = await token();
  const payload = {
    eventId: '11111111-1111-4111-8111-111111111111',
    traceId: 'run_widget_test',
    rating: 'useful',
    reason: 'clear_answer'
  };
  const make = () => request('/v1/widget/feedback', widgetToken, { method: 'POST', body: payload });
  const first = await widgetApp(make(), { clientKey: 'client-1' });
  assert.equal(first.status, 202);
  assert.deepEqual(await first.json(), { accepted: true, duplicate: false });
  const second = await widgetApp(make(), { clientKey: 'client-1' });
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { accepted: true, duplicate: true });
  const entries = await store.list();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].projectId, 'project_demo');
  assert.equal(entries[0].origin, 'https://docs.example.com');
  assert.equal(entries[0].comment, null);
});

test('rejects invalid or unexpected free-text feedback', async () => {
  const response = await app()(request('/v1/widget/feedback', await token(), {
    method: 'POST',
    body: {
      eventId: '22222222-2222-4222-8222-222222222222',
      traceId: 'run_widget_test',
      rating: 'useful',
      reason: 'clear_answer',
      comment: 'Unexpected personal data'
    }
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'FEEDBACK_INVALID');
});

test('preflight returns no data and actual requests remain token and origin protected', async () => {
  const response = await app()(new Request('https://api.example.test/v1/widget/answer', {
    method: 'OPTIONS',
    headers: { origin: 'https://docs.example.com' }
  }));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://docs.example.com');
});
