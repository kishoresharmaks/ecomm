# 1HandIndia Plan A Architecture Hardening Report

**Date:** 28 July 2026  
**Status:** Implemented and locally validated, with infrastructure-dependent checks delegated to CI  
**Architecture:** Enforced evolutionary modular monolith  
**Locked stack preserved:** Turborepo, Next.js, NestJS, Prisma, PostgreSQL, workers, Clerk customer/seller authentication, standalone back-office sessions

## Executive summary

Plan A converted the approved architecture from guidance into enforceable engineering controls. It deliberately does **not** introduce microservices. The immediate goal was to reduce uncontrolled coupling, make data ownership explicit, prevent API and migration regressions, improve operational diagnosis, and standardize reliable background execution while retaining the delivery speed of the current monorepo.

The result is a governed modular monolith with:

- Documented bounded contexts and ten accepted Architecture Decision Records.
- Exactly one bounded-context owner for every one of the 209 Prisma models.
- A baseline-then-tighten dependency policy covering the current 417 prohibited imports across 52 context edges.
- CI gates for architecture, migrations, type safety, lint, tests, OpenAPI compatibility, builds, dependency review, dependency audit, secret scanning, migration replay, and guarded database integration tests.
- Structured API logs with request and correlation identifiers, duration/status fields, and centralized credential redaction.
- Separate liveness and readiness probes where PostgreSQL is required and Redis is allowed to degrade safely.
- Shared worker conventions for versioned job envelopes, idempotency keys, correlation metadata, bounded-jitter retries, terminal failure classification, non-overlapping polling, safe errors, and graceful shutdown.

## What changed

### 1. Architecture governance

Created `docs/architecture/` as the authoritative architecture control set:

- `README.md` — governance workflow, sources of truth, commands, and review cadence.
- `bounded-contexts.md` — context map, responsibilities, dependency direction, and extraction criteria.
- `prisma-model-ownership.md` — one owner for all 209 Prisma models.
- `architecture-debt-register.md` — seven high-risk exception classes with owners, removal conditions, and review cadence.
- `worker-job-contract.md` — standard job envelope and processing semantics.
- `decisions/ADR-001` through `ADR-010` — accepted decisions for modular-monolith evolution, data ownership, outbox/idempotency, auth trust zones, Redis degradation, financial invariants, HA topology, compatibility, SLOs, and service extraction.
- `.github/CODEOWNERS` — review boundaries for architecture, security, persistence, finance, commerce, B2B, and workers.

### 2. Executable architecture fitness functions

Added `config/architecture-boundaries.json` and TypeScript checks under `scripts/architecture/`.

The controls now:

- Parse context ownership from configured source roots.
- Detect prohibited direct context imports.
- Allow existing debt only at the recorded edge count.
- Fail when a new prohibited edge appears or an existing edge grows.
- Fail baseline verification when debt has been removed but the baseline was not tightened.
- Confirm that every Prisma model is assigned exactly once.
- Validate migration directory naming and non-empty migration SQL.
- Test boundary grouping, baseline comparison, schema extraction, and OpenAPI compatibility behavior.

**Current baseline:** 417 violations across 52 context edges. This is visible debt, not permission to add more coupling.

### 3. API contract protection

Added deterministic OpenAPI generation within the API package so NestJS dependencies resolve correctly under pnpm workspace isolation.

Compatibility checks currently reject:

- Removed paths.
- Removed operations.
- Removed component schemas.
- Removed schema properties.
- Newly required properties.
- Schema type changes.

The approved snapshot is stored at `docs/architecture/contracts/openapi.json`.

### 4. API observability and health

Added:

- `AsyncLocalStorage` request context.
- Validated or generated `x-request-id` and `x-correlation-id` values.
- Propagation of both identifiers to response headers.
- Pino structured JSON logging through a Nest logger adapter.
- Global HTTP completion/failure logging with method, normalized route, status, and duration.
- Nested object and text redaction for authorization, cookies, tokens, passwords, secrets, API keys, card data, banking data, PAN, Aadhaar, and provider configuration.
- `GET /api/health` and `GET /api/health/live` as liveness-compatible endpoints.
- `GET /api/health/ready` as dependency-aware readiness.

Readiness semantics are intentional:

- PostgreSQL failure means not ready and HTTP 503.
- Redis available means ready.
- Redis missing or unavailable means degraded but still serviceable because Redis is optional by architecture decision.

### 5. Background-job reliability

Added a shared worker runtime and applied it to representative workloads:

- Search indexing.
- B2B ERP outbox delivery.
- Email queue processing.

The shared conventions include:

- Versioned envelopes.
- Job ID and idempotency key.
- Correlation, request, and causation IDs.
- Bounded exponential retry with jitter.
- Retryable versus terminal error classification.
- Redacted, size-bounded persisted errors.
- Poll overlap prevention.
- Graceful signal handling with shutdown failure reporting.

Existing strengths were preserved: atomic PostgreSQL claims, stale-lock recovery, conditional updates, terminal/dead-letter states, and silent Redis fallback.

### 6. CI hardening

Expanded `.github/workflows/ci.yml` into four control surfaces:

