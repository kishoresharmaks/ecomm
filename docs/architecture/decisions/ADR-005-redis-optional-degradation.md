# ADR-005: Redis-Optional Degradation Semantics

## Status
Accepted

## Context
Redis improves queues, caching and distributed coordination, but local and constrained deployments must remain functional without it.

## Decision
Redis is an optional accelerator. Every Redis-backed function provides a silent correctness-preserving database, synchronous or bounded in-memory fallback. Readiness reports Redis degradation but does not fail solely because Redis is absent or unavailable.

## Consequences
Bootstrap and core operations remain resilient. Fallbacks may reduce throughput, cache effectiveness or global coordination and must be visible in telemetry and capacity limits.
