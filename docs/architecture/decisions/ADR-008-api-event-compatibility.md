# ADR-008: API and Event Compatibility Policy

## Status
Accepted

## Context
Web, mobile, workers and enterprise integrations evolve at different release speeds. Accidental contract removal causes distributed failures.

## Decision
Generate deterministic OpenAPI and version asynchronous event schemas. Additive changes are preferred. Breaking removals/type changes require an approved migration/version plan, compatibility window and explicit contract update. Consumers ignore unknown additive fields.

## Consequences
Independent releases become safer and breaking changes visible. Contract snapshots and version maintenance add review work.
