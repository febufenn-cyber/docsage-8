# Incremental Refresh Contract

Phase 4 treats every discovery result as a canonical, content-addressed manifest.

## Canonicalization

- URL query strings and fragments are excluded from source identity.
- URL hostnames and default ports are normalized.
- Repository paths are slash-normalized, relative, and traversal-free.
- Discovery order does not affect the manifest hash.
- Duplicate locators with identical records collapse to one item.
- Duplicate locators with conflicting records fail the refresh.

## Diff categories

A next manifest is classified against the compatible previous revision as:

- `added`: new locator;
- `changed`: same locator with different content, metadata, or quarantine state;
- `unchanged`: exact content/metadata/quarantine match;
- `deleted`: locator absent from the next manifest.

## Reuse and deletion

An unchanged complete manifest returns the existing corpus revision and creates no document revisions or chunks. During a partial refresh, unchanged document revision and chunk identities are reused through corpus-revision membership records. Added and changed items receive new immutable document revisions. Deleted items become staged tombstones and remain searchable through the prior active corpus until the new corpus activates successfully.

## Safety invariants

- Building or staging a manifest cannot change the active corpus.
- Previous revisions must match the project and source.
- Version and runtime participate in active-corpus identity.
- Quarantined content participates in the manifest hash and cannot silently become searchable.
- Tombstones are auditable and only take effect during atomic activation.
