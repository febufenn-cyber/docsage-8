# Failure Taxonomy

Every quality problem must have a primary failure code and may have secondary codes.

## Ingestion

| Code | Meaning |
|---|---|
| `INGEST_DISCOVERY_MISS` | approved page/file was not discovered |
| `INGEST_FETCH_FAIL` | source could not be retrieved |
| `INGEST_PARSE_LOSS` | meaningful text, code, table, or warning was lost |
| `INGEST_DUPLICATE_BAD` | distinct versions/pages were collapsed |
| `INGEST_STALE_ACTIVE` | obsolete revision remained active |
| `INGEST_DELETE_MISS` | deleted content remained retrievable |
| `INGEST_METADATA_WRONG` | version, runtime, title, path, or authority was incorrect |

## Chunking

| Code | Meaning |
|---|---|
| `CHUNK_CONTEXT_SPLIT` | explanation separated from the item it governs |
| `CHUNK_CODE_SPLIT` | code separated from explanation/imports |
| `CHUNK_TABLE_SPLIT` | headers separated from rows |
| `CHUNK_WARNING_SPLIT` | warning/deprecation detached |
| `CHUNK_TOO_BROAD` | unrelated content diluted retrieval |
| `CHUNK_TOO_NARROW` | required context was omitted |

## Retrieval

| Code | Meaning |
|---|---|
| `RETRIEVE_MISS` | verified evidence absent from top-k |
| `RETRIEVE_EXACT_TOKEN_MISS` | identifier/error keyword search failed |
| `RETRIEVE_WRONG_VERSION` | evidence came from the wrong version |
| `RETRIEVE_WRONG_RUNTIME` | evidence came from the wrong platform |
| `RETRIEVE_LOW_AUTHORITY` | lower-authority source outranked official evidence |
| `RETRIEVE_CROSS_PROJECT` | evidence crossed project boundary |
| `RERANK_BAD_ORDER` | evidence found but ranked below misleading content |

## Generation

| Code | Meaning |
|---|---|
| `GEN_UNSUPPORTED_CLAIM` | answer added a claim absent from evidence |
| `GEN_MISREAD_SOURCE` | evidence was interpreted incorrectly |
| `GEN_INCOMPLETE` | required supported concept omitted |
| `GEN_OVERCONFIDENT` | confidence exceeded evidence |
| `GEN_CODE_INVENTION` | undocumented API/option/import generated |
| `GEN_BAD_CLARIFICATION` | answer guessed instead of clarifying |
| `GEN_BAD_ABSTENTION` | answer refused despite sufficient evidence |

## Citation

| Code | Meaning |
|---|---|
| `CITE_MISSING` | material claim had no citation |
| `CITE_IRRELEVANT` | citation was topical but not supportive |
| `CITE_WRONG_REVISION` | link/revision did not match used evidence |
| `CITE_OVERBROAD` | citation pointed to a large page without locating evidence |
| `CITE_INVENTED` | citation was not retrieved or approved |
| `CITE_CLAIM_MISMATCH` | source contradicted or failed to entail claim |

## State and policy

| Code | Meaning |
|---|---|
| `STATE_CONFLICT_MISSED` | conflicting sources not surfaced |
| `STATE_VERSION_AMBIGUITY_MISSED` | version ambiguity hidden |
| `STATE_ACCOUNT_SPECIFIC_MISSED` | private-state question answered as docs question |
| `STATE_OUT_OF_SCOPE_MISSED` | unsupported class answered |
| `STATE_NOT_FOUND_FALSE` | evidence existed but system said not found |

## Safety

| Code | Meaning |
|---|---|
| `SAFE_PROMPT_INJECTION` | retrieved content changed governing behavior |
| `SAFE_SECRET_EXPOSURE` | secret or hidden context exposed |
| `SAFE_SSRF` | crawler reached prohibited network target |
| `SAFE_DOMAIN_BYPASS` | widget used from unauthorized domain |
| `SAFE_RATE_LIMIT_BYPASS` | abuse control failed |
| `SAFE_TENANT_LEAK` | one tenant accessed another’s data |
| `SAFE_TOOL_EXECUTION` | untrusted content triggered an action |

## Operations

| Code | Meaning |
|---|---|
| `OPS_TIMEOUT` | response exceeded time budget |
| `OPS_PROVIDER_FAIL` | external model/provider failed |
| `OPS_COST_BUDGET` | variable cost exceeded route budget |
| `OPS_NON_REPRODUCIBLE` | answer could not be recreated from recorded inputs |
| `OPS_OBSERVABILITY_GAP` | needed trace/evidence was not recorded |

## Triage rule

Fix the earliest causal layer. For example, if an answer is wrong because code was lost during parsing, classify `INGEST_PARSE_LOSS` as primary rather than tuning the generation prompt.
