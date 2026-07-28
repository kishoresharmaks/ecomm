# ADR-001: Evolutionary Modular Monolith

## Status
Accepted

## Context
1HandIndia has broad marketplace scope, a small shared team, 42 NestJS feature modules, one Prisma schema, and cross-domain transactions. Premature microservices would add distributed consistency, deployment, tracing and on-call costs before boundaries are stable.

## Decision
Retain independently scalable Next.js, NestJS API and worker deployables. Keep the API as an enforced modular monolith with explicit bounded contexts, owned writes, durable asynchronous integration and automated boundary checks.

## Consequences
Local transactions and deployment remain simple. Context coupling must be actively governed because process and database boundaries do not enforce it. Selective services remain possible under ADR-010.
