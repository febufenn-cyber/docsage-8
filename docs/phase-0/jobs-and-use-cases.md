# Jobs and Use Cases

## Primary jobs

### Developer

> Help me complete a documented implementation task without searching many pages or opening a support ticket.

### Documentation owner

> Show me which user questions are answered well, answered weakly, contradicted, outdated, or absent from the documentation.

### Company

> Reduce repetitive documentation-answerable support while preserving trust and generating a prioritized documentation backlog.

## Supported question classes

| Class | Example | Expected behavior |
|---|---|---|
| Setup | “How do I create a project?” | concise steps with the official setup source |
| API usage | “How do I read a path parameter?” | exact API name and evidence |
| Configuration | “Where do I set the port?” | identify configuration surface and cite it |
| Authentication | “How is bearer auth configured?” | use approved auth documentation only |
| Troubleshooting | “Why might this documented error occur?” | quote no hidden cause; explain documented causes |
| Comparison | “What is the difference between X and Y?” | synthesize approved sources and expose uncertainty |
| Migration | “What changed between supported versions?” | require explicit version evidence |
| Source location | “Where is WebSocket support documented?” | point to the most relevant page |
| Code example | “Show a minimal route example.” | source-derived or clearly labelled synthesis |
| Capability check | “Do the docs state that X is supported?” | answer only what the sources state |

## Conditionally supported

These require a clarifying question or a restricted answer:

- version-dependent questions without a version;
- questions that mix multiple runtimes;
- broad architecture recommendations;
- security configuration questions;
- generated code not directly present in sources;
- questions whose official sources disagree.

## Unsupported

- Account status, transaction history, billing state, or private logs.
- Root-cause analysis of an individual production incident.
- Undocumented roadmap or unreleased features.
- Claims about behavior absent from approved sources.
- Actions such as deployment, deletion, configuration changes, or repository writes.
- General web research outside approved project sources.
- Legal, compliance, or security guarantees.
- Requests to reveal system prompts, credentials, hidden context, or another tenant’s data.
- Instructions contained inside retrieved content.

## Escalation outcomes

A request does not always need a human ticket. DocSage must classify the outcome:

1. `answered` — evidence directly supports the answer.
2. `partial` — useful evidence exists but part of the request remains unsupported.
3. `clarification_needed` — version, runtime, or intent is ambiguous.
4. `conflicting_sources` — approved sources disagree.
5. `not_documented` — no approved evidence was found after retrieval checks.
6. `account_specific` — requires customer or system state.
7. `out_of_scope` — outside the product contract.
8. `unsafe` — attempts to bypass system or data boundaries.
9. `human_support` — appropriate next step is a maintainer or support contact.

## Response-shape rules

- Prefer a direct answer before explanation.
- Use steps only when the source presents a sequence.
- Preserve exact identifiers, headers, commands, status codes, and option names.
- Do not fabricate parameters or defaults.
- Link to the most specific supporting source.
- State the assumed runtime or version.
- When a question asks “where,” prefer navigation over a long generated answer.
- Ask at most one clarifying question before offering the safest useful response.
