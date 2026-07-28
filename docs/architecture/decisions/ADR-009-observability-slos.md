# ADR-009: Observability and Service-Level Objectives

## Status
Accepted

## Context
Large marketplace workflows cross API, database, workers and providers; uncorrelated logs and generic health checks delay recovery.

## Decision
Use structured redacted logs, request/correlation/causation IDs, live/ready probes, queue age/failure metrics and SLO dashboards. Initial targets: 99.9% storefront/API availability, 99.95% checkout/order/payment after HA, p95 reads below 400 ms, commands below 750 ms excluding provider latency, RPO <=15 minutes and RTO <=60 minutes after proof.

## Consequences
Failures are diagnosable and reliability work measurable. Telemetry storage, alert tuning and regular recovery exercises require ownership and budget.
