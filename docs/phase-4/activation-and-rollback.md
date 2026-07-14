# Atomic Activation and Rollback Contract

## Activation

Activation is the only operation allowed to change which corpus is visible for a `(project, source, version, runtime)` scope.

Before any mutation, the implementation verifies:

- the candidate belongs to the requested project and source;
- manifest project, source, version, and runtime match the revision;
- the candidate is staged and inactive;
- document membership exactly matches the manifest;
- every document content and metadata hash matches its manifest item;
- no duplicate locator or chunk identity exists;
- quarantined content has no searchable chunks;
- the expected active revision still owns the scope;
- the staged revision was not built from a superseded active revision.

Only after all checks and the commit guard succeed does the implementation retire the prior active revision and activate the candidate. A thrown error leaves both records and the active pointer unchanged.

## Rollback

Rollback can select only a retained revision that was previously active and has exactly the same project, source, version, and runtime as the current active corpus. It validates membership again before switching. The current revision becomes `rolled_back`; the target becomes active; all original document and chunk identities are restored.

## Isolation and version safety

Active pointers are keyed by project, source, version, and runtime. Multiple versions or runtimes may be active independently, but a single scope can have exactly one active revision. Retrieval must use the matching scope and cannot combine active chunk identities from different version/runtime keys.

## Auditability

Every activation and rollback records the prior revision, target revision, actor, scope, timestamp, locator count, and chunk count. The SQL audit table is append-only.
