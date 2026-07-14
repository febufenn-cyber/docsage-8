# DocSage Remaining Phases — Autonomous Implementation Plan

Status: **AUTHORITATIVE BUILD PLAN**

Last verified against `main`: pending merge of this plan.

## How many phases remain?

Four numbered product phases remain:

1. **Phase 3 — Learning Console**
2. **Phase 4 — Reliable Ingestion**
3. **Phase 5 — Commercial Foundation**
4. **Phase 6 — Documentation Intelligence**

A separate **readiness-closure track** remains active across these phases. It is not a new numbered phase:

- deploy the Phase 2 widget on at least one real public documentation site;
- complete 15 independent human reviews of the Phase 1 benchmark;
- run the credentialed Cloudflare embedding/reranking and Claude hosted-route benchmark.

Engineering work may continue while those external items are incomplete, but no phase may silently mark them complete or claim production validation without evidence.

---

# 1. Autonomous build command

When the user says **`build`**, DocSage development follows this rule:

- build the lowest-numbered incomplete phase in this document;
- verify the current repository and phase prerequisites before changing code;
- execute the complete phase in sequential reviewable slices;
- after every slice, commit, push, open a pull request, wait for all required CI gates, merge into `main`, and verify the new `main` head;
- continue to the next slice without asking for confirmation;
- stop only for an actual safety restriction, unavailable mandatory credential, destructive external action, merge conflict that cannot be resolved safely, or a failing gate that requires user-owned information.

The command **`build phase N`** selects a specific remaining phase. If that phase depends on an incomplete earlier phase, the earlier prerequisite is built first.

The command does not authorize:

- weakening test or evaluation thresholds;
- inventing pilot, revenue, human-review, or hosted-model evidence;
- committing secrets;
- bypassing branch protection;
- deleting production data;
- enabling paid external services without existing credentials and explicit repository configuration;
- merging failing code.

---

# 2. Required preflight verification

Before each numbered phase, the implementation agent must verify and record:

## Repository state

- `main` is the default base and contains all previously merged phase commits.
- No earlier phase pull request is still open or partially merged.
- The latest required GitHub Actions jobs are green.
- The repository roadmap and this document agree on the next incomplete phase.
- Existing migrations, API contracts, tests, and public interfaces are inspected before design decisions are frozen.

## Prior gates

The agent must rerun or preserve regression coverage for:

- `npm run check`
- `npm run gate:hono`
- `npm run gate:widget`
- every gate introduced by later phases

A phase-specific gate must be additive. It cannot replace earlier truth-engine, security, widget, or evaluation gates.

## External blockers

The preflight report must state the current evidence for:

- independent benchmark review count;
- hosted-model benchmark status;
- public pilot deployment status;
- external provider credentials required by the selected phase;
- any payment, email, GitHub App, DNS, or deployment action requiring user-controlled accounts.

Unavailable external inputs become explicit `CONDITIONAL_GO` blockers. They do not justify fake fixtures being described as production evidence.

## Phase lock document

Before implementation code, create or update:

```text
docs/phase-N/implementation-plan.md
```

It must contain:

- objective and non-goals;
- inspected current architecture;
- frozen data and API contracts;
- migration plan;
- threat-model additions;
- implementation slices;
- testing strategy;
- rollback plan;
- release thresholds;
- known external blockers.

The phase lock document is committed in the first slice. The remaining slices then implement that frozen plan. Material deviations require updating the phase document with a reason and rerunning affected gates.

---

# 3. Standard commit, PR, merge, and confirmation protocol

Each implementation slice uses this sequence:

1. Create `agent/phase-N-<slice>` from the latest verified `main`.
2. Implement only the documented slice.
3. Run applicable local or deterministic checks.
4. Commit with a focused message.
5. Push the branch.
6. Open a ready-for-review pull request targeting `main`.
7. Wait for every required GitHub Actions job.
8. Fix the earliest causal failure without lowering thresholds.
9. Confirm the pull request is mergeable and its head SHA has not moved unexpectedly.
10. Squash-merge unless preserving multi-commit ancestry is materially necessary.
11. Confirm the merge commit or squash commit exists on `main`.
12. Confirm the changed files are readable from `main`.
13. Record the merge SHA in the phase review.
14. Start the next slice from that new `main` head.

The completion message for every slice and phase must report:

- branch;
- pull-request number and link;
- validated head SHA;
- CI jobs and results;
- merge SHA on `main`;
- current `main` head;
- gates passed;
- remaining blockers or limitations.

---

# 4. Phase 3 — Learning Console

## Purpose

Turn answer traces, refusal states, citations, retrieval diagnostics, source health, and user feedback into a usable operator learning loop.

The forcing question is:

> Can a documentation owner understand what users ask, why DocSage succeeds or fails, and which documentation improvements deserve attention without exposing private question content unnecessarily?

