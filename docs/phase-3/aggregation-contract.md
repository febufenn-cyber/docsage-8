# Learning Aggregation Contract

Phase 3 projections are deterministic views over append-only `learning_events`.

## Outputs

- daily totals by event type and classification;
- actionable-event counts;
- answer-state totals;
- useful/not-useful feedback totals;
- deterministic question/failure clusters;
- latest source-health state per source key.

## Determinism

Events are sorted by `occurredAt` and `eventId` before projection. Cluster and metric objects are key-sorted before canonical serialization. Rebuilding from the same accepted events in any input order must produce byte-equivalent canonical JSON.

## Reconciliation

The daily, type, category, and cluster totals must each equal the accepted project event count. A reconciliation failure blocks publication of the projection.

## Isolation

A projection build accepts events for exactly one explicit project. Mixed-project inputs fail instead of being filtered silently.
