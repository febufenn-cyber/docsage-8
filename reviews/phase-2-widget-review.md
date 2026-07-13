# Phase 2 Widget Review

Status: **CONDITIONAL GO — ENGINEERING GATE PASSED**

## Decision

- [ ] GO TO PHASE 3 AS PILOT-VALIDATED
- [x] CONDITIONAL GO
- [ ] REPEAT PHASE 2 ENGINEERING
- [ ] REDESIGN
- [ ] KILL

The single-project widget engineering slice is complete. Production and Phase 3 readiness remain conditional on a public documentation-site pilot and the unresolved Phase 1 external gates.

## Reference evidence

GitHub Actions CI run 19 on July 13, 2026 completed successfully with three independent jobs:

1. full Node test suite and CLI smoke test;
2. Phase 2 widget gate;
3. pinned Phase 1 Hono truth-engine gate.

The widget gate artifact is `phase-2-widget-gate`, artifact ID `8275874226`, digest:

```text
sha256:5ac308f1d223c0dc4efbc02a7dd0264232b7cfb7de8bc1c30802c99baca8b610
```

## Measured scorecard

| Metric | Target | Result | Status |
|---|---:|---:|---|
| Widget API contract tests | 100% | pass | pass |
| Token tamper and expiry tests | 100% | pass | pass |
| Origin bypass tests | 100% | pass | pass |
| Rate-limit tests | 100% | pass | pass |
| Safe rendering checks | 100% | no forbidden patterns | pass |
| Accessibility contract checks | 100% | all required markers present | pass |
| Feedback acceptance | 100% | pass | pass |
| Feedback idempotency | 100% | one stored event after duplicate submission | pass |
| Widget gzip size | ≤40 KiB | 5,136 bytes | pass |
| Widget raw size | informational | 18,809 bytes | pass |
| Grounded answer state | supported/partial | `supported` | pass |
| Citation flow | ≥1 safe citation | 8 citations | pass |
| Useful refusal | expected state | `account_specific` | pass |
| Demo assets | page + module | pass | pass |
| Pilot deployment | at least one public docs site | 0 | blocked |

## Gate checks

The machine-readable gate passed:

- asset size;
- unsafe-source scan;
- accessibility markers;
- demo page and module;
- config contract;
- grounded answer and citations;
- useful account-specific refusal;
- origin enforcement;
- feedback acceptance;
- feedback idempotency.

## Implementation evidence

Phase 2 now includes:

- public HMAC-signed project and origin-scoped widget tokens;
- token tamper and expiry enforcement;
- exact and wildcard-subdomain origin policy;
- bounded answer and feedback request schemas;
- separate answer and feedback rate limiting;
- stable public errors, safe CORS, and security headers;
- a single-project adapter to the Phase 1 truth engine;
- a framework-free Shadow DOM Web Component;
- text-only rendering of untrusted content;
- HTTP(S)-only citations;
- keyboard, focus, live-region, and reduced-motion behavior;
- controlled useful/not-useful feedback;
- idempotent feedback event IDs;
- a dependency-free executable local demo;
- `npm run gate:widget` with JSON and Markdown evidence;
- a dedicated CI job and artifact.

## Remaining blockers

### Public pilot

Required: deploy the widget on at least one real public documentation site and capture:

- embed and origin configuration;
- successful answer and refusal traces;
- feedback events;
- browser compatibility observations;
- latency and reliability observations;
- owner and user feedback.

Current: not completed.

### Phase 1 external gates

Still incomplete:

- 15-case independent human review;
- credentialed Cloudflare embedding/reranking and Claude answer benchmark.

These are not silently satisfied by the Phase 2 deterministic widget gate.

## Recommendation

Merge the Phase 2 engineering implementation. Do not describe Phase 2 as pilot-validated or begin a production claim for Phase 3 until a real documentation-site pilot is complete and the Phase 1 external blockers are resolved.
