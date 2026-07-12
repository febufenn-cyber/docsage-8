# Product Constitution

## Mission

DocSage helps developers solve documented implementation problems quickly while helping documentation owners discover where their documentation fails.

## Product identity

DocSage is:

- a read-only assistant over customer-approved technical sources;
- an evidence interface, not an oracle;
- a retrieval and documentation-quality system, not only a chat surface;
- a system that prefers an honest limitation over an invented answer;
- a feedback loop from questions to measurable documentation improvements.

DocSage is not:

- an account-specific support agent;
- a production debugger with access to customer systems;
- a replacement for maintainers on undocumented behavior;
- an autonomous actor that changes customer repositories;
- a general-purpose assistant with unrestricted web knowledge;
- a compliance, security, medical, legal, or financial decision maker.

## Strategic endgame

```text
question
→ source-grounded answer
→ evidence and confidence state
→ failure classification
→ repeated-gap clustering
→ evidence-backed documentation proposal
→ human-approved change
→ improved future answer quality
```

The embeddable widget is the acquisition and interaction surface. The defensible product is the closed documentation intelligence loop.

## Constitutional principles

1. **Evidence precedes fluency.** A polished answer is not valuable when the evidence is weak.
2. **Abstention is a feature.** Correctly saying “the approved sources do not answer this” protects the user and creates a documentation signal.
3. **Citations are claims, not decoration.** A link must support the nearby statement.
4. **Source lineage is durable.** Every answer must be traceable to source revisions.
5. **Version is part of truth.** A technically correct answer for the wrong version is incorrect.
6. **Failures must be diagnosable.** Ingestion, retrieval, generation, citation, authority, version, and safety failures are distinct.
7. **Humans retain publication authority.** Generated documentation changes require review.
8. **Tenant isolation is structural.** Application filters alone are not a security boundary.
9. **Evaluation ships with the product.** No quality claim is accepted without benchmark evidence.
10. **Narrow reliability beats broad demos.** One corpus answered reliably is more valuable than weak support for every source type.

## First release boundaries

Included:

- one public documentation site;
- one public GitHub repository;
- English content;
- one current documentation version;
- setup, implementation, API usage, and documented troubleshooting questions;
- citations, abstention, feedback, and failure logging.

Excluded:

- private repositories;
- internal wikis;
- account or transaction data;
- actions in customer systems;
- enterprise SSO and permission mirroring;
- multilingual retrieval;
- autonomous GitHub pull requests;
- support desk, Slack, and Discord integrations;
- community answers as authoritative evidence;
- model fine-tuning on customer conversations.

## Defensibility hypothesis

The moat is not access to a language model. It is the combination of:

- source revision lineage;
- version- and authority-aware retrieval;
- a growing verified evaluation set;
- claim-level citation validation;
- failure taxonomy and unanswered-question data;
- documentation gap resolution measured over time;
- workflow integration with human maintainers.

## Product-level kill conditions

Pause or kill the current product shape when two or more of these remain true after a properly executed pilot:

- fewer than 20% of real questions are documentation-answerable;
- verified citation-grounded resolution remains below 60% after focused retrieval iteration;
- maintainers do not act on unanswered-question insights;
- support owners cannot identify measurable value;
- sustainable variable cost exceeds 20% of target plan revenue;
- customers primarily require private/account-specific data, making the public-doc wedge irrelevant;
- established alternatives are both cheaper and materially more reliable with no credible differentiation;
- installation requires persistent founder engineering rather than repeatable setup.

A kill decision should preserve reusable ingestion, evaluation, and source-lineage components where possible.