## Non-goals

Phase 3 does not add:

- billing;
- customer self-service onboarding;
- multi-organization administration;
- private-source ingestion;
- autonomous documentation edits;
- broad product analytics unrelated to documentation quality;
- unrestricted storage of raw user text.

## Proposed slices

### 3A — Contract, privacy, and event schema

Implement:

- event taxonomy for answer, refusal, retrieval, citation, feedback, and source-health outcomes;
- privacy levels and retention fields;
- redaction and hashing rules;
- trace-to-feedback linkage;
- Postgres migrations and RLS for operator-only analytics;
- phase-specific threat-model updates;
- deterministic fixtures.

Primary records:

- `answer_events`
- `retrieval_events`
- `citation_events`
- `feedback_events`
- `source_health_events`
- `failure_classifications`

Required principle: raw questions are optional, separately controlled, and never required for aggregate metrics.

### 3B — Classification and aggregation pipeline

Implement:

- normalization of Phase 1 and Phase 2 traces into learning events;
- failure taxonomy assignment;
- unanswered and low-confidence clustering;
- daily/project/source aggregates;
- duplicate suppression and idempotent event ingestion;
- bounded retention and deletion jobs;
- replayable deterministic aggregation tests.

### 3C — Operator API and console UI

Implement a read-only operator console with:

- overview scorecards;
- answer-state and feedback trends;
- unanswered-question clusters;
- citation/source coverage;
- source-health status;
- failure drill-down with safe trace evidence;
- filters by time, runtime, version, source, state, and failure class;
- keyboard-accessible tables and charts;
- no cross-project data leakage.

The initial console may use a development/operator access boundary. Full customer organization membership belongs to Phase 5.

### 3D — Learning gate and review

Add:

- `npm run gate:learning`
- seeded event replay;
- aggregate correctness tests;
- privacy/redaction tests;
- cross-project isolation tests;
- accessibility contract checks;
- performance budget checks;
- machine-readable gate artifact;
- `reviews/phase-3-learning-console-review.md`.

## Phase 3 exit gates

- 100% idempotent event-ingestion tests pass.
- 100% cross-project isolation tests pass.
- Required redaction fixtures leak zero configured secrets or personal fields.
- Aggregate counts reconcile exactly with seeded source events.
- Every surfaced failure links to a valid trace or aggregate evidence record.
- Console has no unsafe HTML rendering path.
- Keyboard and ARIA contract tests pass.
- p95 aggregate API latency is within the documented local/reference budget.
- Earlier Hono and widget gates remain green.

## Phase 3 decision

- `GO_TO_PHASE_4`: engineering gate passes and at least one real pilot produces learning events.
- `CONDITIONAL_GO`: engineering gate passes but pilot evidence is absent.
- `REPEAT_PHASE_3`: data correctness, isolation, privacy, accessibility, or performance gate fails.

---

# 5. Phase 4 — Reliable Ingestion

## Purpose

Replace one-shot source loading with a durable, revision-aware ingestion system that can refresh public documentation safely and explain every corpus change.

The forcing question is:

> Can DocSage continuously keep a project corpus current without duplicate chunks, stale deletions, mixed revisions, uncontrolled crawling, or silent data loss?

## Non-goals

Phase 4 does not add:

- private repositories;
- arbitrary browser automation;
- code execution from repositories;
- broad web search;
- customer billing;
- autonomous source mutation.

## Proposed slices

### 4A — Ingestion job and revision state machine

Implement:

- durable ingestion jobs and attempts;
- explicit states: queued, discovering, fetching, parsing, chunking, embedding, validating, activating, failed, cancelled;
- leases, heartbeats, idempotency keys, and resumable checkpoints;
- immutable source and document revisions;
- structured error categories;
- operator-visible run manifests.

### 4B — Incremental discovery and content diffs

Implement:

- sitemap, explicit URL, and public GitHub adapters;
- ETag, Last-Modified, commit, and content-hash comparisons;
- changed, unchanged, added, moved, and deleted document detection;
- tombstones and safe deactivation;
- chunk and embedding reuse when content is unchanged;
- canonical URL and redirect reconciliation;
- structure-aware document diff summaries.

### 4C — Scheduling, retries, and source health

Implement:

- bounded scheduler interface;
- exponential retry policy with terminal failure classes;
- concurrency and host budgets;
- redirect and SSRF revalidation on every fetch;
- source freshness SLOs;
- stale-corpus warnings;
- failure and recovery events consumed by the Phase 3 console.

A provider-neutral queue abstraction is required. A Cloudflare Queue adapter may be added, while deterministic tests use an in-memory adapter.

### 4D — Version-aware activation and ingestion gate

Implement:

