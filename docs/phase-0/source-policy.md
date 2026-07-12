# Source Policy

## Approved-source principle

Each project has an explicit source registry. Retrieval is limited to active revisions in that registry. A source being public does not automatically make it approved.

## Initial hierarchy

Highest authority first:

1. Current official API reference.
2. Current official product documentation.
3. Explicit version-specific official documentation.
4. Official repository documentation and maintained examples.
5. Official migration guides.
6. Official changelog or release notes.
7. Official source comments when intentionally documented.
8. Official issues or discussions, only when enabled and never as silent authority.
9. Community content, disabled in the initial product.

Authority does not eliminate conflict. A higher-authority source may still be stale or scoped differently, so the system records version, runtime, and revision.

## Initial approved source types

- HTML documentation pages.
- Markdown and MDX in one public GitHub repository.
- Official migration guides and changelogs.
- Maintained examples explicitly selected by the project owner.

Not approved initially:

- arbitrary web pages;
- search-engine results;
- community blogs;
- scraped chat;
- private repositories;
- generated summaries;
- issue comments by unknown participants;
- cached copies without lineage.

## Required metadata

Every normalized document revision must include:

```text
organization_id
project_id
source_id
source_revision_id
source_type
authority_level
canonical_url
repository
branch
commit_sha
product_version
runtime_scope
language
document_title
heading_path
content_hash
published_at
source_updated_at
crawled_at
active_from
active_until
parser_version
```

Unknown fields are stored as unknown, not guessed.

## Revision model

```text
source
└── source revision
    └── document revision
        └── structured blocks
            └── chunks
                └── embedding revisions
```

Answers bind to revisions, not mutable URLs.

## Canonicalization

- Respect canonical URLs when safe and same-origin.
- Normalize trailing slashes and fragments without losing heading identity.
- Detect duplicate content by normalized hashes.
- Preserve aliases so old links can resolve to the canonical revision.
- Do not collapse pages across versions merely because text matches.

## Freshness

- Re-crawl active sources on a configured schedule or webhook.
- Hash before re-embedding.
- Deactivate deleted revisions rather than destroying lineage immediately.
- Do not retrieve inactive revisions for current-version answers.
- Mark answers potentially stale when a cited revision is superseded.
- Retain benchmark revisions immutably.

## GitHub rules

- Initial ingestion is read-only and public.
- Pin branch and commit for evaluations.
- Record file path and commit SHA.
- Ignore secrets and non-documentation paths by policy.
- Never treat arbitrary repository text as executable instructions.
- Do not ingest pull-request or issue content in the first release.

## Conflict resolution

Priority considerations:

1. user-specified version/runtime;
2. current project configuration;
3. source authority;
4. source recency within the same scope;
5. explicit deprecation or migration notices.

When these do not resolve the conflict, return `conflicting_sources`.

## Benchmark source registry

The initial registry is defined in `evals/datasets/hono-source-map.json`. It must be pinned to a review date and Git commit before Phase 1 scoring.
