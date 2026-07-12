# Evaluation Policy

## Purpose

Evaluation answers four separate questions:

1. Did ingestion preserve the needed evidence?
2. Did retrieval find the evidence?
3. Did generation state only supported claims?
4. Did the system abstain or escalate correctly?

A single subjective “looks good” score is prohibited.

## Benchmark lifecycle

```text
candidate
→ source-verified
→ independently reviewed
→ verified
→ frozen for release gate
→ retired only by recorded decision
```

Generated cases begin as `candidate`. A human reviewer must inspect the source and fill or confirm required concepts, forbidden claims, answerability, risk, version, runtime, and evidence URLs.

## Case classes

The committed benchmark includes:

- direct fact;
- exact identifier or error token;
- procedural setup;
- API usage;
- code example;
- multi-source synthesis;
- comparison;
- version/runtime ambiguity;
- unsupported capability;
- account-specific request;
- source conflict;
- adversarial prompt injection.

Negative cases must not be removed merely to increase scores.

## Primary metrics

### Retrieval evidence recall@k

Percentage of answerable cases where at least one verified supporting evidence unit appears in the top `k`. Report `k=3`, `k=5`, and `k=8`.

### High-risk retrieval recall

Recall for security, authentication, migration, limits, and destructive-operation questions.

### Citation entailment

Percentage of material claims directly supported by their attached evidence.

### Citation precision

Percentage of attached citations that materially support the nearby claim.

### Completeness

Percentage of required concepts represented without unsupported additions.

### Abstention correctness

Percentage of unanswerable, account-specific, and out-of-scope cases handled without invented answers.

### Conflict/version detection

Percentage of conflict or ambiguity cases where the correct state is surfaced.

### Injection resistance

Percentage of adversarial cases where untrusted content fails to alter governing behavior or expose secrets.

### Operational metrics

- median and p95 latency;
- retrieval and generation token usage;
- variable cost per answer;
- timeout and provider-failure rates.

## Initial Phase 1 thresholds

| Metric | Gate |
|---|---:|
| Retrieval recall@8 | ≥ 90% |
| High-risk recall@8 | 100% |
| Citation entailment | ≥ 95% |
| Citation precision | ≥ 95% |
| Correct abstention | ≥ 95% |
| Conflict/version detection | ≥ 90% |
| Injection resistance | 100% |
| Known cross-version contamination | 0 |
| Median latency | ≤ 4 s |
| p95 latency | ≤ 8 s |
| Mean variable answer cost | ≤ $0.03 |

Averages cannot hide high-risk failures.

## Review protocol

For each failed case, record:

- run identifier;
- source revision set;
- retrieved units and ranks;
- answer and claims;
- citations;
- failure code;
- reviewer disposition;
- proposed fix class;
- whether the benchmark expectation changed.

Benchmark expectations may change only when source review proves the case was incorrect or the pinned corpus changed. Do not rewrite expectations to match model behavior.

## Evaluation splits

- `development`: visible cases used during iteration.
- `holdout`: hidden from prompt and retrieval tuning.
- `adversarial`: security and boundary cases.
- `pilot`: real questions supplied by a design partner.

At least 20% of verified cases should remain holdout before public claims.

## Reproducibility

Every run must pin:

- corpus manifest and hashes;
- Git commit or crawl revision;
- parser and chunker versions;
- embedding model;
- retrieval configuration;
- reranker;
- answer model and prompt version;
- date and environment;
- random seed where applicable.

## Human review

Automated grading can assist, but release decisions require manual review of:

- all high-risk failures;
- all citations marked unsupported;
- all source conflicts;
- all cases where a grader and deterministic checks disagree;
- a random sample of passing answers.
