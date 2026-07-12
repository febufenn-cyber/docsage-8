# Threat Model

## Scope

This threat model covers the public-source, read-only pilot and the planned Cloudflare Workers, Hono, Supabase, pgvector, model-provider, crawler, widget, and admin-console boundaries.

## Assets

- Approved source registry and revisions.
- Normalized documents, chunks, and embeddings.
- Customer project metadata.
- User questions and conversation records.
- Evaluation datasets and raw run evidence.
- API keys, model credentials, database credentials, and webhook secrets.
- System prompts and policy configuration.
- Usage, cost, and billing records.
- Tenant and role boundaries.
- Reputation created by trustworthy citations.

## Trust boundaries

```text
public internet
  → crawler boundary
  → normalization boundary
  → storage / tenant boundary
  → retrieval boundary
  → model-provider boundary
  → answer / citation boundary
  → public widget

customer admin
  → authentication
  → authorization / RLS
  → source configuration and analytics
```

Retrieved content is always untrusted, even when hosted on an approved domain.

## Primary threats and controls

### SSRF and crawler abuse

Threats:

- localhost, private IP, link-local, and metadata endpoints;
- DNS rebinding;
- redirects from public to private networks;
- unbounded crawl graphs;
- decompression bombs and oversized documents;
- unsupported binary or active content;
- infinite calendar/query URLs.

Required controls:

- allow `https` and explicitly approved `http` only;
- resolve and block private, loopback, link-local, multicast, and reserved ranges before every request and redirect;
- re-resolve DNS after redirects;
- cap redirects, depth, pages, bytes, decompressed size, and duration;
- content-type allowlist;
- canonical URL and query policy;
- queue isolation and per-source budgets;
- no browser credential reuse.

### Prompt injection in sources

Threats:

- pages instruct the model to ignore policy;
- repository text requests secrets or tools;
- malicious content masquerades as system messages;
- poisoned examples rank highly.

Controls:

- separate system policy, user question, and quoted evidence;
- label evidence as untrusted;
- no tools available to the answer model in the first release;
- never interpolate source text into system instructions;
- adversarial benchmark cases;
- store provenance for each evidence block;
- refuse requests for hidden prompts and credentials.

### Cross-tenant leakage

Threats:

- missing project filter;
- unsafe vector query;
- permissive admin endpoint;
- shared cache key collision;
- logs or exports crossing projects.

Controls:

- organization and project identifiers on every owned row;
- Supabase RLS as a mandatory database boundary;
- service-role usage isolated to narrow backend jobs;
- project-scoped vector search function;
- cache keys include tenant, source revision set, and policy version;
- adversarial isolation tests;
- no multi-tenancy launch before tests pass.

### Public widget abuse

Threats:

- embedding on unauthorized domains;
- automated traffic;
- extraction of public project tokens;
- oversized prompts;
- denial of wallet;
- session spoofing.

Controls:

- public project identifier is not a secret;
- server validates allowed origin/domain;
- per-project, per-IP, and per-session rate limits;
- maximum input, context, and output sizes;
- bot and anomaly controls;
- hard daily/monthly budgets;
- safe degraded mode when budget is exhausted;
- no privileged admin action exposed to widget credentials.

### Supply-chain and repository content

Threats:

- repository includes secrets;
- parser dependency compromise;
- malicious MDX/HTML execution;
- symlinks or paths escape intended roots.

Controls:

- read text as data; never execute MDX, scripts, or repository code;
- dependency pinning and vulnerability scanning;
- path normalization;
- source path allow/deny lists;
- secret-pattern detection and quarantine;
- raw content access limited operationally.

### Model and provider boundary

Threats:

- provider retention contrary to policy;
- prompt or evidence leakage;
- provider outage;
- model behavior change;
- unsupported answer despite good evidence.

Controls:

- send minimum required evidence;
- explicit provider data settings and contracts before commercial use;
- redact secrets and prohibited content;
- record model and prompt versions;
- timeouts and bounded retry;
- deterministic citation checks where possible;
- abstention and fallback path;
- provider portability at the answer interface.

### Admin console and source configuration

Threats:

- account takeover;
- insecure source changes;
- deletion without audit;
- role escalation;
- malicious export.

Controls:

- Supabase Auth and secure session handling;
- least-privilege roles;
- audit events for source, domain, member, retention, and export changes;
- reauthentication for sensitive actions;
- signed/expiring exports;
- deletion receipts and recovery policy in later phases.

## Privacy baseline

- Public sources only in the pilot.
- Conversation text may still contain personal or secret data; warn users not to submit secrets.
- Minimize and bound conversation retention.
- Do not train shared models on customer conversations.
- Provide deletion and export before paid multi-tenant launch.
- Avoid logging full credentials, tokens, or authorization headers.

## Security gates

Phase 1 cannot pass with any known:

- cross-project retrieval;
- prompt-injection policy override;
- invented citation;
- prohibited network fetch;
- secret exposure;
- unrecorded source lineage for an answer.

Phase 2 cannot launch publicly without domain enforcement, rate limits, input limits, and cost budgets.
