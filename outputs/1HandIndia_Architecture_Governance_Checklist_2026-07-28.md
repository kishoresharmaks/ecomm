# 1HandIndia Architecture Governance Checklist

**Baseline date:** 2026-07-28  
**Applies to:** Customer storefront, 1HandIndia Seller Hub, B2B portal, admin/finance/courier workspaces, mobile applications, NestJS API, worker runtime, shared packages, PostgreSQL/Prisma, Redis/BullMQ integrations, storage and third-party providers.

## 1. Pull request blocking gates

A pull request must not merge when any applicable blocking gate fails.

### Build and correctness

- [ ] `pnpm db:generate` succeeds.
- [ ] `pnpm db:validate` succeeds.
- [ ] `pnpm typecheck` succeeds for every affected workspace.
- [ ] `pnpm lint` succeeds for every affected workspace.
- [ ] Unit tests for every affected workspace succeed.
- [ ] Production build succeeds.
- [ ] Changed critical flows have integration or end-to-end coverage.
- [ ] No skipped or quarantined test was introduced without an owner, reason and expiry date.

### Architecture boundaries

- [ ] Every business capability has one owning bounded context.
- [ ] A module accesses another context through its public application interface, not its internal files.
- [ ] Controllers contain transport concerns only; business rules remain in application/domain services.
- [ ] New cross-context writes are not performed directly through another context's Prisma models.
- [ ] No circular NestJS module dependency was introduced.
- [ ] Shared packages contain contracts and cross-cutting utilities, not business orchestration.
- [ ] Any new asynchronous workflow uses an idempotency key, retry policy, terminal failure state and operator recovery path.

### Data and migrations

- [ ] Migration applies successfully to a clean database.
- [ ] Migration applies successfully to a production-like previous schema.
- [ ] Destructive operations use expand/migrate/contract across separate releases.
- [ ] New indexes have a query and cardinality justification.
- [ ] Large backfills are resumable, rate-limited and separated from request startup.
- [ ] Financial, order, payment, refund and inventory state transitions are transactionally protected.
- [ ] Events/jobs created from a transaction use a transactional outbox or an equivalent atomic mechanism.
- [ ] Personally identifiable or payout data is classified, encrypted where required and excluded from logs.

### API and compatibility

- [ ] OpenAPI generation succeeds and all externally used endpoints are documented.
- [ ] No backward-incompatible API change exists without versioning and an approved migration plan.
- [ ] Request validation rejects unknown fields and validates role-specific invariants.
- [ ] File downloads requiring authentication use authenticated fetch-to-Blob behavior.
- [ ] Webhooks verify signatures against the raw request body, acknowledge safely and are idempotent.

### Security and audit

- [ ] Authentication and authorization are enforced server-side.
- [ ] Customer/seller/B2B Clerk trust and standalone back-office trust remain separated.
- [ ] Permission-sensitive changes include deny-path tests.
- [ ] Admin, seller, payout, product, order and policy-sensitive mutations create audit records.
- [ ] No secret, token, full authorization header or sensitive document appears in code or logs.
- [ ] Critical/high dependency, secret-scan or static-analysis findings are resolved or formally accepted.
- [ ] Rate-limit behavior remains correct with multiple API replicas; in-memory limiting is not treated as a global control.

### Reliability and operability

- [ ] External calls have explicit timeouts and classified retry behavior.
- [ ] Retries use exponential backoff with jitter and do not retry non-transient errors.
- [ ] The operation is safe under duplicate delivery.
- [ ] Degraded behavior is defined for Redis, search, email, push, maps, courier and payment-provider outages.
- [ ] Redis-dependent features preserve the documented automatic fallback behavior.
- [ ] New background jobs expose queue age, success, retry and terminal-failure metrics.
- [ ] Logs include service, environment, request/correlation ID and safe entity identifiers.
- [ ] Readiness checks prove required dependencies; liveness checks only prove process health.

## 2. Risk-based test matrix

| Changed capability | Minimum additional evidence |
|---|---|
| Auth, roles, admin sessions | Positive and deny-path integration tests; session expiry; audit assertion |
| Checkout, orders, inventory | Concurrent request test; idempotency; rollback; pricing snapshot assertion |
| Payments, webhooks, refunds | Signature verification; duplicate webhook; out-of-order event; reconciliation |
| Ledger, settlement, payout | Double-entry invariant; immutable record behavior; approval separation; reconciliation |
| Returns and cancellations | State-machine transitions; refund/stock/ledger side effects; duplicate command |
| Seller/product moderation | Ownership check; approval audit; search-index propagation |
| Worker or outbox | Claim concurrency; retry/backoff; stale-lock recovery; dead-letter/operator replay |
| Prisma migration | Clean replay; previous-version upgrade; rollback/forward-fix plan; query plan |
| Public storefront/search | Cache invalidation; stale behavior; p95 comparison; SEO contract |
| Third-party provider | Timeout; circuit/open behavior; fallback; sandbox contract test |

## 3. Architecture fitness functions

Automate these checks in CI and publish trend results even when initially advisory.

### Blocking

