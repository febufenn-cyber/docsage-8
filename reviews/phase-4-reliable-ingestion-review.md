# Phase 4 Reliable Ingestion Review

Status: **CONDITIONAL GO — ENGINEERING GATE IMPLEMENTED**

## Decision

- [ ] GO TO PHASE 5 AS DEPLOYED-REFRESH VALIDATED
- [x] CONDITIONAL GO
- [ ] REPEAT PHASE 4 ENGINEERING
- [ ] REDESIGN
- [ ] KILL

The Phase 4 deterministic engineering implementation is complete on this branch. The definitive scorecard is produced by `npm run gate:ingestion` and uploaded by GitHub Actions as `phase-4-ingestion-gate` before merge.

## Implemented evidence

- project/source-scoped idempotent ingestion jobs;
- validated state transitions, optimistic versions, worker leases, and append-only histories;
- content-addressed order-independent source manifests;
- added, changed, unchanged, and deleted document classification;
- zero new corpus identities for an unchanged refresh;
- unchanged document and chunk identity reuse;
- staged deletion tombstones;
- bounded schedules, deterministic retry backoff, and expired-worker recovery;
- privacy-safe source-health learning events;
- atomic activation and compatible rollback;
- separate active pointers for project, source, version, and runtime;
- append-only activation audit records;
- additive ingestion, learning, widget, Hono, and full-test CI gates.

## Release targets

| Metric | Target |
|---|---:|
| Exact job replay | one stored job |
| Conflicting replay | blocked |
| Expired lease recovery | deterministic |
| Concurrent schedule delivery | one job |
| Unchanged complete refresh | zero new corpus revision |
| Deletion before activation | prior corpus remains active |
| Failed activation | prior corpus remains exact |
| Successful activation | exactly one active revision per scope |
| Rollback | exact prior chunks restored |
| Mixed-version active chunks | 0 |
| Prior Phase 1–3 gates | green |

## External blockers

- no deployed scheduler has completed a real source refresh;
- independent Phase 1 benchmark review remains 0/15;
- credentialed hosted-model benchmark remains incomplete;
- public widget pilot remains incomplete.

These blockers prevent a deployed-refresh-validated `GO_TO_PHASE_5` claim. They do not invalidate the deterministic engineering result.
