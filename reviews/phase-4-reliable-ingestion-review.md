# Phase 4 Reliable Ingestion Review

Status: **CONDITIONAL GO — ENGINEERING GATE PASSED**

## Decision

- [ ] GO TO PHASE 5 AS DEPLOYED-REFRESH VALIDATED
- [x] CONDITIONAL GO
- [ ] REPEAT PHASE 4 ENGINEERING
- [ ] REDESIGN
- [ ] KILL

The Phase 4 deterministic engineering implementation is complete. GitHub Actions run 52 passed the full tests, Phase 2 widget gate, Phase 3 learning gate, Phase 4 reliable ingestion gate, and pinned Phase 1 Hono gate.

## Gate artifact

- Artifact: `phase-4-ingestion-gate`
- Artifact ID: `8302426170`
- Digest:

```text
sha256:8a290112236951411970494b036ab077151ae9b7f86e11253abf98ab60d9cbb8
```

- Evaluated branch head: `10462efd7d3639bed15f07d5d5a4ecc94e6336a2`
- Gate creation time: `2026-07-14T06:39:59.851Z`

## Measured scorecard

| Check | Result |
|---|---:|
| Exact job replay | one stored job |
| Conflicting job replay | blocked |
| Expired worker lease | recovered to deterministic retry |
| Source-health event privacy | pass |
| Concurrent scheduler delivery | one stored job |
| Unchanged complete refresh | existing corpus revision reused |
| Staged deletion before activation | prior corpus remained active |
| Simulated failed activation | prior chunks remained exact |
| Successful activation | exact version/runtime scope switched |
| Rollback | exact prior corpus restored |
| Mixed-version contamination | zero |
| Machine-readable checks | **11/11 passed** |

## Measured metrics

| Metric | Result |
|---|---:|
| Manual job count | 1 |
| Manual job history records | 4 |
| Scheduled job count after concurrent delivery | 1 |
| Initial corpus items | 2 |
| Staged corpus items | 2 |
| Staged deletion tombstones | 1 |
| Activation audit events including seeds | 4 |
| Active v4 chunks after rollback | 2 |
| Independently active v5 chunks | 1 |

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

## External blockers

- no deployed scheduler has completed a real source refresh;
- independent Phase 1 benchmark review remains 0/15;
- credentialed hosted-model benchmark remains incomplete;
- public widget pilot remains incomplete.

These blockers prevent a deployed-refresh-validated `GO_TO_PHASE_5` claim. They do not invalidate the deterministic engineering result. The next autonomous `build` command therefore selects Phase 5 engineering while preserving these blockers.
