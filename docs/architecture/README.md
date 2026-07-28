# 1HandIndia Architecture Governance

## Purpose

This directory records enforceable architecture decisions for the 1HandIndia production marketplace. The target is an evolutionary modular monolith: one deployable NestJS API and one PostgreSQL schema today, with explicit bounded contexts, owned writes, asynchronous integration, and measurable extraction triggers.

## Sources of truth

- `../../docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md` — active product scope governance.
- `../../docs/IndiHub_FINAL_TECH_STACK_LOCK.md` — locked implementation stack.
- `bounded-contexts.md` — context responsibilities and dependency direction.
- `prisma-model-ownership.md` — authoritative schema write ownership.
- `../../config/architecture-boundaries.json` — machine-enforced dependency policy and current debt baseline.
- `architecture-debt-register.md` — reviewed exceptions and reduction targets.
- `decisions/` — Architecture Decision Records explaining why major choices were made.
- `worker-job-contract.md` — asynchronous execution contract.

## Decision workflow

1. Describe the business problem, quality attributes, and constraints.
2. Identify at least two options and name the trade-offs.
3. Record a proposed ADR when the decision changes context boundaries, public contracts, persistence, security trust zones, financial invariants, availability, or operational ownership.
4. Obtain review from the affected context owners and security/finance reviewers where applicable.
5. Mark the ADR accepted before implementation is merged.
6. Add or update automated fitness functions when the decision can be checked mechanically.
7. Supersede ADRs; do not silently rewrite accepted history.

## Boundary enforcement

Run:

```bash
pnpm architecture:check
pnpm architecture:baseline:verify
```

`architecture:check` blocks new context edges and growth in existing baseline edges. `architecture:baseline:verify` additionally fails when the baseline can be tightened, preventing removed debt from being accidentally reintroduced.

## Database migration baseline

The historical Prisma migration directory does not begin with the original marketplace schema. Its first migration, `20260601090000_production_ecommerce_optimizations`, adds indexes to tables that already existed. Therefore, a direct `prisma migrate deploy` against an empty database is invalid.

The authoritative empty-database contract is `../../prisma/baselines/manifest.json`:

- Apply `../../prisma/baselines/20260721_current_production_schema.sql`.
- Restore PostgreSQL-only hardening emitted by `../../scripts/database/print-production-baseline-hardening.mjs`.
- Register migrations through `20260724130000_fix_order_shipment_assignment_events_id` as represented by that baseline.
- Deploy later migrations normally with Prisma Migrate.

CI performs this sequence through `pnpm db:bootstrap:empty` only against an explicitly allowed local disposable test database. Existing staging and production databases continue using normal `prisma migrate deploy`; the bootstrap command rejects protected environments. Do not edit, squash, or delete historical migrations that may already be registered in deployed databases.

`pnpm db:migrations:check` validates the migration directories and the baseline manifest/cutoff contract.

The baseline is not permission to add more coupling. Any approved exception requires a debt-register entry with an owner, rationale, review date, and removal condition.

## Review cadence

- Per pull request: architecture checks, ownership checks, API compatibility, migrations, tests, security scans.
- Weekly: failed jobs, SLO breaches, and architecture-debt changes.
- Monthly: dependency graph, capacity trend, restore sample, and threat-model delta.
- Quarterly: C4/context review, disaster-recovery exercise, and service-extraction assessment.
