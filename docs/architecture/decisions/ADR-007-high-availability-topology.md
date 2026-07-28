# ADR-007: Highly Available Runtime Topology

## Status
Accepted

## Context
The current single-host topology cannot meet production availability or independent scaling needs.

## Decision
Evolve to 2+ stateless web and API replicas behind a managed load balancer/WAF, dedicated worker pools, managed PostgreSQL HA with pooling/backups, object storage/CDN, and optional shared Redis. Use separate liveness/readiness probes and graceful shutdown.

## Consequences
Instance failure and traffic growth can be handled without application redesign. Infrastructure cost and operational complexity increase and must follow control-first hardening and recovery drills.
