# Phase 0 Architecture Decisions

Status: **Proposed for approval**

Each decision may be amended only with explicit context, consequences, and benchmark impact.

## ADR-001 — Cloudflare Workers and Hono for the API

**Decision:** Use Cloudflare Workers with Hono for the initial API and orchestration layer.

**Rationale:** The original blueprint targets an edge-deployable, TypeScript-first stack with a small operational footprint.

**Consequences:** CPU, duration, networking, and library constraints must be tested. Long crawling or embedding work may require queues and separate jobs.

**Revisit when:** Worker limits materially obstruct safe ingestion or reproducible evaluation.

## ADR-002 — Supabase Postgres, Auth, RLS, and pgvector

**Decision:** Use Supabase Postgres for relational state, Auth for customer access, RLS for tenant isolation, and pgvector for semantic retrieval.

**Consequences:** Vector search functions must accept and enforce project scope. Service-role access is narrowly isolated. RLS tests are release gates.

**Revisit when:** Scale, portability, or retrieval requirements exceed the platform without a safe path.

## ADR-003 — Public approved sources only

**Decision:** Phase 1 and the first pilot ingest public documentation and a public GitHub repository only.

**Consequences:** Private-repository OAuth, permission sync, confidential-data processing, and enterprise compliance are postponed.

**Revisit when:** The public-source pilot passes and qualified customers consistently require private content.

## ADR-004 — Hybrid retrieval

**Decision:** Combine vector retrieval, keyword/full-text retrieval, metadata filters, and reranking.

**Rationale:** Technical questions include semantic concepts as well as exact identifiers, error messages, headers, and commands.

**Consequence:** Evaluation reports each retrieval stage separately.

## ADR-005 — Structure-aware normalization and chunking

**Decision:** Preserve heading hierarchy, paragraphs, code blocks, tables, warnings, and examples as typed blocks before chunking.

**Consequence:** Fixed-size plain-text chunking alone is not acceptable.

## ADR-006 — Immutable source revision lineage

**Decision:** Answers reference source revisions and content hashes, not only URLs.

**Consequence:** Refresh, deletion, deprecation, re-embedding, and answer staleness become explicit operations.

## ADR-007 — Version and runtime are retrieval dimensions

**Decision:** Store version and runtime metadata and filter before generation.

**Consequence:** Unknown metadata remains unknown. The assistant asks or states assumptions rather than mixing scopes.

## ADR-008 — Retrieved content is untrusted evidence

**Decision:** Source text cannot change system rules or trigger tools.

**Consequence:** Evidence is clearly delimited, tool execution is absent from the answer model in the initial release, and injection tests are mandatory.

## ADR-009 — Evaluation is a release dependency

**Decision:** No Phase 1 completion or public quality claim without a pinned corpus, verified benchmark, reproducible runs, and threshold report.

**Consequence:** Evaluation code and data are first-class repository components.

## ADR-010 — No autonomous documentation writes

**Decision:** Initial documentation improvement output is advisory. Future GitHub changes require human review and explicit approval.

**Consequence:** No write-capable GitHub token is needed for the first pilot.

## ADR-011 — Answer state is richer than confidence

**Decision:** Use supported, partial, conflict, version/runtime ambiguity, not found, account-specific, out-of-scope, and unsafe states.

**Consequence:** A single confidence number cannot determine user posture.

## ADR-012 — Model provider is behind a controlled interface

**Decision:** Claude is the initial answer provider hypothesis, but prompts, evidence, outputs, usage, and failures are stored through a provider-neutral boundary.

**Consequence:** Provider replacement must not require rewriting ingestion, retrieval, policy, or evaluation.

## ADR-013 — Public widget follows the truth engine

**Decision:** Phase 1 may expose only a CLI/internal interface. The embeddable public widget begins after the truth-engine quality gate.

**Rationale:** Distribution must not precede trustworthy evidence behavior.

## ADR-014 — Hono is the initial benchmark corpus

**Decision:** Use official Hono documentation and `honojs/hono` as the engineering benchmark.

**Consequences:** Corpus revisions are pinned; Hono is not represented as a customer or partner; a later design-partner dataset supplements rather than silently replaces the benchmark.

## ADR-015 — Phase 0 policies are binding inputs

**Decision:** The Phase 0 documents are not aspirational prose. Phase 1 issues and tests must reference their requirements.

**Consequence:** Any intentional deviation requires an ADR amendment.
