import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  redactSensitiveText,
  fingerprintQuestion,
  normalizeLearningEvent,
  MemoryLearningEventStore,
  LearningEventConflictError
} from '../packages/learning/src/index.mjs';

const NOW = '2026-07-14T06:00:00.000Z';
const EVENT_ID = '018f6b5c-7f11-7d10-9f24-000000000001';

function event(overrides = {}) {
  return {
    eventId: EVENT_ID,
    projectId: 'project_alpha',
    type: 'answer.completed',
    source: 'answer',
    occurredAt: NOW,
    traceId: 'trace_1',
    answerState: 'supported',
    citationCount: 2,
    latencyMs: 125,
    question: 'How do I use the API?',
    metadata: { runtime: 'cloudflare' },
    ...overrides
  };
}

const normalizeOptions = {
  projectSalt: 'project-alpha-private-salt',
  receivedAt: NOW
};

test('redacts sensitive values before an excerpt can be persisted', () => {
  const input = 'Email me at dev@example.com from 192.168.1.9 using Bearer abcdefghijklmnopqrstuvwxyz123456 and https://docs.example.com/path?token=secret#private';
  const result = redactSensitiveText(input, { maxCharacters: 500 });
  assert.match(result.text, /\[email\]/);
  assert.match(result.text, /\[ip\]/);
  assert.match(result.text, /Bearer \[token\]/);
  assert.equal(result.text.includes('dev@example.com'), false);
  assert.equal(result.text.includes('192.168.1.9'), false);
  assert.equal(result.text.includes('token=secret'), false);
  assert.equal(result.text.includes('#private'), false);
  assert.ok(result.redactionCount >= 4);
});

test('question fingerprints are stable inside a project and unlinkable across project salts', async () => {
  const first = await fingerprintQuestion({ projectSalt: 'project-alpha-salt', question: '  How   do I start? ' });
  const same = await fingerprintQuestion({ projectSalt: 'project-alpha-salt', question: 'How do I start?' });
  const other = await fingerprintQuestion({ projectSalt: 'project-beta-salt', question: 'How do I start?' });
  assert.equal(first.fingerprint, same.fingerprint);
  assert.notEqual(first.fingerprint, other.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
});

test('normalizes an event without retaining raw question or forbidden metadata', async () => {
  const normalized = await normalizeLearningEvent(event({
    question: 'My email is operator@example.com. Why is the API failing?',
    metadata: {
      runtime: 'workers',
      question: 'raw question must not persist',
      authorization: 'Bearer secretsecretsecretsecretsecret',
      note: 'contact operator@example.com'
    }
  }), normalizeOptions);

  assert.equal(Object.hasOwn(normalized, 'question'), false);
  assert.match(normalized.questionFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(normalized.questionExcerpt.includes('operator@example.com'), false);
  assert.equal(Object.hasOwn(normalized.metadata, 'question'), false);
  assert.equal(Object.hasOwn(normalized.metadata, 'authorization'), false);
  assert.equal(normalized.metadata.note.includes('operator@example.com'), false);
  assert.equal(normalized.metadata.note.includes('[email]'), true);
});

test('accepts exact replay once and rejects conflicting reuse of an event id', async () => {
  const store = new MemoryLearningEventStore();
  const first = await store.ingest(event(), normalizeOptions);
  const duplicate = await store.ingest(event(), normalizeOptions);
  assert.equal(first.accepted, true);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(store.count('project_alpha'), 1);

  await assert.rejects(
    () => store.ingest(event({ citationCount: 3 }), normalizeOptions),
    (error) => error instanceof LearningEventConflictError && error.code === 'LEARNING_EVENT_CONFLICT'
  );
});

test('event ids and fingerprints never grant cross-project reads', async () => {
  const store = new MemoryLearningEventStore();
  await store.ingest(event(), normalizeOptions);
  await store.ingest(event({ projectId: 'project_beta' }), {
    projectSalt: 'project-beta-private-salt',
    receivedAt: NOW
  });
  assert.equal(store.count('project_alpha'), 1);
  assert.equal(store.count('project_beta'), 1);
  assert.equal(store.get('project_alpha', EVENT_ID).projectId, 'project_alpha');
  assert.equal(store.get('project_beta', EVENT_ID).projectId, 'project_beta');
  assert.notEqual(
    store.get('project_alpha', EVENT_ID).questionFingerprint,
    store.get('project_beta', EVENT_ID).questionFingerprint
  );
  assert.deepEqual(store.list('missing_project'), []);
});

test('rejects malformed event identifiers and oversized project fields', async () => {
  await assert.rejects(() => normalizeLearningEvent(event({ eventId: 'not-a-uuid' }), normalizeOptions), /UUID/);
  await assert.rejects(() => normalizeLearningEvent(event({ projectId: 'x'.repeat(129) }), normalizeOptions), /projectId/);
});

test('migration is append-only, project-scoped, and RLS protected', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260714060000_phase3_learning_events.sql', import.meta.url), 'utf8');
  assert.match(sql, /primary key \(project_id, event_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /owns_project\(project_id\)/i);
  assert.match(sql, /revoke update, delete/i);
});
