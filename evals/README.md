# DocSage Evaluations

## Contents

- `datasets/hono-source-map.json` — approved benchmark sources.
- `datasets/hono-phase0.manifest.json` — dataset manifest.
- `datasets/hono-phase0/part-*.jsonl` — 76 candidate evaluation cases in four shards.
- `schemas/evaluation-case.schema.json` — case schema.

## Important status

The records are generated as a **Phase 0 candidate benchmark**. They are not automatically ground truth. Before Phase 1 metrics are used as a gate:

1. Pin the Hono docs snapshot date.
2. Pin the `honojs/hono` commit SHA.
3. Review each case against the pinned source.
4. Correct required and forbidden concepts.
5. Promote accepted cases from `candidate` to `verified`.
6. Independently review at least 15 cases.
7. Assign development/holdout/adversarial splits without exposing holdout answers to tuning.

## JSONL rules

- One valid JSON object per line.
- Stable `id`.
- No duplicate questions unless testing controlled paraphrases.
- `answerable: false` cases have no invented expected answer.
- Every answerable verified case has at least one expected source.
- High-risk cases require direct authoritative evidence.
- Changing a verified expectation requires review notes.

## Suggested runner outputs

```text
runs/<run-id>/
├── manifest.json
├── retrieval.jsonl
├── answers.jsonl
├── claims.jsonl
├── scores.json
├── failures.jsonl
└── report.md
```

The run manifest should include source hashes, parser/chunker versions, retrieval configuration, model identifiers, prompt version, environment, timestamp, and costs.
