import { classifyLearningEvent, learningClusterKey } from './classify.mjs';

function increment(record, key, amount = 1) {
  if (!key) return;
  record[key] = (record[key] ?? 0) + amount;
}

function sortedObject(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
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

export function canonicalLearningSnapshot(snapshot) {
  return JSON.stringify(canonicalize(snapshot));
}

function requireProjectEvents(events, projectId) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (typeof projectId !== 'string' || !projectId.trim()) throw new TypeError('projectId is required');
  for (const event of events) {
    if (event.projectId !== projectId) throw new Error('cross-project event detected during aggregation');
  }
  return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId));
}

export function buildLearningSnapshot(events, projectId) {
  const ordered = requireProjectEvents(events, projectId);
  const byType = {};
  const byCategory = {};
  const byAnswerState = {};
  const daily = new Map();
  const clusters = new Map();
  const sourceHealth = new Map();
  const feedback = { useful: 0, not_useful: 0 };
  let actionableCount = 0;
  let redactionCount = 0;

  for (const event of ordered) {
    const classification = classifyLearningEvent(event);
    const day = event.occurredAt.slice(0, 10);
    increment(byType, event.type);
    increment(byCategory, classification.category);
    increment(byAnswerState, event.answerState);
    if (classification.actionable) actionableCount += 1;
    redactionCount += event.redactionCount ?? 0;
    if (event.feedbackRating) increment(feedback, event.feedbackRating);

    let dayRow = daily.get(day);
    if (!dayRow) {
      dayRow = { day, total: 0, actionable: 0, byType: {}, byCategory: {}, feedback: { useful: 0, not_useful: 0 } };
      daily.set(day, dayRow);
    }
    dayRow.total += 1;
    if (classification.actionable) dayRow.actionable += 1;
    increment(dayRow.byType, event.type);
    increment(dayRow.byCategory, classification.category);
    if (event.feedbackRating) increment(dayRow.feedback, event.feedbackRating);

    const key = learningClusterKey(event, classification);
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        key,
        category: classification.category,
        severity: classification.severity,
        actionable: classification.actionable,
        count: 0,
        negativeFeedbackCount: 0,
        firstSeenAt: event.occurredAt,
        latestSeenAt: event.occurredAt,
        questionFingerprint: event.questionFingerprint,
        questionExcerpt: event.questionExcerpt,
        answerStates: {},
        eventTypes: {},
        failureCodes: {}
      };
      clusters.set(key, cluster);
    }
    cluster.count += 1;
    cluster.negativeFeedbackCount += event.feedbackRating === 'not_useful' ? 1 : 0;
    if (event.occurredAt < cluster.firstSeenAt) cluster.firstSeenAt = event.occurredAt;
    if (event.occurredAt > cluster.latestSeenAt) cluster.latestSeenAt = event.occurredAt;
    if (!cluster.questionExcerpt && event.questionExcerpt) cluster.questionExcerpt = event.questionExcerpt;
    increment(cluster.answerStates, event.answerState);
    increment(cluster.eventTypes, event.type);
    increment(cluster.failureCodes, event.failureCode);

    if (event.type === 'source.health') {
      const sourceId = event.metadata?.source_id || event.metadata?.source_key || event.traceId || 'unknown';
      const existing = sourceHealth.get(sourceId);
      if (!existing || event.occurredAt > existing.occurredAt || (event.occurredAt === existing.occurredAt && event.eventId > existing.eventId)) {
        sourceHealth.set(sourceId, {
          sourceId,
          status: event.sourceStatus || 'unknown',
          failureCode: event.failureCode,
          occurredAt: event.occurredAt,
          eventId: event.eventId
        });
      }
    }
  }

  const dailyRows = Array.from(daily.values()).map((row) => ({
    ...row,
    byType: sortedObject(row.byType),
    byCategory: sortedObject(row.byCategory),
    feedback: sortedObject(row.feedback)
  })).sort((a, b) => a.day.localeCompare(b.day));

  const clusterRows = Array.from(clusters.values()).map((cluster) => ({
    ...cluster,
    answerStates: sortedObject(cluster.answerStates),
    eventTypes: sortedObject(cluster.eventTypes),
    failureCodes: sortedObject(cluster.failureCodes)
  })).sort((a, b) => b.count - a.count || b.negativeFeedbackCount - a.negativeFeedbackCount || a.key.localeCompare(b.key));

  return Object.freeze({
    schemaVersion: 1,
    projectId,
    eventCount: ordered.length,
    actionableCount,
    redactionCount,
    range: {
      firstOccurredAt: ordered[0]?.occurredAt ?? null,
      lastOccurredAt: ordered.at(-1)?.occurredAt ?? null
    },
    totals: {
      byType: sortedObject(byType),
      byCategory: sortedObject(byCategory),
      byAnswerState: sortedObject(byAnswerState),
      feedback: sortedObject(feedback)
    },
    daily: dailyRows,
    clusters: clusterRows,
    sourceHealth: Array.from(sourceHealth.values()).sort((a, b) => a.sourceId.localeCompare(b.sourceId))
  });
}

export function reconcileLearningSnapshot(snapshot) {
  const dailyTotal = snapshot.daily.reduce((sum, row) => sum + row.total, 0);
  const typeTotal = Object.values(snapshot.totals.byType).reduce((sum, value) => sum + value, 0);
  const categoryTotal = Object.values(snapshot.totals.byCategory).reduce((sum, value) => sum + value, 0);
  const clusterTotal = snapshot.clusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const dailyActionable = snapshot.daily.reduce((sum, row) => sum + row.actionable, 0);
  const valid = [dailyTotal, typeTotal, categoryTotal, clusterTotal].every((value) => value === snapshot.eventCount)
    && dailyActionable === snapshot.actionableCount;
  return Object.freeze({ valid, eventCount: snapshot.eventCount, dailyTotal, typeTotal, categoryTotal, clusterTotal, dailyActionable });
}

export class LearningProjectionStore {
  #snapshots = new Map();

  rebuild(events, projectId) {
    const snapshot = buildLearningSnapshot(events, projectId);
    const reconciliation = reconcileLearningSnapshot(snapshot);
    if (!reconciliation.valid) throw new Error('learning snapshot failed reconciliation');
    const canonical = canonicalLearningSnapshot(snapshot);
    const previous = this.#snapshots.get(projectId);
    this.#snapshots.set(projectId, { snapshot, canonical });
    return { snapshot, canonical, unchanged: previous?.canonical === canonical, reconciliation };
  }

  get(projectId) {
    return this.#snapshots.get(projectId)?.snapshot ?? null;
  }

  canonical(projectId) {
    return this.#snapshots.get(projectId)?.canonical ?? null;
  }
}
