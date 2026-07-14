# Phase 4 — Reliable Ingestion Implementation Plan

Status: **LOCKED FOR IMPLEMENTATION**

Verified base: `ce3e824079a330576cfec0803b3d316dd8ebd880` (`main`, repository tree equivalent to the Phase 3 completion head after cleanup of an accidental empty file).

## Objective

Make source refreshes incremental, crash-safe, retryable, version-aware, reversible, and observable without weakening the Phase 1 truth engine, Phase 2 widget, or Phase 3 learning loop.

The forcing question is:

> Can DocSage refresh an approved source repeatedly without duplicate content, partial activation, silent deletion loss, stale-version leakage, or irrecoverable failure?

## Non-goals

Phase 4 does not add private repositories, arbitrary code execution, customer billing, multi-organization administration, production deployment credentials, or claims that a real scheduler has refreshed a real customer source.

## Inspected current architecture

The existing implementation already provides:

- SSRF-aware bounded public fetches and redirect revalidation;
- pinned public GitHub repository reads and secret quarantine;
- deterministic Markdown normalization and chunk IDs;
- a memory source registry with projects, sources, revisions, and chunks;
- Supabase source, document, revision, and chunk tables with project RLS;
- retrieval filters for active revisions, versions, runtimes, and projects;
- Phase 3 append-only learning events including source-health outcomes.

The current memory registry deactivates the previous source revision as soon as `addRevision` is called. Phase 4 replaces that unsafe activation behavior with immutable staging and an explicit atomic activation boundary.

## Frozen contracts

### Job identity

An ingestion job is scoped by `projectId`, `sourceId`, and a caller-supplied idempotency key. Repeating the same key with the same immutable request returns the existing job. Reusing it with different content is a conflict.

### Job states

```text
queued
  → discovering
  → fetching
  → normalizing
  → staging
  → staged
  → activating
  → succeeded
  → rolled_back

recoverable stage failures → retry_wait → queued
non-recoverable or exhausted failures → failed
cancellable pre-activation states → cancelled
```

Every transition is validated against a fixed transition graph and an expected record version. Transition history is append-only.

### Revision lifecycle

A corpus revision is immutable after staging. Staging cannot change the active revision. Activation is the only operation allowed to replace the active revision. Activation records both the prior and new active revision IDs so rollback is deterministic.

### Lease boundary

Workers claim a job with an owner and lease expiry. Only the current lease owner may mutate a running job. Expired leases are recoverable; live leases cannot be stolen.

### Failure boundary

A failure before successful activation must leave the previously active corpus unchanged. Error records use bounded stable codes and messages and may not persist provider secrets or response bodies.

## Migration plan

1. Add project-scoped `ingestion_jobs` with immutable request hashes, optimistic versions, lease fields, staged/activated revision pointers, retry metadata, and bounded failure fields.
2. Add append-only `ingestion_job_transitions` for state and actor history.
3. Add staged corpus manifest and document-diff storage in slice 4B.
4. Add schedule, attempt, and source-health state in slice 4C.
5. Add atomic activation/rollback functions and active-version invariants in slice 4D.

All new tables use project RLS. No migration removes or rewrites the Phase 1 tables.

## Threat-model additions

- duplicate job delivery and replay;
- two workers claiming or activating the same job;
- stale worker writes after lease expiry;
- failed refresh partially changing active content;
- deletion suppression that leaves retired pages searchable;
- malicious or unstable source ordering causing false diffs;
- retry storms and unbounded failure payloads;
- rollback to another project or incompatible source/version;
- mixed-version active chunks;
- source-health events leaking raw URLs, credentials, or response bodies.

## Implementation slices

### 4A — Job and revision state machine

- deterministic job contract and transition graph;
- project-scoped idempotent job store;
- optimistic transition versions;
- worker leases and append-only history;
- Supabase job/history migration;
- invalid transition, replay, conflict, isolation, and lease tests.

### 4B — Incremental discovery and content diffs

- canonical source-item manifests;
- stable content hashes independent of discovery order;
- added/changed/unchanged/deleted classification;
- unchanged document/chunk reuse;
- deletion tombstones that remain staged until activation;
- no duplicate revision or chunk creation for an unchanged corpus.

### 4C — Scheduling, retries, and source health

- bounded schedules and due-job selection;
- deterministic exponential backoff with bounded jitter input;
- retry exhaustion and dead-job handling;
- expired-lease crash recovery;
- source-health projection and privacy-bounded Phase 3 learning events.

### 4D — Version activation, rollback, and ingestion gate

- atomic project/source/version activation;
- failed activation leaves the previous corpus active;
- rollback to a compatible prior revision;
- zero mixed-version active chunks;
- `npm run gate:ingestion`, CI artifact, measured review, and roadmap transition.

## Testing strategy

The phase gate will seed multiple projects, sources, versions, refresh orders, unchanged refreshes, changed documents, deletions, worker crashes, retries, activation failures, and rollback. It must verify exact state/history reconciliation and rerun all prior gates.

## Rollback plan

- Before slice 4D, new job and staged-revision tables are additive and can be disabled without changing the active corpus.
- Activation always records the previous active revision.
- Rollback validates project, source, and version compatibility before switching pointers.
- No destructive cleanup occurs in the activation transaction; retired revisions remain available for rollback until a later explicit retention policy.

## Release thresholds

- exact duplicate job replay creates one job;
- conflicting idempotency replay is blocked;
- invalid and stale transitions are blocked;
- live leases cannot be stolen;
- expired leases recover deterministically;
- unchanged refresh creates zero new document revisions and chunks;
- deletions disappear only on successful activation;
- any failed job or activation leaves prior active corpus unchanged;
- rollback restores the exact prior corpus;
- zero active mixed-version chunks;
- `npm run check`, `gate:hono`, `gate:widget`, and `gate:learning` remain green.

## Known external blockers

- no deployed scheduler or real source refresh evidence;
- public widget pilot remains incomplete;
- independent Phase 1 benchmark review remains 0/15;
- credentialed hosted-model benchmark remains incomplete.

Synthetic fixtures may establish the engineering gate but cannot be represented as real deployed-refresh evidence.
