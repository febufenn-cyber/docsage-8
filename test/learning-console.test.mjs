import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import {
  MemoryLearningEventStore,
  LearningProjectionStore,
  createLearningConsoleApp
} from '../packages/learning/src/index.mjs';
import { normalizeConsoleEndpoint, normalizeSummary, normalizeCollection } from '../apps/console/src/contracts.mjs';

const receivedAt = '2026-07-14T08:30:00.000Z';

async function runtime() {
  const eventStore = new MemoryLearningEventStore();
  const base = {
    eventId: '018f6b5c-7f11-7d10-9f24-000000000101',
    projectId: 'project_alpha',
    type: 'answer.refused',
    source: 'answer',
    occurredAt: '2026-07-14T08:00:00.000Z',
    traceId: 'trace_alpha',
    answerState: 'not_found',
    question: '<img src=x onerror=alert(1)> undocumented API?',
    metadata: { runtime: 'workers' }
  };
  await eventStore.ingest(base, { projectSalt: 'alpha-project-salt', receivedAt });
  await eventStore.ingest({
    ...base,
    eventId: '018f6b5c-7f11-7d10-9f24-000000000102',
    type: 'feedback.recorded',
    source: 'feedback',
    feedbackRating: 'not_useful',
    feedbackReason: 'missing_detail'
  }, { projectSalt: 'alpha-project-salt', receivedAt });
  await eventStore.ingest({
    ...base,
    eventId: '018f6b5c-7f11-7d10-9f24-000000000201',
    projectId: 'project_beta',
    traceId: 'trace_beta',
    answerState: 'supported',
    type: 'answer.completed',
    question: 'Private beta question'
  }, { projectSalt: 'beta-project-salt', receivedAt });

  const projectionStore = new LearningProjectionStore();
  projectionStore.rebuild(eventStore.list('project_alpha'), 'project_alpha');
  projectionStore.rebuild(eventStore.list('project_beta'), 'project_beta');

  const app = createLearningConsoleApp({
    eventStore,
    projectionStore,
    authorize: async ({ request, projectId }) => request.headers.get('x-operator') === `${projectId}:owner`
  });
  return { app, eventStore, projectionStore };
}

function request(projectId, resource, operator = `${projectId}:owner`) {
  return new Request(`https://console.example.test/v1/learning/projects/${projectId}/${resource}`, {
    headers: { 'x-operator': operator }
  });
}

test('returns project-scoped summary and safe events to an authorized operator', async () => {
  const { app } = await runtime();
  const summaryResponse = await app(request('project_alpha', 'summary'));
  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.headers.get('cache-control'), 'no-store');
  const summary = await summaryResponse.json();
  assert.equal(summary.projectId, 'project_alpha');
  assert.equal(summary.eventCount, 2);

  const eventResponse = await app(request('project_alpha', 'events?limit=10'));
  const events = await eventResponse.json();
  assert.equal(events.total, 2);
  assert.equal('metadata' in events.items[0], false);
  assert.equal('questionFingerprint' in events.items[0], false);
  assert.match(events.items[0].questionExcerpt, /<img/);
});

test('denies cross-project access before reading a projection', async () => {
  const { app } = await runtime();
  const response = await app(request('project_beta', 'summary', 'project_alpha:owner'));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');
});

test('bounds pagination and rejects unsupported filters', async () => {
  const { app } = await runtime();
  assert.equal((await app(request('project_alpha', 'clusters?limit=101'))).status, 400);
  assert.equal((await app(request('project_alpha', 'events?type=raw.prompt'))).status, 400);
  const response = await app(request('project_alpha', 'clusters?limit=1&offset=0&actionable=true'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].actionable, true);
});

test('normalizes browser API contracts and rejects credential-bearing endpoints', () => {
  assert.equal(normalizeConsoleEndpoint('https://console.example.com/'), 'https://console.example.com');
  assert.throws(() => normalizeConsoleEndpoint('https://user:pass@example.com'), /without credentials/);
  assert.equal(normalizeSummary({ projectId: 'p', eventCount: 2, actionableCount: 1 }).eventCount, 2);
  assert.equal(normalizeCollection({ projectId: 'p', total: 1, items: [{}] }, 'events').items.length, 1);
});

test('console uses Shadow DOM, text rendering, accessible controls, and stays within budget', async () => {
  const source = await readFile(new URL('../apps/console/src/docsage-learning-console.mjs', import.meta.url), 'utf8');
  assert.match(source, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(source, /textContent/);
  assert.match(source, /role: 'tablist'/);
  assert.match(source, /role: 'tabpanel'/);
  assert.match(source, /aria-live/);
  assert.match(source, /credentials: 'same-origin'/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\b/);
  assert.doesNotMatch(source, /on(?:click|load|error)\s*=/i);
  assert.ok(gzipSync(source).byteLength <= 60 * 1024, `console gzip size exceeded: ${gzipSync(source).byteLength}`);
});
