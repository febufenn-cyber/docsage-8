# Learning Event Contract

Every Phase 3 learning event is project-scoped, append-only, idempotent, and privacy-bounded.

## Stored by default

- project and event identifiers;
- approved event type and source;
- timestamps;
- optional trace reference;
- answer/refusal state;
- feedback rating and bounded reason;
- source-health or evaluation failure code;
- citation count and latency;
- project-salted question fingerprint;
- bounded redacted question excerpt;
- flat bounded metadata.

## Not stored by default

- raw questions;
- raw answers;
- prompts or model messages;
- retrieval packets;
- page DOM or form contents;
- cookies, IP addresses, authorization headers, or secrets;
- browser fingerprints.

## Idempotency

`(project_id, event_id)` is unique. An exact replay succeeds as a duplicate without creating a second event. Reuse with different normalized content is a conflict.

## Isolation

All reads and writes require an explicit project. PostgreSQL RLS uses `public.owns_project(project_id)`. Public widget tokens cannot read the learning store.
