# Phase 3 Schema Notes

The first migration creates `public.learning_events` as the immutable source of truth for Phase 3 analytics.

- The primary key is `(project_id, event_id)`.
- RLS uses the existing `public.owns_project(uuid)` helper.
- Authenticated and anonymous roles cannot update or delete events.
- Derived metrics, clusters, and health projections are added in slice 3B and are rebuildable.
- Service processes may ingest normalized events, but public browser tokens never receive direct database access.
