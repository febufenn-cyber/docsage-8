# Phase 3 — Learning Console Implementation Plan

Status: **LOCKED FOR IMPLEMENTATION**

## Objective

Turn DocSage answer outcomes, refusal states, citations, source health, and bounded user feedback into a project-scoped operator learning loop without weakening the truth engine or collecting unnecessary personal data.

The Phase 3 forcing question is:

> Can a documentation owner understand what users ask, where the documentation fails, and what deserves attention while every stored event remains privacy-bounded, reproducible, isolated, and reconcilable?

## Preflight record

- Base branch: `main`.
- Verified base commit at phase start: `bd2e6e5ce952b0c088d9d37cdf5192e7d359ceac`.
- Open earlier-phase pull requests: none.
- Prior required PR validation: roadmap/test, widget gate, and pinned Hono gate green.
- Next incomplete roadmap phase: Phase 3.
- Phase 1 independent human review: incomplete, 0/15 recorded.
- Credentialed hosted-model benchmark: incomplete.
- Real public widget pilot: incomplete.
- No external credentials are required for the deterministic Phase 3 engineering gate.

The three incomplete readiness items remain external `CONDITIONAL_GO` blockers. They are not reclassified by this phase.

## Non-goals

Phase 3 does not add:

- billing, subscriptions, or quotas;
- multi-organization administration;
- private-source ingestion;
- raw prompt or answer logging by default;
- session replay, DOM capture, cookies, IP-address storage, or browser fingerprinting;
- autonomous documentation edits;
- semantic clustering by a paid hosted provider;
- support-agent access to customer production data;
- a claim that synthetic events are a real pilot.

## Inspected architecture

Phase 1 provides immutable source lineage, answer states, retrieval diagnostics, citation validation, and project-scoped persistence contracts. Phase 2 provides a public project-scoped widget token, bounded answer and feedback APIs, rate limiting, privacy-bounded browser events, and an idempotent feedback reference store.

Phase 3 must consume those existing contracts rather than create a parallel answer pipeline. Learning events are downstream observations; they cannot change an answer, citation, source revision, or evaluation result.

## Frozen event contract

### Event envelope

Every event contains:

- `eventId`: client- or server-generated UUID;
- `projectId`: required project scope;
- `type`: one of the approved learning event types;
- `occurredAt`: source timestamp;
- `receivedAt`: server timestamp;
- `traceId`: optional answer trace reference;
- `source`: `answer`, `widget`, `feedback`, `ingestion`, `evaluation`, or `system`;
- `schemaVersion`: initially `1`;
- privacy-safe event fields;
- bounded metadata from an allowlist.

Approved types for Phase 3:

- `answer.completed`;
- `answer.refused`;
- `feedback.recorded`;
- `source.health`;
- `evaluation.failed`.

### Question representation

Raw questions are not stored by default. When a trusted server process has a question, it produces:

- `questionFingerprint`: SHA-256 of a project salt plus normalized redacted text;
- `questionExcerpt`: bounded redacted text, maximum 240 characters;
- `redactionCount`: number of detected sensitive substitutions.

Redaction covers at least:

- email addresses;
- IPv4 addresses;
- bearer tokens;
- API-key-like assignments;
- long secret-like tokens;
- URL query strings and fragments.

The fingerprint is for deterministic grouping, not identity. Project salt prevents cross-project correlation.

### Metadata

Metadata is a flat JSON object. Keys and values are bounded. Prototype-pollution keys, nested objects, arrays, functions, and unexpected raw text fields are rejected or removed.

### Idempotency

The unique event key is `(project_id, event_id)`. Replaying the same normalized event returns the existing record. Reusing the same key with different normalized content is an idempotency conflict.

### Cross-project isolation

Stores and APIs require an explicit `projectId` for every read and write. Event IDs, trace IDs, fingerprints, and aggregate keys never grant cross-project access.

## Data model and migration

Phase 3 adds:

- `learning_events`: append-only normalized events;
- `learning_feedback`: optional normalized feedback projection;
- `learning_daily_metrics`: reproducible daily aggregates;
- `learning_clusters`: deterministic question/failure groups;
- `learning_source_health`: latest project/source health projection.

