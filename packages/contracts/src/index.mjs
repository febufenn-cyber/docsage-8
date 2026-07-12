export const ANSWER_STATES = Object.freeze([
  'supported',
  'partially_supported',
  'conflicting_sources',
  'version_ambiguous',
  'runtime_ambiguous',
  'not_found',
  'account_specific',
  'out_of_scope',
  'unsafe_or_untrusted'
]);

export const FAILURE_CODES = Object.freeze([
  'INGEST_DISCOVERY_MISS', 'INGEST_FETCH_FAIL', 'INGEST_PARSE_LOSS',
  'CHUNK_CONTEXT_SPLIT', 'CHUNK_CODE_SPLIT', 'CHUNK_TABLE_SPLIT',
  'RETRIEVE_MISS', 'RETRIEVE_EXACT_TOKEN_MISS', 'RETRIEVE_WRONG_VERSION',
  'RETRIEVE_WRONG_RUNTIME', 'RETRIEVE_CROSS_PROJECT', 'RERANK_BAD_ORDER',
  'GEN_UNSUPPORTED_CLAIM', 'GEN_MISREAD_SOURCE', 'GEN_INCOMPLETE',
  'GEN_OVERCONFIDENT', 'GEN_CODE_INVENTION', 'GEN_BAD_ABSTENTION',
  'CITE_MISSING', 'CITE_IRRELEVANT', 'CITE_WRONG_REVISION',
  'CITE_INVENTED', 'CITE_CLAIM_MISMATCH', 'STATE_CONFLICT_MISSED',
  'STATE_VERSION_AMBIGUITY_MISSED', 'STATE_ACCOUNT_SPECIFIC_MISSED',
  'STATE_OUT_OF_SCOPE_MISSED', 'STATE_NOT_FOUND_FALSE',
  'SAFE_PROMPT_INJECTION', 'SAFE_SECRET_EXPOSURE', 'SAFE_SSRF',
  'SAFE_DOMAIN_BYPASS', 'SAFE_RATE_LIMIT_BYPASS', 'SAFE_TENANT_LEAK',
  'SAFE_TOOL_EXECUTION', 'OPS_TIMEOUT', 'OPS_PROVIDER_FAIL',
  'OPS_COST_BUDGET', 'OPS_NON_REPRODUCIBLE', 'OPS_OBSERVABILITY_GAP'
]);

export function assertAnswerState(value) {
  if (!ANSWER_STATES.includes(value)) throw new TypeError(`Invalid answer state: ${value}`);
  return value;
}

export function assertProjectScope(record, projectId) {
  if (!record || record.projectId !== projectId) {
    const error = new Error('Project scope violation');
    error.code = 'SAFE_TENANT_LEAK';
    throw error;
  }
  return record;
}

export function makeTraceId(prefix = 'run') {
  return `${prefix}_${crypto.randomUUID()}`;
}
