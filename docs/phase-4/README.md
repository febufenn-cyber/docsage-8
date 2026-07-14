# Phase 4 — Reliable Ingestion

Status: **engineering implementation complete; deployed refresh evidence remains required**.

- [Locked implementation plan](implementation-plan.md)
- [Incremental refresh contract](incremental-refresh.md)
- [Scheduling and recovery contract](scheduling-and-recovery.md)
- [Activation and rollback contract](activation-and-rollback.md)
- Phase gate command: `npm run gate:ingestion`
- Review document: `reviews/phase-4-reliable-ingestion-review.md`

## Delivered slices

1. Job and revision state machine
2. Incremental discovery and content diffs
3. Scheduling, retries, and source health
4. Version activation, rollback, and ingestion gate

## Reference commands

```bash
npm run check
npm run gate:widget
npm run gate:learning
npm run gate:ingestion
npm run gate:hono
```

The implementation preserves the Phase 1 truth-engine, Phase 2 widget, and Phase 3 learning gates. Deterministic fixtures prove engineering behavior, but they are not proof that a deployed scheduler completed a real source refresh.

The final decision remains `CONDITIONAL_GO` until real source-refresh evidence and the existing external readiness items are complete.
