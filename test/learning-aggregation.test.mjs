import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeLearningEvent,
  classifyLearningEvent,
  buildLearningSnapshot,
  reconcileLearningSnapshot,
  canonicalLearningSnapshot,
  LearningProjectionStore
} from '../packages/learning/src/index.mjs';

const projectId = 'project_alpha';
const salt = 'project-alpha-private-salt';
const receivedAt = '2026-07-14T07:30:00.000Z';

async function normalized(overrides) {
  return normalizeLearningEvent({
    eventId: '018f6b5c-7f11-7d10-9f24-000000000001',
    projectId,
    type: 'answer.completed',
    source: 'answer',
    occurredAt: '2026-07-12T10:00:00.000Z',
    traceId: 'trace_default',
    answerState: 'supported',
    citationCount: 2,
    question: 'How do I start?',
    metadata: {},
    ...overrides
  }, { projectSalt: salt, receivedAt });
}

async function fixtureEvents() {
  return Promise.all([
    normalized({
      eventId: '018f6b5c-7f11-7d10-9f24-000000000001',
      occurredAt: '2026-07-12T10:00:00.000Z',
      traceId: 'trace_1',
      answerState: 'supported',
      question: 'How do I start?'
    }),
    normalized({
      eventId: '018f6b5c-7f11-7d10-9f24-000000000002',
      occurredAt: '2026-07-12T11:00:00.000Z',
      traceId: 'trace_2',
      type: 'answer.refused',
      answerState: 'not_found',
      question: 'How do I configure undocumented mode?'
    }),
    normalized({
      eventId: '018f6b5c-7f11-7d10-9f24-000000000003',
      occurredAt: '2026-07-12T11:05:00.000Z',
      traceId: 'trace_2',
      type: 'feedback.recorded',
      source: 'feedback',
      answerState: 'not_found',
      feedbackRating: 'not_useful',
      feedbackReason: 'missing_detail',
      question: 'How do I configure undocumented mode?'
    }),
    normalized({
      eventId: '018f6b5c-7f11-7d10-9f24-000000000004',
      occurredAt: '2026-07-13T08:00:00.000Z',
      type: 'source.health',
      source: 'ingestion',
      answerState: null,
      question: null,
      sourceStatus: 'degraded',
      failureCode: 'STALE_REVISION',
      metadata: { source_id: 'source_docs' }
    }),
    normalized({
      eventId: '018f6b5c-7f11-7d10-9f24-000000000005',
      occurredAt: '2026-07-13T09:00:00.000Z',
      type: 'source.health',
      source: 'ingestion',
      answerState: null,
      question: null,
      sourceStatus: 'healthy',
      metadata: { source_id: 'source_docs' }
    }),
    normalized({
      eventId: '018f6b5c-7f11-7d10-9f24-000000000006',
      occurredAt: '2026-07-13T10:00:00.000Z',
      type: 'evaluation.failed',
      source: 'evaluation',
      answerState: null,
      question: null,
      failureCode: 'CITATION_ENTAILMENT',
      metadata: { case_id: 'case_9' }
    })
  ]);
}

test('classifies supported, documentation-gap, feedback, source, and evaluation outcomes', async () => {
  const events = await fixtureEvents();
  assert.equal(classifyLearningEvent(events[0]).category, 'supported');
  assert.equal(classifyLearningEvent(events[1]).category, 'documentation_gap');
  assert.equal(classifyLearningEvent(events[2]).category, 'negative_feedback');
  assert.equal(classifyLearningEvent(events[3]).category, 'source_degraded');
  assert.equal(classifyLearningEvent(events[5]).category, 'evaluation_CITATION_ENTAILMENT');
});

test('builds exact daily metrics, clusters, feedback, and latest source health', async () => {
  const snapshot = buildLearningSnapshot(await fixtureEvents(), projectId);
  assert.equal(snapshot.eventCount, 6);
  assert.equal(snapshot.daily.length, 2);
  assert.equal(snapshot.totals.byType['source.health'], 2);
  assert.equal(snapshot.totals.feedback.not_useful, 1);
  assert.equal(snapshot.totals.byCategory.documentation_gap, 1);
  assert.equal(snapshot.sourceHealth.length, 1);
  assert.equal(snapshot.sourceHealth[0].status, 'healthy');
  assert.equal(snapshot.sourceHealth[0].eventId.endsWith('0005'), true);
  assert.equal(reconcileLearningSnapshot(snapshot).valid, true);
});

test('projection output is independent of event input order and rebuilds byte-equivalently', async () => {
  const events = await fixtureEvents();
  const forward = buildLearningSnapshot(events, projectId);
  const reverse = buildLearningSnapshot([...events].reverse(), projectId);
  assert.equal(canonicalLearningSnapshot(forward), canonicalLearningSnapshot(reverse));

  const projections = new LearningProjectionStore();
  const first = projections.rebuild(events, projectId);
  const second = projections.rebuild([...events].reverse(), projectId);
  assert.equal(first.reconciliation.valid, true);
  assert.equal(second.unchanged, true);
  assert.equal(first.canonical, second.canonical);
});

test('aggregation refuses mixed-project input rather than leaking cross-project events', async () => {
  const events = await fixtureEvents();
  const foreign = { ...events[0], projectId: 'project_beta' };
  assert.throws(() => buildLearningSnapshot([...events, foreign], projectId), /cross-project/);
});

test('projection migration remains project-scoped, rebuildable, and RLS protected', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260714070000_phase3_learning_projections.sql', import.meta.url), 'utf8');
  assert.match(sql, /learning_daily_metrics/i);
  assert.match(sql, /learning_clusters/i);
  assert.match(sql, /learning_source_health/i);
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /owns_project\(project_id\)/i);
  assert.match(sql, /Rebuildable projection/i);
});