1. No circular workspace or NestJS feature-module dependencies.
2. No imports of another bounded context's internal folders.
3. No Prisma access from controllers.
4. No cross-context table writes except through an allowlisted transition adapter during migration.
5. OpenAPI breaking-change detection against the main-branch contract.
6. Migration replay on empty and previous-version databases.
7. Typecheck, lint, unit tests, integration tests and production build.
8. Secret scanning, dependency audit and static security checks.

### Advisory until baselined, then blocking

1. Changed-line coverage below 80% in critical contexts or below 70% elsewhere.
2. A service/module exceeds the agreed dependency fan-out or complexity budget.
3. A database query exceeds its p95 budget or loses its expected index.
4. Web/server bundle grows by more than 10% without an approved exception.
5. Architecture debt remains critical for more than 30 days or high for more than 90 days.

## 4. Production service objectives

Targets begin after a highly available deployment and monitoring are operational.

| Journey or component | Target |
|---|---|
| Storefront and general API | 99.9% monthly availability |
| Checkout, order submission and payment acceptance | 99.95% monthly availability |
| General read endpoints | p95 below 400 ms, excluding third-party time |
| Command endpoints | p95 below 750 ms, excluding third-party time |
| Payment/courier webhook acknowledgement | p95 below 2 seconds; durable processing continues asynchronously |
| Critical background jobs | 99% begin within 60 seconds; context-specific completion SLO |
| Search-index freshness | 99% of accepted changes visible within 2 minutes |
| Transactional notifications | 99% accepted or terminally classified within 5 minutes |
| Transactional database recovery | RPO at most 15 minutes; RTO at most 60 minutes after proof by drill |

Use error-budget burn alerts rather than raw error-count alerts: page on fast burn (for example, 14.4x over one hour) and create a ticket on slow burn (for example, 2x over six hours).

## 5. Review cadence

### Per pull request

- Automated fitness functions.
- CODEOWNERS approval for the owning context.
- Security/finance review for payments, payouts, permissions and sensitive data.
- ADR link when a decision changes boundaries, contracts, persistence or operational characteristics.

### Weekly

- Review SLO burn, terminal worker failures and provider incidents.
- Triage architecture debt and assign owner/severity/target date.
- Review migrations scheduled for the next release.

### Monthly

- Review module dependency graph and cross-context database access.
- Sample a backup restore in an isolated environment.
- Review capacity trends, slow queries and storage growth.
- Review threat-model deltas and privileged audit events.

### Quarterly

- Update C4 and bounded-context maps.
- Run a disaster-recovery or dependency-failure exercise.
- Review whether any context meets the service-extraction criteria.
- Revalidate SLOs, capacity assumptions and cost profile.

### Annually or before a major launch

- Full architecture, security and privacy review.
- Penetration test and payment/security control review.
- Restore, failover and incident-command simulation.

## 6. ADR/RFC rule

Write an ADR when a decision affects one or more of the following:

- Bounded-context ownership or dependency direction.
- Runtime or deployment topology.
- Database ownership, consistency or migration strategy.
- Public API/event contracts.
- Authentication, authorization, encryption or audit.
- New external provider or managed platform.
- SLO, recovery target or failure behavior.

Required ADR sections:

```markdown
# ADR-NNN: Decision title

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
Problem, constraints, quality attributes and evidence.

## Options
At least two credible options and their trade-offs.

## Decision
Chosen option, scope and decision owner.

## Consequences
What becomes easier, harder and more expensive.

## Validation
Fitness functions, rollout signals and rollback/reversal plan.
```

## 7. Service extraction gate

Do not extract a microservice because a module is large. Extraction requires all of the following:

- [ ] The bounded context and owner are stable.
- [ ] The contract has remained stable for at least two quarters.
- [ ] Cross-context database transactions have been removed or replaced with an explicit saga/outbox process.
- [ ] Independent scaling need is sustained and materially different, normally at least 3x the core API profile.
- [ ] Incidents show a meaningful blast-radius or release-cadence benefit.
- [ ] The team can operate independent deployment, telemetry, alerts, backups and on-call ownership.
- [ ] A strangler migration, reconciliation and rollback plan is approved.

Preferred first extraction candidates, when justified: notifications, report exports and search indexing. Payments/ledger should be extracted only after stronger contracts and reconciliation controls exist.

## 8. First 90 days

### Days 0–30

- Add lint and test execution to CI.
- Add migration replay and OpenAPI compatibility checks.
- Establish CODEOWNERS and bounded-context ownership.
- Add request/correlation IDs, structured API logs and separate readiness checks.
- Record initial ADRs for modular-monolith strategy, data ownership, outbox and authentication boundaries.

### Days 31–60

- Standardize transactional outbox, worker claims, idempotency and dead-letter/operator recovery.
- Add dependency-boundary fitness tests and cross-context write allowlists.
- Establish SLO dashboards and slow-query baselines.
- Run baseline load tests for browse, search, checkout and webhook bursts.
- Prove a database backup restore and record actual RPO/RTO.

### Days 61–90

- Deploy or rehearse two or more stateless API/web replicas.
- Replace global-control assumptions around in-memory rate limits and local caches.
- Run Redis-down, queue-backlog, provider-timeout and database-restore drills.
- Introduce an architecture debt budget and quarterly review.
- Decide the next scaling investment from measured evidence, not projected scale alone.
