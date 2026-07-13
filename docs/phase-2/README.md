# Phase 2 — Single-Project Widget

Status: **contract frozen for implementation**.

## Objective

Phase 2 turns the Phase 1 truth engine into one safe, accessible, embeddable documentation assistant for one public project.

The forcing question is:

> Can a documentation owner add DocSage to a public site with one embed snippet and receive grounded answers, citations, useful refusals, domain enforcement, rate limiting, and actionable feedback without exposing secrets or weakening the Phase 1 evidence contract?

## Product slice

The first widget supports:

- one public project;
- one active source corpus;
- one public widget token scoped to that project;
- an explicit origin allowlist;
- English questions;
- grounded answers and answer states;
- source citations that open in a new tab;
- useful/not-useful feedback;
- light and dark themes;
- keyboard and screen-reader operation;
- a deterministic local demo and release gate.

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

## Delivery slices

### 2A — Contract

Freeze:

- embed contract;
- public-token model;
- origin policy;
- request and response schemas;
- error model;
- accessibility rules;
- telemetry and feedback limits;
- release gates.

### 2B — Edge API

Implement:

- signed, scoped widget tokens;
- exact and wildcard origin validation;
- bounded JSON requests;
- fixed-window rate limiting behind an adapter;
- answer endpoint integration;
- safe CORS and security headers;
- stable error envelopes and request IDs.

### 2C — Widget

Implement a framework-free Web Component that:

- uses Shadow DOM;
- renders all untrusted content with DOM text APIs;
- shows answer state and citations;
- supports keyboard and focus management;
- exposes CSS custom properties for theming;
- emits lifecycle events;
- never stores secrets or executes retrieved content.

### 2D — Feedback and gate

Implement:

- useful/not-useful feedback;
- optional bounded reason text;
- idempotent feedback writes;
- demo integration;
- asset-size and unsafe-pattern checks;
- API and widget contract tests;
- a Phase 2 review with a measured decision.

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
5. rate-limit allowance;
6. response fields before returning them to the browser.

A valid token does not authorize private data, source ingestion, project mutation, billing access, or cross-project retrieval.

## Privacy boundaries

The default widget sends only:

- current question;
- current page URL when enabled;
- public widget token;
- an optional feedback event tied to a response trace.

It must not send page text, cookies, local storage, form fields, browser history, or DOM content.

## UX contract

The widget must:

- remain closed by default;
- clearly identify itself as documentation assistance;
- show when it is loading;
- display useful refusal states without pretending an answer exists;
- keep citations near the answer;
- preserve user-entered text when a retryable request fails;
- provide a close control and restore focus to the launcher;
- avoid trapping keyboard focus;
- respect `prefers-reduced-motion`;
- meet WCAG 2.2 AA contrast and interaction expectations in the default theme.

## Release gates

Phase 2 can merge as an engineering slice when:

- all API contract tests pass;
- token tampering, expiration, origin bypass, oversized input, and rate-limit tests pass;
- no unsafe HTML rendering path is present;
- citations are restricted to `http:` or `https:` URLs;
- feedback is bounded and idempotent;
- widget JavaScript is under 40 KiB gzip;
- no `eval`, `new Function`, inline event handlers, or untrusted `innerHTML` is used;
- keyboard and ARIA contract checks pass;
- the local demo exercises answer, refusal, citation, error, and feedback states;
- `npm run gate:widget` produces a machine-readable result.

## Decision policy

- `GO_TO_PHASE_3`: all Phase 2 engineering gates pass and pilot deployment evidence exists.
- `CONDITIONAL_GO`: engineering gates pass but hosted deployment or pilot evidence is incomplete.
- `REPEAT_PHASE_2`: at least one widget, API, security, accessibility, or feedback gate fails.
- `REDESIGN`: the public-token or embed architecture cannot meet the threat model.
