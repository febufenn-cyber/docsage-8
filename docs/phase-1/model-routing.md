# Phase 1 Model Routing Decision

Status: **selected; hosted route not yet benchmarked**

## Reference gate route

The committed, keyless engineering gate uses:

- hybrid lexical retrieval plus deterministic hash-vector similarity;
- reciprocal-rank fusion and structure/identifier bonuses;
- evidence-extractive answering;
- deterministic claim-to-evidence validation.

This route is reproducible in CI, costs no external model tokens, and proves source lineage, retrieval, citation, policy, and abstention behavior. It is not represented as the production semantic-quality ceiling.

## Selected hosted production route

| Stage | Selected model | Purpose |
|---|---|---|
| Embeddings | `@cf/qwen/qwen3-embedding-0.6b` | query and document embeddings |
| Reranking | `@cf/baai/bge-reranker-base` | relevance ranking of hybrid candidates |
| Direct answer | `claude-haiku-4-5` | low-cost answers from sufficient evidence |
| Synthesis/conflict | `claude-sonnet-5` | multi-source synthesis, ambiguity, and conflict explanation |

The repository includes Cloudflare REST adapters for the embedding and reranking models and an Anthropic provider boundary for Claude.

## Routing policy

1. Navigation questions may return sources without generation.
2. Direct, sufficient evidence uses the direct answer route.
3. Multi-source, comparison, version, or conflict questions use the synthesis route.
4. Missing or unsafe evidence uses deterministic policy responses.
5. A hosted provider failure never authorizes an unsupported answer.

## Credential requirements

Hosted evaluation requires:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
ANTHROPIC_API_KEY
CLAUDE_MODEL
```

Credentials are not stored in the repository. Until a credentialed hosted benchmark is recorded, the Phase 1 release decision remains conditional even when the keyless engineering gate passes.
