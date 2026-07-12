# DocSage

> A drop-in documentation Q&A widget for OSS and developer-tool sites that answers from approved sources and shows evidence.

DocSage is being developed as a **documentation intelligence loop**, not merely a generic chatbot:

```text
question → grounded answer → failure classification → documentation gap → proposed improvement
```

## Current status

- **Phase 0:** implemented for review in PR #1.
- **Phase 1:** deterministic truth-engine vertical slice implemented for review; the verified Hono quality gate remains intentionally open.

Start here:

- [Phase 0 index](docs/phase-0/README.md)
- [Phase 1 implementation](docs/phase-1/README.md)
- [Phase 1 gate review](reviews/phase-1-truth-engine-review.md)
- [Product constitution](docs/phase-0/product-constitution.md)
- [Answer constitution](docs/phase-0/answer-constitution.md)
- [Threat model](docs/phase-0/threat-model.md)
- [Hono benchmark manifest](evals/datasets/hono-phase0.manifest.json)

## Truth-engine capabilities

The current Phase 1 branch includes:

- safe public URL validation and bounded fetching;
- pinned public GitHub repository ingestion support;
- structure-aware Markdown normalization and chunking;
- project-, version-, runtime-, revision-, and authority-aware retrieval;
- hybrid lexical and deterministic semantic retrieval;
- answer-state policy before model generation;
- extractive deterministic answers for tests;
- an optional provider-neutral Claude adapter;
- claim-to-evidence citation validation;
- a reproducible evaluation runner;
- a Supabase schema with project-scoped RLS;
- unit, security, retrieval, answer, and evaluation tests.

The deterministic hash embedding and synthetic mini corpus are engineering baselines, not production-quality claims. Phase 1 passes only after the candidate Hono benchmark is source-verified and the selected production routes meet the Phase 0 thresholds.

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npm run check
npm run demo
npm run ask -- --question "How do I read a path parameter?"
npm run eval:mini
```

Optional Claude-backed answering requires `ANTHROPIC_API_KEY` and an explicit `CLAUDE_MODEL` value.

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
provider-neutral answer generation with citation validation and abstention
        ↓
embeddable widget + learning console
```

## Phase roadmap

1. **Phase 0 — Position and benchmark:** implemented for review.
2. **Phase 1 — Truth engine:** vertical slice implemented; verified-corpus gate pending.
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

No public widget should be built until the Phase 1 truth-engine gate is independently reviewed.
