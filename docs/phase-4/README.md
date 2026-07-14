# Phase 4 — Reliable Ingestion

Status: **implementation in progress**.

- [Locked implementation plan](implementation-plan.md)
- Phase gate command: `npm run gate:ingestion` (introduced in slice 4D)
- Review document: `reviews/phase-4-reliable-ingestion-review.md` (introduced in slice 4D)

## Delivery slices

1. Job and revision state machine
2. Incremental discovery and content diffs
3. Scheduling, retries, and source health
4. Version activation, rollback, and ingestion gate

Every slice preserves the Phase 1 truth-engine, Phase 2 widget, and Phase 3 learning gates. Deterministic fixtures are engineering evidence, not proof of a deployed source refresh.
