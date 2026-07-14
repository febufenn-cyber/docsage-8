# Phase 3 Privacy Boundary

Phase 3 uses data minimization rather than retrospective cleanup.

1. Sensitive values are redacted before persistence.
2. Raw questions are not part of the normalized event schema.
3. Fingerprints are salted per project, preventing cross-project correlation.
4. Excerpts are bounded to 240 characters and redacted again independently.
5. Metadata is flat, bounded, and strips raw-text and secret-bearing keys.
6. The console receives only normalized project-scoped projections.
7. Browser lifecycle events do not contain question or answer text.

A later commercial data-lifecycle phase may add retention controls and deletion workflows. Phase 3 keeps every derived projection rebuildable so those workflows do not require preserving hidden copies.
