# ADR-002: Bounded Context and Prisma Write Ownership

## Status
Accepted

## Context
A shared 209-model Prisma schema makes data accessible everywhere and obscures accountability.

## Decision
Assign every Prisma model exactly one bounded-context owner. The owner controls writes, invariants and schema evolution. Other contexts use exported commands/queries or documented read access. Machine checks require complete, unique ownership.

## Consequences
Accountability and extraction readiness improve without database-per-context complexity. Initial enforcement is organizational/static; high-risk direct writes must be migrated incrementally to owned interfaces.
