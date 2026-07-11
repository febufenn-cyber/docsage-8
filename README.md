# Docsage

> drop-in docs Q&A widget for OSS and dev-tool sites that answers with cited sources.

**Alternative to the product-shape pioneered by Kapa.ai (YC S23)** — rank #8 of 500 in the [YC-500 Fable 5 Venture Blueprint](https://github.com/) (score 7.25/10).

## Why this exists
Proven that docs-to-answers deflects tickets for dev-tool companies at scale. The buildable wedge: ingest docs, embed, retrieve, answer with citations via claude and supabase pgvector.

## MVP scope
- [ ] Crawl docs + GitHub
- [ ] pgvector RAG
- [ ] embeddable chat widget
- [ ] citation links
- [ ] unanswered-question log

## Architecture
`Workers+Supabase(pgvector)+Claude` — Cloudflare Workers + Hono API, Supabase (Postgres + RLS + Auth + pgvector), Claude API via Agent SDK (claude-fable-5 for agent reasoning, claude-haiku-4-5 for volume), wrangler deploys.

**Integrations:** GitHub API; sitemap crawler; Claude API; Slack webhook
**Data:** Docs pages, embeddings, chat logs, unanswered questions
**Agent core:** Retrieval agent answers; escalation agent flags gaps and drafts new doc.

## Business
| | |
|---|---|
| Monetization | $99-499/mo per docs site |
| First customer | Small dev-tool startup with public docs |
| GTM wedge | Free tier + 'Ask AI' badge backlink; launch on OSS repos and Dev communities |
| Competition risk | High: Kapa, Inkeep, Mendable |
| Regulatory/trust risk | Low: public docs only |
| India angle | Serve Indian dev-tool startups (Hasura-style) needing cheap docs support. |
| Difficulty / build time | Medium / 2-3 weeks |

## 30-day plan
- **W1:** core loop — Crawl docs + GitHub + pgvector RAG
- **W2:** embeddable chat widget + citation links + unanswered-question log + auth + billing
- **W3:** polish, instrument events, seed first users via: Free tier + 'Ask AI' badge backlink; launch on OSS repos and Dev communities
- **W4:** launch + first revenue; kill/scale decision

---
*Built with Fable 5 (Claude Code). Blueprint row: inspired by Kapa.ai — "AI assistant that answers technical questions from a company's docs and content."*