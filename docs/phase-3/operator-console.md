# Phase 3 Operator API and Console

The learning console is an operator-only surface. It is not served through public widget tokens.

## API routes

```text
GET /v1/learning/projects/:projectId/summary
GET /v1/learning/projects/:projectId/clusters
GET /v1/learning/projects/:projectId/events
GET /v1/learning/projects/:projectId/source-health
```

Every request invokes the configured authorization callback with the explicit project ID before reading events or projections. A denied request returns `403` without falling back to global data.

Collection routes support bounded `limit` and `offset` values. Events may additionally filter by an approved event type and valid `since`/`until` timestamps. Clusters may filter by severity and actionable state.

The event response excludes metadata and question fingerprints. It includes only the bounded redacted excerpt and operational fields required for triage.

## Browser component

```html
<script type="module" src="/assets/docsage-learning-console.mjs"></script>
<docsage-learning-console
  endpoint="https://console.example.com"
  project-id="PROJECT_ID"
></docsage-learning-console>
```

The component uses same-origin operator credentials, `cache: "no-store"`, Shadow DOM, DOM text APIs, accessible tabs and tables, a live status region, responsive layout, and a 60 KiB gzip budget.

The console never stores authentication credentials in element attributes and does not use public widget tokens for operator access.
