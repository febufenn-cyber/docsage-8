# Phase 3 Security Checklist

- [x] Raw questions absent from normalized event objects.
- [x] Email, IP, bearer-token, API-key-like, long-token, and URL private parts are redacted.
- [x] Question fingerprints are salted per project.
- [x] Event replay is idempotent per project.
- [x] Conflicting event-ID reuse is rejected.
- [x] Metadata is flat, bounded, and strips dangerous keys.
- [x] Database events are append-only for authenticated and anonymous roles.
- [x] RLS checks project ownership.
- [ ] Aggregates reconcile exactly — slice 3B.
- [ ] Operator endpoints enforce project access — slice 3C.
- [ ] Console safe-rendering gate — slice 3C/3D.
