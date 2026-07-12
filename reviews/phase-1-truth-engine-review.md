# Phase 1 Truth Engine Review

Status: **CONDITIONAL GO — PINNED ENGINEERING GATE PASSED**

## Decision

- [ ] GO TO PHASE 2 AS PRODUCTION-READY
- [x] CONDITIONAL GO
- [ ] REPEAT PHASE 1 ENGINEERING
- [ ] REDESIGN
- [ ] KILL

The keyless, reproducible Phase 1 engineering gate passes. Production readiness remains conditional on an independent human review and a credentialed run of the selected hosted model route.

## Pinned evidence

The gate pins immutable official sources:

- `honojs/website@bad29e3d87b8509f8a2982084dc29e9ba098549d`
- `honojs/hono@d3f97caa29bba1f1ae31a4e023c25224aa2a4261`

It verifies 23 Git blobs, materializes 273 structured chunks, and evaluates 76 reviewed cases. The corpus lock, review report, verified JSONL, raw results, metrics, report, and gate decision are uploaded by GitHub Actions.

## Measured engineering result

Reference run: GitHub Actions CI run 8, merge-test SHA `4132cad6f907ef2f4a6862f9826ebcb37a437b70`, July 12, 2026.

| Metric | Target | Result | Status |
|---|---:|---:|---|
| Verified benchmark cases | ≥60 | 76 | pass |
| State accuracy | ≥90% | 100% | pass |
| Retrieval recall@8 | ≥90% | 100% | pass |
| High-risk recall@8 | 100% | 100% | pass |
| Concept coverage | ≥90% | 100% | pass |
| Forbidden-claim safety | ≥95% | 100% | pass |
| Citation validation | ≥95% | 100% | pass |
| Correct abstention | ≥95% | 100% | pass |
| Adversarial accuracy | 100% | 100% | pass |
| Version/conflict accuracy | ≥90% | 100% | pass |
| Failed benchmark cases | 0 desired | 0 | pass |
| Median latency | ≤4 s | 92.9 ms | pass |
| p95 latency | ≤8 s | 348.2 ms | pass |
| Mean variable cost | ≤$0.03 | $0.00 | pass |

The latest CI artifact and the replaceable gate section in PR #2 are canonical when timings differ across runners.

## Engineering failures found and corrected

The real gate initially failed. The fixes were made at the earliest causal layers rather than by lowering thresholds:

1. Source-diverse retrieval prevented repeated chunks from one page crowding out other authoritative documents.
2. Document-level relevance fusion recovered pages whose evidence was distributed across sections.
3. Coverage-driven section selection recovered multi-step and exact-concept evidence within a retrieved page.
4. Evidence depth increased from five to twelve selected chunks for the reference route.
5. Historical-version, account-specific, conflict, roadmap, security-guarantee, and unsafe citation requests were classified before generation.
6. Numeric values under one heading stopped being treated as conflicts unless typed conflict facts explicitly disagreed.
7. Citation validation now evaluates the exact source-derived search representation, including titles and heading paths.

## Selected hosted route

The selected production route is documented in `docs/phase-1/model-routing.md`:

- Cloudflare Qwen3 embedding model
- Cloudflare BGE reranker
- Claude direct-answer route
- Claude synthesis/conflict route

Adapters and mock tests exist, but a credentialed end-to-end hosted benchmark has not been executed in this repository.

## Remaining blockers

### Independent review

Required: 15 benchmark cases reviewed by a genuinely independent human reviewer.

Current: 0/15.

The implementation agent cannot honestly self-certify independence by reviewing its own benchmark a second time.

### Hosted-route benchmark

Required credentials:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `ANTHROPIC_API_KEY`
- explicit Claude model configuration

Current: not executed because those credentials are not available to the repository workflow.

The hosted run must record retrieval, reranking, answer quality, citation support, latency, token usage, and variable cost without weakening the evidence contract.

## Merge recommendation

Merge the Phase 1 implementation and gate infrastructure after Phase 0 is merged and PR #2 is retargeted to `main`. Do not describe Phase 2 as production-ready until the two remaining blockers are closed.
