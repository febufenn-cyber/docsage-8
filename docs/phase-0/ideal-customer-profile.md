# Ideal Customer Profile

## Beachhead

The first commercial design partner should be a small API, SDK, infrastructure, database, observability, authentication, developer platform, or open-source commercial company.

### Required characteristics

- Public English documentation.
- One primary public GitHub repository or official examples repository.
- Roughly 50–5,000 indexable documentation pages.
- Recurring setup, integration, API, configuration, migration, or troubleshooting questions.
- A founder, developer advocate, documentation owner, support lead, or engineering lead who can approve a pilot.
- Enough question volume to reveal repeated gaps.
- Willingness to provide a sample of real, de-identified questions.
- No need for account-specific production data in the initial pilot.

### Strong pain signals

- Repeated links to the same documentation page in support replies.
- Users cannot find the right page even when it exists.
- A changelog or migration guide frequently conflicts with older examples.
- Support engineers rewrite similar explanations.
- Documentation ownership is fragmented.
- Search analytics show repeated zero-result or reformulated queries.
- Community questions expose missing setup steps or misleading examples.

## Buying roles

| Role | Primary value |
|---|---|
| Founder | lower support load and faster activation |
| Developer advocate | better developer experience and visible content gaps |
| Documentation lead | prioritized, evidence-backed improvements |
| Support lead | fewer repetitive tickets and faster escalation |
| Engineering lead | fewer interruptions and more reliable technical guidance |

## Disqualifying conditions for the first pilot

- All relevant documentation is private.
- The majority of questions require account state, logs, billing, transactions, or production access.
- The company expects autonomous actions or commits.
- The documentation is primarily non-English.
- The product has strong legal, medical, financial, or safety-critical reliance.
- The corpus cannot be legally or contractually processed.
- The customer requires enterprise SSO, regional hosting, or formal compliance before evaluation.
- There is no internal owner for reviewing answers and source conflicts.
- The corpus changes too rapidly to pin a benchmark revision.

## Benchmark persona

The engineering benchmark uses the public Hono framework documentation and repository because they contain setup guides, API reference material, middleware, code examples, platform-specific instructions, and multiple question types. Hono is not treated as a customer or design partner.

## First ten discovery questions

1. What are the ten most repeated technical questions from the last month?
2. Which questions are answerable from existing docs but hard to find?
3. Which questions require account-specific information?
4. Which pages are frequently sent by support?
5. Where do official sources conflict?
6. Which product versions are actively supported?
7. Who approves documentation changes?
8. What would count as a deflected support interaction?
9. What response latency is acceptable?
10. What would make the pilot a clear failure?

## Pilot acceptance evidence

A candidate qualifies when it can provide:

- an approved public source list;
- 30–100 real or representative questions;
- one documentation owner for weekly review;
- one allowed installation domain;
- agreement on resolution, abstention, latency, and cost metrics.
