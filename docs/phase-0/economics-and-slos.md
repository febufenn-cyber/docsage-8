# Economics and Service-Level Objectives

## Purpose

The architecture must support the pricing hypothesis without weakening evidence quality. These are planning budgets, not public guarantees.

## Reference pricing hypothesis

| Plan shape | Monthly price hypothesis |
|---|---:|
| OSS/free | tightly budgeted |
| Starter | $99 |
| Growth | $249 |
| Pro | $499 |

Variable infrastructure and model cost should ordinarily remain below 20% of plan revenue, leaving room for support, fixed infrastructure, and margin.

## Answer budgets

| Metric | Initial target |
|---|---:|
| Mean variable answer cost | ≤ $0.03 |
| p95 variable answer cost | ≤ $0.08 |
| Median end-to-end latency | ≤ 4 s |
| p95 end-to-end latency | ≤ 8 s |
| Maximum user input | 4,000 UTF-8 characters |
| Default generated answer | ≤ 600 words |
| Retrieved evidence | route-specific hard cap |
| Provider retries | at most one bounded retry |
| Answer request timeout | 12 s hard stop |

Correctness gates outrank latency and cost. The system should abstain rather than route to a cheaper model that cannot preserve the answer contract.

## Ingestion budgets

Each project configures limits for:

- maximum discovered URLs;
- maximum page bytes and decompressed bytes;
- maximum repository files;
- maximum crawl duration;
- maximum redirects;
- maximum re-crawl frequency;
- maximum embedding updates per day.

Unchanged content is not re-embedded.

## Reference model routing

1. **Navigation route:** return relevant pages/snippets without generation when the user asks where something is documented.
2. **Direct route:** low-cost model for direct evidence-backed facts.
3. **Synthesis route:** stronger model for multiple sources, comparisons, conflicts, or code adaptation.
4. **Refusal route:** deterministic policy response where no model synthesis is required.
5. **Human-review route:** high-risk or unresolved cases flagged rather than repeatedly escalating model cost.

Routing must be measurable and reproducible.

## Caching

Permitted:

- source fetch and normalized revision caching;
- embeddings by content and model hash;
- retrieval results scoped by project, revision set, and query normalization;
- public answer caching only when version, runtime, policy, and source revisions match.

Not permitted:

- cross-tenant answer caches;
- stale answers after cited revisions become inactive;
- caches that remove answer/evidence traceability.

## Reliability objectives for pilot

| Capability | Target |
|---|---:|
| Evaluation run reproducibility | 100% recorded inputs |
| Ingestion job success after retry | ≥ 99% for supported pages |
| Answer API availability | ≥ 99% during pilot window |
| Evidence/citation record persistence | 100% for returned answers |
| Budget enforcement | 100% |
| Cross-project isolation | 100% |

## Free-tier guardrails

- hard monthly question and ingestion quotas;
- no unlimited anonymous usage;
- allowed-domain enforcement;
- lower default output cap;
- no expensive repeated synthesis after budget is reached;
- owner-visible usage and projected exhaustion;
- emergency project pause.

## Unit economics review

Before paid launch, measure per active project:

```text
source storage
+ embeddings and refresh
+ retrieval/reranking
+ answer generation
+ logs/analytics
+ customer support
+ payment fees
```

Do not infer profitability from answer-token cost alone.

## Change control

A threshold change requires:

- measured evidence;
- effect on truth/safety gates;
- effect on gross margin;
- updated benchmark run;
- recorded decision amendment.
