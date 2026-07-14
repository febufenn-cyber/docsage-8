# Scheduling, Retry, and Source-Health Contract

## Scheduling

Schedules are project/source scoped and use a bounded interval between one minute and 31 days. A due occurrence creates an ingestion job with an idempotency key derived from the schedule ID and scheduled occurrence timestamp. Concurrent scheduler delivery therefore converges on one job.

A scheduler invocation creates at most one catch-up job per due schedule and advances `nextRunAt` beyond the current time. It does not enqueue an unbounded backlog after downtime.

## Retry policy

Retries use exponential backoff capped at a configured maximum. The backoff function accepts an explicit bounded jitter sample so tests and durable workers can reproduce the chosen delay. A job cannot enter `retry_wait` after its final allowed attempt.

## Crash recovery

Running jobs carry a worker lease. A live lease cannot be stolen. When the lease expires, recovery transitions the job to `retry_wait`, or to `failed` when attempts are exhausted. Recovery records a stable bounded failure code and never persists response bodies or credentials.

## Source health

Job outcomes map to source health as follows:

- `succeeded` → `healthy`
- `retry_wait` → `degraded`
- `failed` → `failed`
- other states → `unknown`

The latest project/source health is retained. Phase 3 learning events include only source ID, job state, attempt, status, and stable failure code. They do not include raw URLs, fetched content, headers, tokens, or provider error bodies.
