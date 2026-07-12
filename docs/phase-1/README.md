# Phase 1 — Truth Engine

Status: **engineering gate implemented; hosted-production and independent-review gates remain explicit**.

## What this branch adds

- Node 22, dependency-light truth-engine workspace.
- Public URL and SSRF validation with redirect revalidation support.
- Public GitHub repository ingestion adapter with pinned refs and secret quarantine.
- Structure-aware Markdown normalization and stable source-lineage-preserving chunks.
- Project, version, runtime, active-revision, and authority metadata.
- Hybrid lexical and deterministic semantic retrieval with exact-identifier and structure signals.
- Evidence assembly without false numeric-conflict inference.
- Answer-state policy before generation.
- Evidence-extractive deterministic provider for reproducible gates.
- Optional Claude Messages API provider behind the same interface.
- Cloudflare embedding and reranking REST adapters.
- Claim-to-evidence validation and citation output.
- Evaluation runner with JSONL artifacts, metrics, thresholds, and a decision report.
- Supabase schema with project-scoped RLS.
- Security, retrieval, normalization, answer, and evaluation tests.

## Pinned Hono corpus

The engineering benchmark uses immutable official source revisions:

- `honojs/website@bad29e3d87b8509f8a2982084dc29e9ba098549d`
- `honojs/hono@d3f97caa29bba1f1ae31a4e023c25224aa2a4261`

`evals/corpora/hono/corpus-manifest.json` records every selected path and expected Git blob SHA. `npm run corpus:hono` fetches those exact blobs, rejects mismatches, creates normalized chunks, and writes a corpus lock.

## Benchmark verification

`npm run verify:hono`:

1. loads the 76 Phase 0 candidate cases;
2. applies recorded corrections from `evals/reviews/hono-phase1-review.json`;
3. verifies all cited sources exist in the pinned corpus;
4. verifies required evidence terms occur in source bytes;
5. requires at least 60 verified cases;
6. rejects any unverified high-risk answerable case.

This is a tool-assisted primary review. The constitutionally required independent human review remains separately tracked and cannot be self-certified by the implementation agent.

## Gate commands

```bash
npm run check
npm run gate:hono
```

The gate writes:

```text
.tmp/hono-corpus/corpus-lock.json
.tmp/hono-benchmark/verified.jsonl
.tmp/hono-benchmark/review-report.json
.tmp/hono-eval/results.jsonl
.tmp/hono-eval/metrics.json
.tmp/hono-eval/report.md
.tmp/hono-eval/gate.json
```

## Two gates, not one misleading score

### Keyless engineering gate

Runs in CI with the deterministic evidence route and tests:

- pinned-source integrity;
- retrieval recall;
- high-risk recall;
- answer-state correctness;
- concept coverage;
- forbidden-claim safety;
- citation validation;
- abstention;
- adversarial behavior;
- version/conflict behavior;
- latency;
- zero external variable cost.

### Hosted-production gate

The selected hosted route is documented in [`model-routing.md`](model-routing.md). It requires Cloudflare and Anthropic credentials and must be benchmarked before Phase 2 is treated as production-ready.

## Local commands

```bash
npm test
npm run validate:evals
npm run corpus:mini
npm run demo
npm run ask -- --question "How do I read a path parameter?"
npm run eval:mini
npm run gate:hono
```

To use the optional Claude provider:

```bash
export ANTHROPIC_API_KEY=...
export CLAUDE_MODEL=...
npm run ask -- --provider claude --question "How do I read a path parameter?"
```

## Architectural boundaries

- The application selects project, version, runtime, and active revisions.
- The provider receives an already selected evidence packet.
- Retrieved content is untrusted evidence.
- The provider has no tools.
- Unsupported claims are removed or downgrade the answer.
- Candidate benchmark mode remains visibly distinct from verified gate mode.
