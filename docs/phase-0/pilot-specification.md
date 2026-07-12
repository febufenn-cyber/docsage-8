# Pilot Specification

## Pilot objective

Prove that DocSage can answer documentation-answerable technical questions reliably from one public documentation site and one public repository, while producing useful failure signals for a documentation owner.

## Frozen scope

- One organization.
- One project.
- One public English documentation site.
- One public GitHub repository.
- One configured current documentation version.
- One allowed widget domain.
- Read-only behavior.
- Technical setup, API usage, configuration, migration, and documented troubleshooting.
- No production customer data.

## Required capabilities

### Source and ingestion

- explicit source registry;
- safe sitemap/page discovery;
- read-only GitHub document ingestion;
- structured HTML/Markdown normalization;
- headings, code, tables, notes, and warnings preserved;
- content hashes and source revision lineage;
- current-version activation state.

### Retrieval

- semantic vector retrieval;
- exact keyword/full-text retrieval;
- metadata filters for project, version, runtime, type, and authority;
- reranking;
- evidence trace saved for every run.

### Answering

- answer states from the answer constitution;
- citations attached to material claims;
- honest abstention;
- conflict and version surfacing;
- source-exact, adapted, or synthesized code labels;
- no tools or autonomous actions.

### Evaluation and operations

- execute the verified benchmark;
- store raw retrieval and answer artifacts;
- classify failures;
- measure latency and cost;
- bounded retries and timeouts;
- per-project budgets.

### Minimal interaction surface

Phase 1 may use a CLI or internal page. A public widget belongs to Phase 2.

## Explicit non-capabilities

- private repositories or private docs;
- account-specific answers;
- production log access;
- billing automation;
- enterprise SSO;
- multiple organization roles beyond a minimal internal owner;
- Slack, Discord, support desk, or email integrations;
- multilingual retrieval;
- fine-tuning;
- autonomous documentation changes;
- community content as authority;
- unrestricted web browsing.

## Benchmark corpus

The initial engineering corpus is:

- Hono official documentation at `hono.dev`;
- official public repository `honojs/hono`;
- current documentation plus explicitly selected migration material;
- revision pinned before scoring.

This is an engineering benchmark, not a commercial commitment.

## Pilot success evidence

### Quality

- Phase 1 benchmark thresholds pass.
- High-risk failures are zero or explicitly accepted with mitigation.
- No invented citations.
- No mixed-version answer accepted as supported.
- At least 20 real questions are reviewed by a documentation owner.

### Product value

At least one of:

- repeated questions are clustered into a useful gap;
- an existing page is shown to be hard to retrieve;
- a source conflict is discovered;
- a maintainer changes documentation based on evidence;
- a measurable share of pilot questions is resolved without support.

### Economics

- mean and p95 variable cost fit the budget;
- free/pilot quotas prevent unbounded exposure;
- no persistent founder intervention is required per answer.

## Kill or redesign triggers

- fewer than 20% of real questions are documentation-answerable;
- correct grounded resolution stays below 60% after two focused retrieval iterations;
- the documentation owner finds failure clusters unactionable;
- most value requires private/account data;
- cost cannot fit the commercial envelope;
- installation or source maintenance is not repeatable.

## Deliverables at Phase 1 exit

- reproducible ingestion manifest;
- source revision registry;
- retrieval and answer API or CLI;
- benchmark runner and report;
- failure report with root-cause classes;
- cost/latency report;
- security test report;
- go/no-go recommendation for Phase 2.
