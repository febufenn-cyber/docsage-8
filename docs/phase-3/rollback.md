# Phase 3 Rollback

The learning pipeline is downstream of answering and can be disabled without changing public answers.

1. Stop learning-event writers.
2. Disable operator learning routes.
3. Keep the append-only events for forensic verification unless a later approved deletion workflow requires removal.
4. Drop and rebuild derived projections as needed.
5. Revert a Phase 3 slice by reverting its squash commit on `main`.

The Phase 3 migration does not mutate source revisions, chunks, retrieval runs, answers, citations, widget tokens, or feedback API behavior.
