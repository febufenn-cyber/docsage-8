# DocSage

> A drop-in documentation Q&A system for OSS and developer-tool sites that answers from approved sources and shows evidence.

DocSage is being developed as a **documentation intelligence loop**, not merely a generic chatbot:

```text
question → grounded answer → failure classification → documentation gap → proposed improvement
```

## Current status

- **Phase 0:** position and benchmark merged into `main`.
- **Phase 1:** truth engine and pinned Hono engineering gate merged; external validation remains incomplete.
- **Phase 2:** single-project widget engineering gate passed; public pilot remains incomplete.
- **Phase 3:** learning-console engineering implementation complete; real pilot learning events remain incomplete.
- **Phases 4–6:** planned in the autonomous remaining-phases roadmap.

Start here:

- [Phase 0 index](docs/phase-0/README.md)
- [Phase 1 index](docs/phase-1/README.md)
- [Phase 2 index](docs/phase-2/README.md)
- [Phase 3 index](docs/phase-3/README.md)
- [Remaining phases autonomous implementation plan](docs/roadmap/remaining-phases.md)
- [Machine-readable remaining phases manifest](docs/roadmap/remaining-phases.manifest.json)
- [Widget API contract](docs/phase-2/widget-api.md)
- [Widget embed guide](docs/phase-2/embed.md)
- [Learning event contract](docs/phase-3/event-contract.md)
- [Learning operator console](docs/phase-3/operator-console.md)
- [Answer constitution](docs/phase-0/answer-constitution.md)
- [Threat model](docs/phase-0/threat-model.md)
- [Model routing decision](docs/phase-1/model-routing.md)
- [Phase 1 gate review](reviews/phase-1-truth-engine-review.md)
- [Phase 2 gate review](reviews/phase-2-widget-review.md)
- [Phase 3 gate review](reviews/phase-3-learning-console-review.md)

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

## Phase 2 widget

The embeddable widget includes:

- signed public project tokens and exact/wildcard origin allowlists;
- bounded config, answer, and feedback APIs;
- separate answer and feedback rate limiting;
- accessible Shadow DOM UI with citations and useful refusal states;
- controlled idempotent useful/not-useful feedback;
- light, dark, and automatic themes;
- a dependency-free local demo;
- a machine-readable widget gate and CI artifact.

Run:

```bash
npm run demo:widget
npm run gate:widget
```

## Phase 3 learning console

The learning loop now includes:

- privacy redaction before persistence;
- project-salted question fingerprints and bounded redacted excerpts;
- append-only project-RLS learning events;
- idempotent replay and conflict detection;
- deterministic outcome classification;
- order-independent daily metrics, clusters, feedback, and source health;
- exact aggregate reconciliation and rebuild support;
- authorization-before-read operator APIs;
- a dependency-free accessible Shadow DOM console;
- safe text-only rendering of untrusted excerpts;
- a machine-readable learning gate and CI artifact.

Run:

```bash
npm run gate:learning
```

Synthetic gate events prove engineering behavior. They are not represented as real pilot evidence.

## Autonomous remaining-phase workflow

Three phases remain incomplete: Phase 4 through Phase 6. When the user says `build`, the repository plan selects the next incomplete phase and executes its sequential slices. Every slice must be committed, pushed, validated by CI, merged into `main`, and verified on `main` before the next slice begins.

The plan is checked by:

```bash
npm run validate:roadmap
```

It does not permit lowering gates, inventing external evidence, committing secrets, or merging failing code.

## Product wedge

The first customer profile is a small API, SDK, infrastructure, or developer-tool company with:

- public English documentation;
- one public GitHub repository;
- recurring setup, integration, and troubleshooting questions;
- a founder, developer advocate, documentation owner, or support lead who can run a pilot.

The first release remains read-only and public-source-only. Private repositories, account-specific support, autonomous writes, enterprise SSO, and broad integrations are deliberately excluded.

## Phase roadmap

1. **Phase 0 — Position and benchmark:** merged.
2. **Phase 1 — Truth engine:** engineering gate passed; external gates remain explicit.
3. **Phase 2 — Single-project widget:** engineering gate passed; public pilot pending.
4. **Phase 3 — Learning console:** engineering gate implemented; real pilot events pending.
5. **Phase 4 — Reliable ingestion:** next; revisions, incremental refresh, deletions, retries, and version awareness.
6. **Phase 5 — Commercial foundation:** planned; organizations, RLS, usage, billing, deletion, and auditability.
7. **Phase 6 — Documentation intelligence:** planned; evidence-backed doc drafts and human-approved GitHub pull requests.

## Business hypothesis

| Item | Hypothesis |
|---|---|
| Monetization | $99–$499 per documentation site per month |
| First customer | Small developer-tool startup with public docs |
| GTM wedge | Free OSS tier or badge-led distribution, followed by paid commercial projects |
| Competition | Kapa, Inkeep, Mendable, internal RAG builds, and improved documentation search |
| Defensibility | Evaluation data, source revision lineage, failure classification, and the documentation improvement loop |

No public production service exists yet.
