# Worker Job Contract

## Delivery guarantee

1HandIndia background work assumes at-least-once delivery. Every handler must be safe when the same logical job is delivered more than once. Redis/BullMQ is optional; durable database polling or synchronous fallback remains available when Redis is absent or unavailable.

## Envelope

Every newly standardized job carries:

- `jobId`: delivery identifier.
- `jobType`: stable dotted capability name.
- `schemaVersion`: positive integer payload contract version.
- `idempotencyKey`: stable logical-operation key.
- `correlationId`: end-to-end trace identifier.
- `requestId`: originating request when applicable.
- `causationId`: event/job that caused this job.
- `occurredAt`: ISO-8601 origin time.
- `attempt` and `maxAttempts`.
- Sanitized operational metadata only.
- Domain payload without secrets that can be looked up by an owned identifier.

## Processing rules

1. Claim atomically using a queue lease or database `UPDATE ... FOR UPDATE SKIP LOCKED`/conditional update.
2. Check terminal business state before side effects.
3. Use an idempotency key or owned record lock around external side effects.
4. Record success only after the durable state transition succeeds.
5. Retry transient failures using exponential backoff with bounded jitter.
6. Stop at `maxAttempts` and mark a terminal/dead-letter state that is visible to operations.
7. Recover stale processing locks after a context-defined lease.
8. Support deliberate manual replay with audit metadata; never silently reset terminal financial jobs.
9. Propagate correlation and causation IDs to provider calls and follow-up jobs.
10. Redact credentials, tokens, payment instruments, bank data and provider secrets from errors/logs.

## Retry classification

- Retry: timeout, connection reset, provider 429, provider 5xx, transient database serialization/deadlock.
- Do not retry automatically: validation failure, missing required configuration, authorization failure, invariant violation, malformed payload, provider 4xx other than explicitly transient responses.
- Unknown failures use conservative bounded retry and then terminal review.

## Lifecycle events

Structured logs use `job.started`, `job.completed`, `job.retry_scheduled`, `job.skipped`, and `job.terminal_failed` with the envelope identifiers, duration, sanitized error class/code, and next-attempt time. Payload bodies and secrets are not logged.

## Operational requirements

Critical queues alert on terminal failures and oldest-job age. Graceful shutdown stops new claims, lets active work finish within a deadline, releases resources, and leaves unfinished durable jobs recoverable.
