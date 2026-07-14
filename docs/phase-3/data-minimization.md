# Learning Data Minimization Rules

1. Collect only fields needed to classify answer outcomes, feedback, and source health.
2. Redact before hashing and before excerpt storage.
3. Salt fingerprints per project.
4. Reject arbitrary nested metadata and known raw-text or secret keys.
5. Keep normalized event storage append-only.
6. Keep every aggregate derivable so future retention and deletion workflows can remove source events without hidden copies.