- atomic corpus activation;
- current/legacy/version-labelled source sets;
- rollback to a prior active revision;
- mixed-version prevention;
- deletion propagation tests;
- crash-recovery tests;
- `npm run gate:ingestion`;
- `reviews/phase-4-reliable-ingestion-review.md`.

## Phase 4 exit gates

- Reprocessing an unchanged corpus creates zero duplicate active documents or chunks.
- Changed documents replace only affected revisions.
- Deleted documents disappear from active retrieval and remain auditable as tombstones.
- Failed jobs cannot partially activate a corpus.
- A prior corpus can be restored atomically.
- Retry, lease-expiry, and crash-resume tests pass.
- SSRF and redirect-security suites remain 100% green.
- Mixed-version retrieval tests report zero known contamination.
- Source-health events reach the Phase 3 learning pipeline.
- All earlier gates remain green.

## Phase 4 decision

- `GO_TO_PHASE_5`: engineering gate passes and a real source refresh completes successfully.
- `CONDITIONAL_GO`: deterministic and CI gates pass but no deployed scheduled refresh exists.
- `REPEAT_PHASE_4`: idempotency, activation, deletion, recovery, source safety, or version gate fails.

---

# 6. Phase 5 — Commercial Foundation

## Purpose

Add the tenancy, identity, usage, lifecycle, and payment boundaries required to operate DocSage as a real service.

The forcing question is:

> Can multiple organizations safely operate projects, understand usage, manage access, pay for service, and delete their data without any cross-tenant or accounting ambiguity?

## Non-goals

Phase 5 does not add:

- autonomous documentation PR creation;
- enterprise SAML unless separately approved;
- marketplace distribution;
- reseller accounting;
- unrestricted custom pricing logic;
- private-source support unless a dedicated security plan is first approved.

## Proposed slices

### 5A — Organizations, memberships, and authorization

Implement:

- organizations;
- memberships and roles;
- projects owned by organizations;
- service roles and operator boundaries;
- invitation lifecycle;
- project transfer rules;
- complete RLS and authorization tests;
- migration of the existing single-project model.

### 5B — Usage metering and quotas

Implement:

- immutable usage ledger entries;
- answer, embedding, reranking, ingestion, storage, and feedback meter types;
- idempotent meter writes;
- quota and overage decisions;
- usage summaries;
- cost attribution and reconciliation;
- abuse and replay protections.

### 5C — Plans and billing provider boundary

Implement:

- internal plan and entitlement model;
- provider-neutral billing interface;
- checkout, subscription, invoice, cancellation, grace-period, and webhook state machines;
- signed webhook verification;
- idempotent billing events;
- test-clock or fixture-based lifecycle tests;
- no dependency on billing-provider payloads inside core authorization logic.

The concrete billing provider must be verified against current official documentation when this phase begins. No provider is frozen by this roadmap document.

### 5D — Data lifecycle and auditability

Implement:

- organization/project export;
- deletion requests and delayed purge workflow;
- token revocation;
- audit events for sensitive actions;
- retention enforcement;
- billing and usage reconciliation report;
- `npm run gate:commercial`;
- `reviews/phase-5-commercial-foundation-review.md`.

## Phase 5 exit gates

- Cross-tenant access tests pass for every protected table and API.
- Role and invitation state-transition tests pass.
- Usage ledger is idempotent and reconciles exactly with seeded events.
- Quota decisions are deterministic and cannot be bypassed by replay.
- Billing webhooks reject invalid signatures and duplicate events safely.
- Subscription state never directly overrides project ownership or RLS.
- Export and deletion workflows have complete audit trails.
- Revoked tokens stop authorizing new widget requests within the documented propagation period.
- All earlier gates remain green.

## Phase 5 decision

- `GO_TO_PHASE_6`: engineering gate passes and a sandbox billing lifecycle completes end to end.
- `CONDITIONAL_GO`: internal commercial architecture passes but external billing or deployment evidence is incomplete.
- `REPEAT_PHASE_5`: tenancy, authorization, metering, billing, deletion, or audit gate fails.

---

# 7. Phase 6 — Documentation Intelligence

## Purpose

Close the product loop by turning verified answer failures and documentation gaps into evidence-backed draft improvements that humans can approve and publish.

The forcing question is:

> Can DocSage propose a useful documentation improvement from real failure evidence while preserving source authority, avoiding unsupported claims, and requiring explicit human approval before any repository change?

## Non-goals

Phase 6 does not add:

- automatic merges;
- direct writes to protected branches;
- undocumented product-behavior invention;
- issue or PR spam;
- code changes outside approved documentation paths;
- autonomous security, legal, pricing, or policy statements;
- private repository access without a later dedicated security phase.

## Proposed slices

### 6A — Documentation-gap model

Implement:

- gap candidates derived from Phase 3 clusters and Phase 4 source lineage;
- evidence bundles containing question clusters, answer states, citations, versions, runtimes, and source revisions;
- duplicate and already-addressed detection;
- severity, frequency, confidence, and expected-impact scoring;
- human-readable gap explanations.