1. **Quality and architecture** — Prisma generation/validation, migration hygiene, architecture checks, typecheck, lint, unit tests, OpenAPI compatibility, production build, and high-severity production dependency audit.
2. **Database integration** — disposable PostgreSQL 17, clean migration replay, migration status, and guarded API integration tests.
3. **Dependency review** — blocks high-severity dependency changes on pull requests.
4. **Secret scanning** — scans committed history with Gitleaks.

## Validation evidence

| Control | Result |
|---|---|
| Prisma ownership | 209 schema models, 209 ownership entries; every model owned exactly once |
| Architecture boundary baseline | 417 current violations across 52 edges; exact baseline match |
| Migration hygiene | 81 valid migrations |
| Architecture and contract fitness tests | 2 files, 6 tests passed |
| API unit/coverage suite | 86 files passed, 498 tests passed |
| API DB integration suite | 30 tests safely skipped locally because no disposable PostgreSQL was available |
| Worker suite | 8 files, 24 tests passed |
| Focused API operational tests | Observability, health, Swagger coverage, and compatibility passed |
| Full monorepo TypeScript | 16/16 tasks passed using serial high-memory execution |
| Full monorepo lint | 11/11 tasks passed using serial high-memory execution |
| OpenAPI compatibility | No breaking changes detected |
| API and worker production bundles | 6/6 dependency/build tasks passed |
| Diff whitespace validation | Passed; Windows LF/CRLF conversion warnings only |

### Environment-dependent validation

Docker and `psql` were not available in the local execution environment, so clean database migration replay and the guarded 30-test integration suite could not be run locally without risking a non-disposable database. CI now provisions PostgreSQL 17 specifically for these checks.

Full highly parallel Turborepo commands initially encountered local process heap exhaustion. Re-running with constrained concurrency and a larger Node heap passed the complete monorepo typecheck (16/16 tasks), complete monorepo lint (11/11 tasks), and backend production build (6/6 tasks). CI runners should retain sufficient Node heap or constrained concurrency for this repository size.

## Benefits

### Immediate

- New cross-context coupling is blocked automatically.
- Removed architecture debt cannot silently return.
- Schema ownership and review responsibility are explicit.
- Breaking API changes are detected before merge.
- Operational incidents can be followed across request, queue, and worker boundaries.
- Load balancers can distinguish a live process from one that cannot serve database-backed traffic.
- Redis outages do not incorrectly remove healthy API replicas.
- Representative jobs have consistent retry, deduplication, error, and shutdown semantics.

### Medium-term

- Context APIs can be narrowed progressively without a rewrite.
- High-risk order, payment, return, payout, and tax changes receive stronger ownership review.
- Database migration confidence improves through empty-database replay.
- Teams can measure architecture debt reduction instead of debating it subjectively.
- Multi-replica API deployment becomes safer after global rate limiting and managed PostgreSQL HA are introduced.

### Long-term

- Service extraction becomes a measured business/operational decision rather than a fashion-driven rewrite.
- Stable contracts, outbox workflows, observability, and owned data create the prerequisites for selective extraction.
- The system can scale infrastructure first and split services only when independent scaling, blast radius, ownership, and contract maturity justify the added complexity.

## Known residual risks and required follow-up

1. **Replace CODEOWNERS placeholders.** `@1handindia/*` names must be mapped to real GitHub users/teams before mandatory review rules are enabled.
2. **Run CI on the pushed branch.** GitHub-hosted migration replay, dependency review, audit, and secret scanning cannot be proven locally.
3. **Reduce baseline debt.** Prioritize Orders/Payments/Returns/Finance, shopping orchestration, B2B, and worker direct database access. Tighten the baseline in the same pull request as each removal.
4. **Add repository-level write checks.** Prisma ownership is currently governance/static ownership, not database-enforced access control.
5. **Prepare multi-replica rate limiting.** The process-local limiter must move to WAF/edge or shared Redis before horizontal API scaling.
6. **Operationalize SLOs.** Configure dashboards and alerts for availability, p95 latency, queue age, retry exhaustion, PostgreSQL saturation, and provider errors.
7. **Prove recovery targets.** The RPO <= 15 minutes and RTO <= 60 minutes goals require managed backups and recurring restore drills.
8. **Keep Redis optional.** New queue/cache/rate-limit features must retain synchronous, database, polling, or in-memory fallback where required by project governance.

## Recommended next sequence

1. Push the branch and obtain a fully green CI run.
2. Replace CODEOWNERS placeholders and enable required architecture/security/finance reviews.
3. Deploy the new liveness/readiness paths to staging and configure load-balancer probes.
4. Connect structured logs to a searchable log platform and create the first SLO dashboard.
5. Select one high-risk dependency edge and complete the first baseline reduction as a proof of the governance loop.
6. Schedule the first PostgreSQL restore drill and document measured RPO/RTO.

## Architecture conclusion

Plan A has established the correct control-first foundation. The system should remain a modular monolith for now. The important change is not a new topology; it is that architecture, contracts, ownership, health, and job reliability are now explicit and mechanically checked. The next gains come from operating these controls consistently and reducing the recorded debt one measurable edge at a time.