The first slice creates the event table and contracts. Later slices add projections and aggregation indexes. All tables use project-scoped RLS consistent with the existing `projects` ownership model.

## Threat-model additions

- **PII leakage:** redact before persistence and reject raw-text metadata keys.
- **Cross-tenant analytics:** require project scope in every store/API method and RLS policy.
- **Event forgery:** operator ingestion remains authenticated; public widget feedback continues through its signed-token boundary.
- **Replay amplification:** unique project/event keys and idempotent writes.
- **Poisoned metadata:** flat allowlisted bounded values only.
- **Stored XSS:** console renders all event-derived text using text nodes; URLs must be HTTP(S).
- **Aggregate drift:** all aggregates can be recomputed from immutable events and must reconcile exactly.
- **Trace disclosure:** public interfaces never expose retrieval packets, prompts, token claims, or provider payloads.
- **Deletion mismatch:** Phase 3 projections are derivable and can be rebuilt after later lifecycle deletion work.

## Implementation slices

### 3A — Contract, privacy, and event schema

- freeze this document;
- implement event normalization, redaction, fingerprinting, and metadata limits;
- implement a project-scoped idempotent memory store;
- add the initial Supabase migration;
- add unit and privacy tests.

### 3B — Classification and aggregation pipeline

- deterministic outcome/failure classification;
- deterministic cluster keys;
- daily metrics, question groups, feedback summaries, and source-health projections;
- exact reconciliation and rebuild support;
- tests for order independence, duplicate replay, and project isolation.

### 3C — Operator API and console UI

- operator authorization boundary;
- project-scoped summary, clusters, events, and source-health endpoints;
- bounded filters and pagination;
- dependency-free accessible console UI;
- safe rendering and asset-budget tests.

### 3D — Learning gate and review

- deterministic fixture corpus;
- machine-readable `npm run gate:learning` report;
- additive CI job and artifact;
- measured Phase 3 review;
- roadmap and README status update.

## Testing strategy

Required deterministic tests include:

- sensitive-value redaction;
- project-salted fingerprints;
- malformed and oversized event rejection;
- idempotent replay;
- idempotency conflict detection;
- same event ID permitted in separate projects;
- forbidden metadata removal;
- exact aggregate reconciliation;
- event-order-independent projections;
- cross-project API denial;
- stored-XSS payloads rendered as text;
- keyboard/ARIA markers in the console;
- earlier Phase 1 and Phase 2 gates remain green.

## Rollback plan

- Each slice is a separate squash-merged PR.
- Runtime additions are isolated under `packages/learning`, `apps/console`, and new API adapters.
- The learning pipeline is downstream and can be disabled without changing answer behavior.
- Database tables are additive; rollback disables writers/readers before any optional schema removal.
- Aggregates and clusters are projections and may be dropped and rebuilt from `learning_events`.
- No migration mutates Phase 1 source lineage or answer rows.

## Release thresholds

The engineering gate requires:

- 100% event-contract tests pass;
- 100% idempotency tests pass;
- 100% project-isolation tests pass;
- all seeded sensitive values absent from persisted normalized events;
- aggregate counts reconcile exactly with accepted events;
- rebuilding projections produces byte-equivalent canonical JSON;
- console has no `innerHTML`, `eval`, `new Function`, or inline event handlers;
- required keyboard and ARIA markers are present;
- console JavaScript remains at or below 60 KiB gzip;
- `npm run check`, `npm run gate:hono`, and `npm run gate:widget` remain green;
- `npm run gate:learning` produces a machine-readable decision.

## Decision policy

- `GO_TO_PHASE_4`: all engineering gates pass and a real pilot has produced learning events.
- `CONDITIONAL_GO`: engineering gates pass, but real-pilot or earlier external evidence is incomplete.
- `REPEAT_PHASE_3`: a privacy, isolation, reconciliation, API, accessibility, or console gate fails.
- `REDESIGN`: the event model cannot avoid unnecessary sensitive-data storage or cannot guarantee project isolation.

## Known blockers

- No real public documentation-site pilot event stream exists yet.
- Phase 1 independent review remains incomplete.
- Credentialed hosted-model benchmarking remains incomplete.

These blockers do not prevent deterministic engineering implementation, but they prevent a pilot-validated `GO_TO_PHASE_4` claim.