### 6B — Evidence-constrained draft generation

Implement:

- draft types: clarification, example, troubleshooting step, missing cross-link, warning, version note;
- strict claim-to-evidence mapping;
- unsupported-claim rejection;
- source-style and heading-location suggestions;
- diff-size and path limits;
- generated-content disclosure;
- evaluation fixtures for accurate, incomplete, conflicting, and malicious evidence.

### 6C — Human approval workflow

Implement:

- review states: proposed, needs-evidence, approved, rejected, superseded, published;
- reviewer comments and revisions;
- explicit selected repository/path/base-revision confirmation;
- permission checks;
- immutable approval and publication audit events;
- no repository write before approval.

### 6D — GitHub draft PR integration and intelligence gate

Implement:

- GitHub App or connector boundary verified against current official documentation;
- branch creation from a pinned base SHA;
- documentation-path allowlists;
- commit and draft-PR creation only;
- no auto-merge;
- duplicate-PR prevention;
- stale-base and changed-source rejection;
- rollback/closure workflow;
- `npm run gate:intelligence`;
- `reviews/phase-6-documentation-intelligence-review.md`.

## Phase 6 exit gates

- Every draft material claim has valid evidence.
- Unsupported-claim and conflicting-source fixtures never produce an approvable draft.
- No write occurs without an explicit approval record.
- Repository path, base SHA, organization, and project scope are checked before publication.
- Duplicate gap and duplicate PR tests pass.
- Stale source or changed base revisions block publication.
- Generated PRs are drafts and cannot auto-merge.
- Audit records reconstruct who approved what evidence and what commit was published.
- At least one human-reviewed documentation improvement is accepted or rejected with recorded rationale before claiming product-loop validation.
- All earlier gates remain green.

## Phase 6 decision

- `PRODUCT_LOOP_VALIDATED`: all engineering gates pass and a real human-reviewed documentation proposal completes the workflow.
- `CONDITIONAL_GO`: engineering gate passes but no real proposal has completed human review.
- `REPEAT_PHASE_6`: evidence, approval, repository safety, duplication, audit, or publication gate fails.

---

# 8. Cross-phase architecture rules

The remaining phases must preserve these invariants:

1. **Truth before interface:** no console, billing state, or generated draft may override the answer constitution.
2. **Project isolation at retrieval time:** tenant filtering is never deferred until after retrieval or generation.
3. **Immutable lineage:** source, answer, learning, billing, and draft records bind to revisions and stable IDs.
4. **Untrusted content:** documentation, questions, feedback, provider responses, and repository files are data, never instructions.
5. **Human control:** no autonomous repository mutation or merge.
6. **Provider boundaries:** hosted models, queues, billing, email, and GitHub integrations remain replaceable adapters.
7. **No silent external claims:** deterministic fixtures are engineering evidence, not production, pilot, human-review, or revenue evidence.
8. **Additive gates:** every phase keeps all prior gates green.
9. **Rollback first:** migrations and activations require rollback or safe forward-repair plans.
10. **No secret exposure:** browser code, logs, artifacts, fixtures, and PR descriptions contain no credentials.

---

# 9. Expected final repository shape

By the end of Phase 6, the repository should contain:

```text
apps/
  api/
  cli/
  console/
  widget/
packages/
  answering/
  citations/
  chunking/
  contracts/
  core/
  embeddings/
  evaluation/
  evidence/
  feedback/
  ingestion/
  learning/
  metering/
  billing/
  organizations/
  authorization/
  documentation-intelligence/
  github-publication/
  normalization/
  reranking/
  retrieval/
  source-registry/
  widget/
  widget-api/
docs/
  phase-0/
  phase-1/
  phase-2/
  phase-3/
  phase-4/
  phase-5/
  phase-6/
  roadmap/
reviews/
  phase-1-truth-engine-review.md
  phase-2-widget-review.md
  phase-3-learning-console-review.md
  phase-4-reliable-ingestion-review.md
  phase-5-commercial-foundation-review.md
  phase-6-documentation-intelligence-review.md
```

This is a target shape, not permission to create empty packages. Packages are introduced only when their phase requires working code and tests.

---

# 10. Definition of completion

The remaining roadmap is complete only when:

- Phases 3, 4, 5, and 6 have each passed their engineering gates;
- every phase was merged sequentially into `main` through green pull requests;
- current `main` contains the phase reviews and machine-readable gate artifacts or generation scripts;
- real-world blockers are accurately labelled rather than simulated;
- the system can observe documentation failures, keep sources current, operate securely for organizations, and propose evidence-backed human-approved documentation improvements;
- the final response reports all merge SHAs, current `main`, unresolved external blockers, and the product-loop decision.
