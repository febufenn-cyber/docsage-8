# DocSage

> A drop-in documentation Q&A system for OSS and developer-tool sites that answers from approved sources and shows evidence.

DocSage is being developed as a **documentation intelligence loop**, not merely a generic chatbot:

```text
question → grounded answer → failure classification → documentation gap → proposed improvement
```

## Current status

- **Phase 0:** merged into `main`.
- **Phase 1:** truth engine and pinned Hono engineering gate merged into `main`.
- **Phase 2:** single-project widget engineering gate passed; public pilot remains incomplete.

Start here:

- [Phase 0 index](docs/phase-0/README.md)
- [Phase 1 index](docs/phase-1/README.md)
- [Phase 2 index](docs/phase-2/README.md)
- [Widget API contract](docs/phase-2/widget-api.md)
- [Widget embed guide](docs/phase-2/embed.md)
- [Answer constitution](docs/phase-0/answer-constitution.md)
- [Threat model](docs/phase-0/threat-model.md)
- [Model routing decision](docs/phase-1/model-routing.md)
- [Phase 1 gate review](reviews/phase-1-truth-engine-review.md)
- [Phase 2 gate review](reviews/phase-2-widget-review.md)

## Truth-engine capabilities

The Phase 1 implementation includes:

- immutable source-revision lineage;
- safe public-source ingestion;
- structure-aware Markdown normalization and chunking;
- project, version, runtime, authority, and active-revision filtering;
- hybrid lexical and deterministic semantic retrieval;
- evidence assembly and answer-state selection;
- evidence-backed claim validation and citations;
- policy handling for account-specific, unsafe, historical-version, conflict, and undocumented questions;
- Supabase/pgvector schema with project-scoped RLS;
- CLI, unit/security tests, CI, and evaluation artifacts.

## Pinned engineering benchmark

The reproducible Hono gate pins:

```text
honojs/website@bad29e3d87b8509f8a2982084dc29e9ba098549d
honojs/hono@d3f97caa29bba1f1ae31a4e023c25224aa2a4261
```

Run:

```bash
npm install
npm run check
npm run gate:hono
```

The gate fetches exact Git blobs, verifies hashes, materializes the reviewed benchmark, runs the truth engine, and writes a machine-readable decision.

## Planned production route

```text
Cloudflare Workers + Hono
        ↓
Supabase Postgres + Auth + RLS + pgvector
        ↓
Qwen3 embeddings + BGE reranking
        ↓
Claude direct/synthesis routes
        ↓
embeddable widget + learning console
```

The hosted models require external credentials and are not confused with the keyless CI reference route.

## Phase 2 product slice

The embeddable widget now includes:

- one public project and active corpus;
- signed public widget tokens;
- explicit exact and wildcard origin allowlists;
- bounded config, answer, and feedback APIs;
- separate answer and feedback rate limiting;
- accessible Shadow DOM UI;
- citations and useful refusal states;
- controlled useful/not-useful feedback;
- idempotent feedback events;
- light, dark, and automatic themes;
- a dependency-free local demo;
- a machine-readable widget gate and CI artifact.

Reference Phase 2 gate result:

```text
Decision: CONDITIONAL_GO
Engineering checks: all passed
Widget gzip size: 5,136 bytes
Forbidden source patterns: 0
Answer state: supported
Safe citations: 8
Refusal state: account_specific
Feedback entries after duplicate submission: 1
```

Run:

```bash
npm run demo:widget
npm run gate:widget
```

Phase 2 does not introduce billing, private sources, multi-project administration, end-user accounts, autonomous actions, or production-readiness claims for the unexecuted hosted-model route.

## Product wedge

The first customer profile is a small API, SDK, infrastructure, or developer-tool company with:

- public English documentation;
- one public GitHub repository;
- recurring setup, integration, and troubleshooting questions;
- a founder, developer advocate, documentation owner, or support lead who can run a pilot.

The first release is read-only and public-source-only. Private repositories, account-specific support, autonomous writes, enterprise SSO, and broad integrations are deliberately excluded.

## Phase roadmap

1. **Phase 0 — Position and benchmark:** merged.
2. **Phase 1 — Truth engine:** merged with a pinned engineering gate; external gates remain explicit.
3. **Phase 2 — Single-project widget:** engineering gate passed; public pilot pending.
4. **Phase 3 — Learning console:** failure triage, unanswered clusters, source health.
5. **Phase 4 — Reliable ingestion:** revisions, incremental refresh, deletions, retries, version awareness.
6. **Phase 5 — Commercial foundation:** organizations, RLS, usage, billing, deletion, auditability.
7. **Phase 6 — Documentation intelligence:** evidence-backed doc drafts and human-approved GitHub pull requests.

## Business hypothesis

| Item | Hypothesis |
|---|---|
| Monetization | $99–$499 per documentation site per month |
| First customer | Small developer-tool startup with public docs |
| GTM wedge | Free OSS tier or badge-led distribution, followed by paid commercial projects |
| Competition | Kapa, Inkeep, Mendable, internal RAG builds, and improved documentation search |
| Defensibility | Evaluation data, source revision lineage, failure classification, and the documentation improvement loop |

No public production service exists yet.
