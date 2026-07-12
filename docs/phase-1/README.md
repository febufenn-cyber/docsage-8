# Phase 1 — Truth Engine

Status: **implemented as a deterministic vertical slice; release gate not yet claimed**.

## What this branch adds

- Node 22, dependency-light truth-engine workspace.
- Public URL and SSRF validation with redirect revalidation support.
- Public GitHub repository ingestion adapter with pinned refs and secret quarantine.
- Structure-aware Markdown normalization.
- Stable, source-lineage-preserving chunks.
- Hybrid lexical and deterministic semantic retrieval.
- Project, version, runtime, active-revision, and authority metadata.
- Evidence assembly and conflict signals.
- Answer-state policy before generation.
- Extractive deterministic provider for tests.
- Optional Claude Messages API provider behind the same interface.
- Claim-to-evidence validation and citation output.
- Evaluation runner with JSONL artifacts and metrics.
- Supabase schema with project-scoped RLS.
- Synthetic mini corpus, security tests, retrieval tests, answer tests, and CI.

## What remains before Phase 1 can pass

The Phase 0 Hono benchmark is still marked `candidate`. The implementation therefore must not claim the Phase 1 quality gate yet.

Required evidence work:

1. Pin the exact Hono docs snapshot and `honojs/hono` commit.
2. Review and verify at least 60 benchmark cases.
3. Materialize the approved Hono corpus locally or in controlled object storage.
4. Run the truth engine against that corpus using the selected production embedding and answer providers.
5. Record retrieval recall, citation entailment, abstention, adversarial, latency, and cost results.
6. Complete `reviews/phase-1-truth-engine-review.md` with a go/no-go decision.

## Local commands

```bash
npm test
npm run validate:evals
npm run corpus:mini
npm run demo
npm run ask -- --question "How do I read a path parameter?"
npm run eval:mini
```

To use the optional Claude provider:

```bash
export ANTHROPIC_API_KEY=...
export CLAUDE_MODEL=...
npm run ask -- --provider claude --question "How do I read a path parameter?"
```

The model name is deliberately configuration, not a hard-coded product assumption.

## Architectural boundaries

- The application selects project, version, runtime, and active revisions.
- The provider receives an already selected evidence packet.
- Retrieved content is labelled as untrusted evidence.
- The provider has no tools.
- Unsupported claims are removed or downgrade the answer.
- Candidate benchmark mode is available only for smoke runs and is visibly recorded.
