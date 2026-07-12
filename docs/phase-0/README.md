# Phase 0 — Position, Constitution, and Benchmark

## Purpose

Phase 0 removes foundational ambiguity before application code is written. It defines the game DocSage is playing, the evidence it is allowed to use, when it must refuse, how failures are classified, how risk is bounded, and how Phase 1 will be judged.

Phase 0 is complete as a repository package, but it is **not automatically approved**. Approval requires a reviewer to accept the decisions and complete the annotation items described below.

## Binding artifacts

| Artifact | Binding decision |
|---|---|
| [`product-constitution.md`](product-constitution.md) | Product identity, endgame, principles, non-goals, and kill conditions |
| [`ideal-customer-profile.md`](ideal-customer-profile.md) | Initial customer and disqualifying conditions |
| [`jobs-and-use-cases.md`](jobs-and-use-cases.md) | Supported questions, unsupported requests, and escalation |
| [`answer-constitution.md`](answer-constitution.md) | Grounding, citation, abstention, conflict, and version rules |
| [`source-policy.md`](source-policy.md) | Approved source hierarchy, metadata, and freshness rules |
| [`evaluation-policy.md`](evaluation-policy.md) | Benchmark design, scoring, release thresholds, and review protocol |
| [`failure-taxonomy.md`](failure-taxonomy.md) | Diagnosable failure classes |
| [`threat-model.md`](threat-model.md) | Assets, trust boundaries, abuse cases, and required controls |
| [`economics-and-slos.md`](economics-and-slos.md) | Latency, cost, reliability, and usage budgets |
| [`pilot-specification.md`](pilot-specification.md) | Frozen pilot scope, capabilities, non-capabilities, and evidence gates |
| [`../architecture/decisions/phase-0-decisions.md`](../architecture/decisions/phase-0-decisions.md) | Architecture decision record set |

## Benchmark package

The first benchmark corpus is the public Hono documentation and the public `honojs/hono` repository. Hono is used only as a reproducible technical benchmark; this does not imply endorsement, partnership, or a commercial pilot.

- [`../../evals/datasets/hono-source-map.json`](../../evals/datasets/hono-source-map.json) — approved benchmark sources and authority
- [`../../evals/datasets/hono-phase0.manifest.json`](../../evals/datasets/hono-phase0.manifest.json) — manifest for 76 candidate cases in four JSONL shards
- [`../../evals/schemas/evaluation-case.schema.json`](../../evals/schemas/evaluation-case.schema.json) — machine-readable case contract
- [`../../evals/README.md`](../../evals/README.md) — annotation and execution instructions

The dataset includes answerable, multi-source, exact-token, version-sensitive, unanswerable, out-of-scope, conflict, and adversarial cases. Records marked `annotation_status: candidate` must be human-verified against a pinned source revision before they become a release gate.

## Phase 0 review checklist

### Position

- [ ] The beachhead customer is narrow enough.
- [ ] The product is a public-source documentation assistant, not account support.
- [ ] The documentation intelligence loop is accepted as the strategic endgame.
- [ ] The listed non-goals are accepted.

### Truth

- [ ] The answer states are accepted.
- [ ] Material claims require nearby supporting evidence.
- [ ] General model knowledge cannot silently fill source gaps.
- [ ] Conflicts and version ambiguity must be surfaced.
- [ ] Synthetic code examples must be labelled.

### Benchmark

- [ ] The Hono corpus is acceptable as the initial engineering benchmark.
- [ ] Every candidate case is reviewed and promoted to `verified` or rejected.
- [ ] Expected source URLs and required concepts are accurate.
- [ ] At least 15 cases are independently reviewed by a second person.
- [ ] The benchmark source revision is pinned before Phase 1 scoring.

### Safety

- [ ] Public sources only.
- [ ] SSRF restrictions are mandatory.
- [ ] Retrieved text is treated as untrusted evidence.
- [ ] Project scoping and RLS are mandatory before multi-tenancy.
- [ ] No autonomous documentation writes in the initial product.

### Economics

- [ ] Cost ceilings are commercially compatible with the pricing hypothesis.
- [ ] Latency targets are acceptable.
- [ ] Free-tier exposure is limited by explicit budgets.
- [ ] Model routing and caching may be used without weakening truth requirements.

## Gate to begin Phase 1

Phase 1 may begin when all of the following are true:

1. A reviewer approves the ten Phase 0 policy documents.
2. One benchmark source revision is pinned by date and repository commit.
3. At least 60 evaluation records have `annotation_status: verified`.
4. No high-risk answerable case lacks a verified supporting source.
5. Negative and adversarial cases remain in the benchmark.
6. The initial cost and latency budgets are accepted.
7. The implementation team agrees not to build the public widget before the truth-engine gate is met.

## Gate to exit Phase 1

The initial target thresholds are:

- Retrieval evidence recall@8: **≥ 90%** on verified answerable cases.
- High-risk retrieval recall@8: **100%**.
- Citation entailment: **≥ 95%** of material claims supported.
- Correct abstention: **≥ 95%** on unanswerable and out-of-scope cases.
- Prompt-injection resistance: **100%** on committed adversarial cases.
- Version contamination: **0 known mixed-version answers**.
- Median answer latency: **≤ 4 seconds** in the target environment.
- p95 answer latency: **≤ 8 seconds**.
- Mean variable answer cost: **≤ $0.03** under the reference routing policy.

Thresholds are initial hypotheses. Changing one requires updating the decision record and explaining the trade-off.
