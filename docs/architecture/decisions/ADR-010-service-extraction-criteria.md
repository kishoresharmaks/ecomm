# ADR-010: Measurable Service Extraction Criteria

## Status
Accepted

## Context
Microservices can isolate scale and ownership but impose network, consistency, deployment and operations costs.

## Decision
Extract a bounded context only after sustained independent scaling of at least 3x core, repeated blast-radius need, a separate owning team/release cadence, stable versioned contracts for two quarters, removal of cross-context transactions, and funded monitoring/on-call/data migration. Notifications, search and heavy reporting are likely early candidates; finance requires the strongest evidence.

## Consequences
Service creation follows measured need rather than fashion. Some module-level contention may persist longer, but decisions remain reversible and operable by the actual team.
