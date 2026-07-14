# Phase 3 — Learning Console

Status: **engineering implementation complete; real pilot evidence remains required**.

- [Locked implementation plan](implementation-plan.md)
- [Learning event contract](event-contract.md)
- [Aggregation contract](aggregation-contract.md)
- [Operator API and console](operator-console.md)
- Phase gate command: `npm run gate:learning`
- Review document: `reviews/phase-3-learning-console-review.md`

## Delivered slices

1. Contract, privacy, and event schema
2. Classification and aggregation pipeline
3. Operator API and console UI
4. Learning gate and measured review

## Reference commands

```bash
npm run check
npm run gate:widget
npm run gate:learning
npm run gate:hono
```

The implementation preserves the Phase 1 truth-engine and Phase 2 widget gates. Synthetic events prove deterministic engineering behavior, but they are not described as real pilot evidence.

The final decision remains `CONDITIONAL_GO` until a real public documentation-site pilot produces learning events and the unresolved Phase 1 external evidence is completed.
