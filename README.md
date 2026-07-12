# DocSage

> A drop-in documentation Q&A widget for OSS and developer-tool sites that answers from approved sources and shows evidence.

DocSage is being developed as a **documentation intelligence loop**, not merely a generic chatbot:

```text
question → grounded answer → failure classification → documentation gap → proposed improvement
```

## Current status

**Phase 0: implemented for review.**

Phase 0 freezes the initial customer, product boundaries, truth contract, source policy, risk model, benchmark corpus, evaluation schema, economics envelope, and the gate for beginning Phase 1.

Start here:

- [Phase 0 index](docs/phase-0/README.md)
- [Product constitution](docs/phase-0/product-constitution.md)
- [Answer constitution](docs/phase-0/answer-constitution.md)
- [Pilot specification](docs/phase-0/pilot-specification.md)
- [Threat model](docs/phase-0/threat-model.md)
- [Evaluation policy](docs/phase-0/evaluation-policy.md)
- [Phase 0 decisions](docs/architecture/decisions/phase-0-decisions.md)
- [Hono benchmark manifest](evals/datasets/hono-phase0.manifest.json)

## Product wedge

The first customer profile is a small API, SDK, infrastructure, or developer-tool company with:

- public English documentation;
- one public GitHub repository;
- recurring setup, integration, and troubleshooting questions;
- a founder, developer advocate, documentation owner, or support lead who can run a pilot.

The first release is read-only and public-source-only. Private repositories, account-specific support, autonomous writes, enterprise SSO, and broad integrations are deliberately excluded.

## Planned architecture

```text
Cloudflare Workers + Hono
        ↓
Supabase Postgres + Auth + RLS + pgvector
        ↓
structure-aware ingestion + hybrid retrieval
        ↓
Claude answer generation with citation validation and abstention
        ↓
embeddable widget + learning console
```

The architecture remains a hypothesis until Phase 1 validates retrieval quality, citation support, latency, cost, and safety against the committed benchmark.

## Phase roadmap

1. **Phase 0 — Position and benchmark:** implemented in this repository.
2. **Phase 1 — Truth engine:** ingestion, structure-aware chunks, hybrid retrieval, answer states, citations, evaluation harness.
3. **Phase 2 — Single-project widget:** embeddable UI, feedback, domain controls, rate limits.
4. **Phase 3 — Learning console:** failure triage, unanswered clusters, source health.
5. **Phase 4 — Reliable ingestion:** revisions, incremental refresh, deletions, retries, version awareness.
6. **Phase 5 — Commercial foundation:** organizations, RLS, usage, billing, deletion, auditability.
7. **Phase 6 — Documentation intelligence:** evidence-backed doc drafts and human-approved GitHub pull requests.

## Original business hypothesis

| Item | Hypothesis |
|---|---|
| Monetization | $99–$499 per documentation site per month |
| First customer | Small developer-tool startup with public docs |
| GTM wedge | Free OSS tier or badge-led distribution, followed by paid commercial projects |
| Competition | Kapa, Inkeep, Mendable, internal RAG builds, and improved documentation search |
| Defensibility | Evaluation data, source revision lineage, failure classification, and the documentation improvement loop |

No production service exists yet. Phase 1 must pass the gate in [`docs/phase-0/README.md`](docs/phase-0/README.md) before a public widget is built.
