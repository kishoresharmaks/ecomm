# ADR-003: Transactional Outbox and Idempotent Consumers

## Status
Accepted

## Context
Orders, payments, ERP, search and notifications cross transaction and provider boundaries. Dual writes can lose events; queues provide at-least-once rather than exactly-once delivery.

## Decision
Write durable integration events/jobs in the same database transaction as owned state. Consumers claim atomically, use stable idempotency keys, retry transient failures with bounded backoff, recover stale locks and expose terminal failures for replay.

## Consequences
Delivery is reliable through process/Redis outages and duplicates are safe. Additional job state, cleanup, monitoring and reconciliation are required.
