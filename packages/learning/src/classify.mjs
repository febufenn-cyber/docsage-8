const REFUSAL_CATEGORIES = Object.freeze({
  not_found: ['documentation_gap', 'high'],
  conflicting_sources: ['source_conflict', 'high'],
  version_ambiguous: ['version_ambiguity', 'medium'],
  runtime_ambiguous: ['runtime_ambiguity', 'medium'],
  account_specific: ['account_specific', 'low'],
  out_of_scope: ['out_of_scope', 'low'],
  unsafe_or_untrusted: ['unsafe_request', 'low']
});

export function classifyLearningEvent(event) {
  if (!event || typeof event !== 'object') throw new TypeError('event is required');

  if (event.type === 'feedback.recorded') {
    return Object.freeze(event.feedbackRating === 'not_useful'
      ? { category: 'negative_feedback', severity: 'high', actionable: true }
      : { category: 'positive_feedback', severity: 'info', actionable: false });
  }

  if (event.type === 'source.health') {
    if (event.sourceStatus === 'failed') return Object.freeze({ category: 'source_failed', severity: 'critical', actionable: true });
    if (event.sourceStatus === 'degraded') return Object.freeze({ category: 'source_degraded', severity: 'high', actionable: true });
    if (event.sourceStatus === 'healthy') return Object.freeze({ category: 'source_healthy', severity: 'info', actionable: false });
    return Object.freeze({ category: 'source_unknown', severity: 'medium', actionable: true });
  }

  if (event.type === 'evaluation.failed') {
    return Object.freeze({ category: event.failureCode ? `evaluation_${event.failureCode}` : 'evaluation_failed', severity: 'critical', actionable: true });
  }

  if (event.answerState === 'supported') {
    return Object.freeze({ category: 'supported', severity: 'info', actionable: false });
  }
  if (event.answerState === 'partially_supported') {
    return Object.freeze({ category: 'partial_answer', severity: 'medium', actionable: true });
  }
  const refusal = REFUSAL_CATEGORIES[event.answerState];
  if (refusal) return Object.freeze({ category: refusal[0], severity: refusal[1], actionable: refusal[1] !== 'low' });

  return Object.freeze({ category: event.failureCode || 'unclassified', severity: 'medium', actionable: true });
}

export function learningClusterKey(event, classification = classifyLearningEvent(event)) {
  const subject = event.questionFingerprint
    || event.traceId
    || event.metadata?.source_id
    || event.metadata?.case_id
    || event.failureCode
    || event.sourceStatus
    || event.type;
  return `${classification.category}:${subject}`;
}
