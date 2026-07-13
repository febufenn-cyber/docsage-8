# Phase 2 — Single-Project Widget

Status: **engineering gate passed; public pilot remains required**.

## Objective

Phase 2 turns the Phase 1 truth engine into one safe, accessible, embeddable documentation assistant for one public project.

The forcing question is:

> Can a documentation owner add DocSage to a public site with one embed snippet and receive grounded answers, citations, useful refusals, domain enforcement, rate limiting, and actionable feedback without exposing secrets or weakening the Phase 1 evidence contract?

The engineering answer is now **yes** for the deterministic reference route. A real public documentation-site pilot has not yet been completed.

## Implemented product slice

The widget supports:

- one public project and active source corpus;
- public HMAC-signed widget tokens scoped to a project, origin policy, and lifetime;
- exact origins and wildcard subdomains without matching the apex;
- English documentation questions;
- grounded answers and explicit answer states;
- HTTP(S)-only source citations;
- separate answer and feedback rate limits;
- useful/not-useful feedback with controlled reasons;
- idempotent feedback writes;
- light, dark, and automatic themes;
- keyboard, focus, live-region, and reduced-motion behavior;
- a dependency-free local demo;
- a machine-readable release gate and CI artifact.

## Non-goals

Phase 2 does not include:

- customer self-service onboarding;
- multiple projects in one dashboard;
- billing or usage plans;
- private repositories or account-specific support;
- end-user authentication;
- conversation memory across page reloads;
- autonomous tools or documentation writes;
- Slack, Discord, support-desk, or CRM integrations;
- multilingual retrieval;
- a production hosted-model quality claim without the Phase 1 external gates.

## Delivered slices

### 2A — Contract

Frozen:

- embed contract;
- public-token model;
- origin policy;
- request and response schemas;
- error model;
- accessibility rules;
- telemetry and feedback limits;
- release gates.

### 2B — Edge API

Implemented:

- signed, scoped widget tokens;
- exact and wildcard origin validation;
- bounded JSON requests;
- fixed-window rate limiting behind adapters;
- config, answer, and feedback endpoints;
- Phase 1 truth-engine integration;
- safe CORS and security headers;
- stable error envelopes and request IDs.

### 2C — Widget

Implemented a framework-free Web Component that:

- uses Shadow DOM;
- renders untrusted content with DOM text APIs;
- shows answer states and citations;
- supports keyboard and focus management;
- exposes CSS custom properties for theming;
- emits privacy-bounded lifecycle events;
- never stores secrets or executes retrieved content.

### 2D — Feedback, demo, and gate

Implemented:

- useful/not-useful feedback;
- controlled reason codes;
- optional free text disabled by default;
- idempotent feedback writes;
- executable local demo integration;
- asset-size and unsafe-pattern checks;
- API, widget, feedback, and demo tests;
- `npm run gate:widget`;
- CI artifact publishing;
- a measured Phase 2 review.

## Security model

The browser receives a **public signed widget token**, not a secret. The token carries:

- project ID;
- allowed origins;
- issued-at and expiration times;
- token ID;
- optional key ID and display configuration.

The API independently verifies:

1. token signature and expiration;
2. project scope;
3. request `Origin` against token claims;
4. request size and schema;
5. answer or feedback rate-limit allowance;
6. response fields before returning them to the browser.

A valid token does not authorize private data, source ingestion, project mutation, billing access, or cross-project retrieval.

## Privacy boundaries

The default widget sends only:

- current question;
- current public page URL;
- public widget token;
- an optional controlled feedback event tied to a response trace.

It does not send page text, cookies, local storage, form fields, browser history, DOM content, answer text in lifecycle events, retrieval evidence, prompts, or token claims.

## UX contract

The widget:

- remains closed by default;
- identifies itself as documentation assistance;
- shows loading and request status;
- displays useful refusal states without inventing an answer;
- keeps citations near the answer;
- preserves entered text when a retryable request fails;
- provides a close control and restores focus to the launcher;
- does not trap keyboard focus;
- respects `prefers-reduced-motion`;
- exposes accessible labels and polite live regions.

A manual browser and screen-reader pilot remains necessary before claiming complete WCAG conformance.

## Measured engineering gate

Reference: GitHub Actions CI run 19, July 13, 2026.

```text
Decision: CONDITIONAL_GO
Widget raw bytes: 18,809
Widget gzip bytes: 5,136
Forbidden source patterns: 0
Grounded answer state: supported
Safe citations returned: 8
Useful refusal state: account_specific
Feedback records after duplicate submission: 1
```

All gate checks passed:

- asset size;
- source safety;
- accessibility markers;
- demo assets;
- config contract;
- answer and citations;
- useful refusal;
- origin enforcement;
- feedback acceptance;
- feedback idempotency.

Run locally:

```bash
npm install
npm run check
npm run demo:widget
npm run gate:widget
```

Evidence is written to:

```text
.tmp/widget-gate/gate.json
.tmp/widget-gate/report.md
```

## Decision policy and current decision

- `GO_TO_PHASE_3`: all Phase 2 engineering gates pass and pilot deployment evidence exists.
- `CONDITIONAL_GO`: engineering gates pass but hosted deployment or pilot evidence is incomplete.
- `REPEAT_PHASE_2`: at least one widget, API, security, accessibility, or feedback gate fails.
- `REDESIGN`: the public-token or embed architecture cannot meet the threat model.

Current decision: **`CONDITIONAL_GO`**.

Remaining blockers:

- no public documentation-site pilot deployment;
- Phase 1 independent human review incomplete;
- credentialed Cloudflare/Claude hosted benchmark incomplete.
