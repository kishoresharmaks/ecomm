# 1HandIndia Scalable System Architecture Assessment

**Assessment date:** 2026-07-28  
**Decision horizon:** Current production hardening through selective scale-driven extraction  
**Primary recommendation:** Retain an evolutionary modular monolith, enforce bounded contexts and data ownership, standardize reliable asynchronous processing, and scale the web/API/worker runtimes independently before introducing domain microservices.

---

## Executive decision

1HandIndia should **not** be converted into microservices now. The repository already contains the correct coarse runtime foundation for a small team building a broad marketplace: a Turborepo, a Next.js web application, a NestJS API, mobile clients, a worker runtime, shared packages, PostgreSQL/Prisma, object storage/provider adapters, and optional Redis/BullMQ acceleration.

The immediate scalability constraint is not the number of deployable services. It is the lack of sufficiently enforced boundaries inside a very broad API and a shared 209-model schema, combined with a single-host deployment model, per-process controls, mixed asynchronous patterns and incomplete operational gates.

The target is therefore:

- **Logical decomposition now:** explicit bounded contexts, ownership, public application interfaces, dependency rules and schema ownership.
- **Runtime scaling now:** stateless web/API replicas, dedicated worker replicas by workload, managed PostgreSQL, object storage/CDN, load balancer/WAF and Redis when available.
- **Reliable integration now:** transactional outbox, idempotent consumers, bounded retries, dead-letter/operator recovery and reconciliation.
- **Physical decomposition later:** extract only contexts that demonstrate independent scale, blast-radius, release-cadence or ownership needs.

This avoids both extremes: an ungoverned monolith that becomes unchangeable, and premature microservices that create distributed transactions, operational overhead and duplicated infrastructure before the domain boundaries are stable.

---

## Evidence-based current-state assessment

### What is structurally sound

- The workspace uses the locked Turborepo/pnpm structure (`package.json`, `pnpm-workspace.yaml`, `turbo.json`).
- Runtime responsibilities are already coarse-grained: Next.js web, NestJS API and a worker (`apps/web`, `apps/api`, `apps/worker`), with separate mobile customer, seller and delivery clients.
- The API uses validation, Helmet, CORS, OpenAPI and a global route prefix (`apps/api/src/main.ts`).
- Customer/seller/B2B/delivery trust uses Clerk while back-office access uses independent database-backed sessions; this is a valuable trust-zone separation.
- Feature modules exist for major capabilities, including catalog, sellers, orders, payments, finance, returns, B2B, services, search, support, notifications and audit (`apps/api/src/app/app.module.ts`).
- Async work has meaningful idempotency/safety patterns. The worker claims email rows conditionally, checks stale delivery locks and avoids duplicate sends (`apps/worker/src/index.ts`). Database polling/outbox patterns also exist for search, ERP and provider work.
- Redis is optional, consistent with the project rule that the system must remain bootable in fallback mode (`apps/worker/src/index.ts`, storefront and notification cache/queue services).
- The repository has substantial unit coverage across API, web, mobile and workers, plus focused Playwright coverage.

### Principal architecture risks

#### 1. Context coupling is already high

`OrdersModule` imports checkout pricing, coupons, customers, deals, finance, locations, maps, market, notifications, payments, returns and tax. `B2BModule` imports identity, locations, notifications, payments, sellers, storage and tax. This is understandable orchestration, but it creates a dependency mesh and makes ownership difficult.

**Consequence:** local changes can have wide compile/test/release impact; circular dependencies and cross-context data writes become increasingly likely.

#### 2. Data ownership is implicit

The Prisma schema contains 209 models in one file (`prisma/schema.prisma`). A single PostgreSQL database is the right choice now, but schema ownership is not technically enforced.

**Consequence:** a module can read or mutate another capability's records directly, bypassing invariants. Future extraction becomes expensive because table ownership and event contracts were never established.

#### 3. Single-node operational assumptions remain

Nginx currently targets one Next.js process and one API process at localhost (`deploy/nginx/indihub-nextjs.conf`). The API rate limiter uses an in-memory `Map` (`apps/api/src/rate-limit/request-rate-limiter.ts`). In-memory caches and limiters are local to each replica.

**Consequence:** a process or host failure interrupts the portal; per-instance limits become inconsistent under horizontal scaling; local caches cannot provide cross-replica invalidation.

#### 4. Async execution is heterogeneous

The worker starts many database pollers and optionally a BullMQ email worker from one process (`apps/worker/src/index.ts`). This gives excellent fallback behavior but can create noisy-neighbor effects and requires strong claim/lease semantics when replicas increase.

**Consequence:** one heavy report, routing batch or provider slowdown can affect unrelated work; adding replicas can duplicate polling unless every job has atomic claims.

#### 5. Production observability is uneven

The worker uses Pino, but the API is initialized with buffered logs without a demonstrated structured logger. The health endpoint is liveness-only and does not test database/readiness (`apps/api/src/health/health.controller.ts`). Request/correlation IDs and distributed traces are not evident as global controls.

**Consequence:** cross-runtime incident diagnosis, SLO measurement and safe multi-replica operation will be difficult.

#### 6. CI omits key gates

The current CI validates Prisma, typechecks and builds (`.github/workflows/ci.yml`), but does not execute lint, unit/integration tests, migration replay, security scans or API compatibility checks.

**Consequence:** the repository has many tests, but the main branch is not demonstrably protected by them.

---

## Architecture options and trade-offs

| Option | Benefits | Costs and failure modes | Decision |
|---|---|---|---|
| Continue as an unconstrained modular monolith | Lowest immediate effort; simple transactions | Dependency mesh, unclear ownership, large blast radius, difficult extraction | Reject |
| Enforced modular monolith plus worker plane | Preserves local transactions and operational simplicity; allows horizontal scaling; creates extraction seams | Requires discipline, automated boundaries and shared-database ownership rules | **Adopt** |
| Domain microservices now | Independent deployment/scaling and stronger runtime isolation | Distributed consistency, more infrastructure, duplicated security/telemetry, harder local development, higher on-call load | Defer |

The recommended option gives up independent deployment for most domains today. In return, it preserves development velocity and strong transactional consistency while the small team stabilizes domain boundaries. The design must be enforced by tests and ownership rules; naming folders “modules” is not sufficient.

---

## Target bounded contexts

A bounded context owns its invariants, write use cases, internal models, schema objects and emitted events. Other contexts may use its public application interface or consume its events/read models.

| Bounded context | Owns | Important relationships |
|---|---|---|
| Identity and access | Users, roles, sessions, authentication adapters, authorization policy | Upstream identity for all portals; separate Clerk and back-office trust adapters |
| Seller lifecycle | Onboarding, KYC/status, capabilities, plans, staff access | Supplies approved seller identity/capability to catalog, orders and B2B |
| Customer experience | Customer profile, addresses, preferences, account state | Used by checkout, orders, support and notifications |
| Catalog and inventory | Categories, products, variants, attributes, inventory, moderation | Emits product/inventory changes; no finance logic |
| Pricing and promotions | Price rules, deals, coupons, tax-aware pricing inputs | Produces pricing decisions/snapshots; does not own orders |
| Checkout and orders | Cart validation, checkout orchestration, order aggregate/state machine | Coordinates catalog, pricing, payment and fulfilment using explicit ports |
| Payments | Payment intents, provider events, capture/refund commands, reconciliation status | Does not own seller balances; emits confirmed financial facts |
| Ledger and settlements | Commission, immutable ledger, statements, settlements, payouts, COD receivables | Consumes order/payment/refund facts; owns financial truth |
| Fulfilment and delivery | Shipment, package, assignment, routing, courier adapters, delivery proof | Consumes fulfilment requests and emits shipment/delivery state |
| Returns and refunds | Eligibility, return workflow, pickup, inspection, refund request | Coordinates orders, fulfilment, payments and ledger through commands/events |
| B2B commerce | Buyer organization, enquiry/quote/PO, credit, B2B order operations, ERP integration | Reuses identity/tax/provider ports; maintains B2B-specific invariants |
| Services marketplace | Service catalog, quote/booking, provider assignment, service payment facts | Separate lifecycle from physical product orders |
| Trust, support and audit | Reviews, cases, chat escalation, moderation, immutable audit | Consumes context references; must not become a generic write gateway |
| Content, search and notifications | CMS, read projections, search documents, email/push/in-app delivery | Asynchronous consumers; natural early extraction candidates |
| Platform configuration and reporting | Versioned operational settings, compliance reports, exports | Reads governed projections; must avoid locking core transactional tables |

### Dependency direction rules

1. Transport adapters call application services.
2. Application services orchestrate domain objects and declared ports.
3. Domain code depends on no NestJS, Prisma or provider SDK.
4. Infrastructure adapters implement ports.
5. A context cannot import another context's infrastructure or repository internals.
6. Cross-context reads use a public query interface or projection.
7. Cross-context writes use a public command interface; asynchronous side effects use events/outbox.
8. Shared packages carry versioned contracts, value objects and cross-cutting primitives—not multi-context business logic.

---

## Target runtime topology

### Edge and presentation plane

- Managed DNS/CDN/WAF/load balancer terminates TLS, absorbs abuse and serves public static/media content.
- Next.js web runs at least two stateless replicas across failure domains.
- Customer, seller, B2B and admin remain separate navigation/auth experiences even if deployed from one Next.js artifact.
- Mobile clients call the same versioned API contract; mobile-specific composition stays in the API/mobile façade only when necessary.

### Application plane

- NestJS API runs at least two stateless replicas.
- Instances contain no authoritative session, rate-limit, cache or job state in memory.
- API writes complete local transactions and durable outbox records; slow provider work is asynchronous.
- WebSocket functionality uses a shared adapter/backplane when multiple replicas are active, or is routed to a separately scalable real-time runtime.

### Async plane

Separate worker deployment groups by failure and resource profile:

1. **Critical transactional:** payment/courier events, order timeouts, refund/settlement transitions.
2. **Communication:** email, push, in-app notifications.
3. **Projection:** search indexing, cache invalidation, analytics projections.
4. **Heavy batch:** reports, exports, routing batches, cleanup and imports.
5. **Integration:** ERP/courier/provider retries.

All workers use atomic claims or queue leasing, idempotency keys, exponential backoff with jitter, maximum attempts, terminal failure storage, safe replay and reconciliation.

### Data plane

- PostgreSQL remains the transactional system of record.
- Use a managed HA primary with point-in-time recovery, encrypted backups and tested restore.
- PgBouncer or equivalent controls connection pressure as API/worker replicas grow.
- Read replicas may serve reports/projections only when stale reads are acceptable; never route command validation or financial truth to a lagging replica.
- Redis is an accelerator/backplane for rate limiting, cache, BullMQ and real-time fan-out. The application still starts and provides documented degraded behavior when Redis is absent.
- Object storage owns media/private documents; CDN serves safe public assets through signed or normalized keys.
- Search begins with PostgreSQL projections/extensions and can move to a dedicated engine only when measured query/scale requirements justify it.

---

## Consistency and communication rules

### Keep synchronous

Use synchronous calls when the caller cannot safely respond without the result:

- Authentication and authorization.
- Checkout validation and current price/inventory decision.
- Creation of payment intent.
- Local order state transition.
- Immediate eligibility decisions.

Synchronous external-provider calls require deadlines, safe retries and explicit user-facing uncertainty. Never hold a database transaction open across a remote call.

### Make asynchronous

Use durable async processing for:

- Email/push/in-app notifications.
- Search indexing and cache invalidation.
- Reports and exports.
- ERP/courier synchronization after durable local acceptance.
- Analytics, audit rollups and non-blocking personalization.
- Long-running routing and cleanup work.

### Transactional outbox standard

For every state change that must publish work:

1. Update the aggregate and insert an outbox record in one PostgreSQL transaction.
2. A worker claims unpublished rows with lease/lock semantics.
3. The consumer processes with a unique idempotency key.
4. Success records publication/consumption; retries are bounded.
5. Terminal failures remain visible with an operator action and reconciliation query.

“Exactly once” is not promised. The system uses **at-least-once delivery plus idempotent effects**.

### Financial correctness

- Orders store immutable price, tax, discount, seller and currency snapshots.
- Payment provider events are append-only and uniquely constrained by provider event ID.
- Ledger entries are immutable and balanced; corrections use compensating entries.
- Payout creation has idempotency, approval separation, provider reconciliation and audit.
- Refund, cancellation and return workflows are explicit state machines, not free-form status updates.

---

## Availability and degraded operation

| Dependency failure | Required behavior |
|---|---|
| Redis unavailable | API starts; DB/local fallback operates where documented; global rate limiting shifts to edge; queue-dependent work persists for later processing |
| Search projection delayed | Product/category canonical reads remain available; display a reduced search experience rather than fail checkout |
| Email/push provider unavailable | Commit business action; queue retry; expose terminal delivery status to operators |
| Maps/routing provider unavailable | Preserve address/order actions; use stored serviceability or manual assignment workflow |
| Courier provider unavailable | Accept durable shipment request where safe; retry asynchronously; allow manual handling |
| Payment provider uncertain | Keep payment/order in pending reconciliation state; never infer success or duplicate capture |
| Worker backlog | Core API remains available; autoscale/partition workers; alert on queue age, not only queue size |
| Read replica lag | Route consistency-sensitive reads to primary; report projection freshness |
| PostgreSQL unavailable | Fail closed for writes, serve only explicitly safe cached public reads, page operators |

---

## Security trust zones

1. **Public edge:** WAF, bot protection, TLS, request size limits and coarse distributed rate limiting.
2. **Customer/seller/B2B/delivery zone:** Clerk tokens verified by the API; roles and resource ownership enforced server-side.
3. **Back-office zone:** independent session tokens, shorter lifetime, stronger MFA/step-up for finance and privileged actions, no local-dev identity headers in production.
4. **Provider ingress:** dedicated webhook endpoints, signature verification over raw body, replay protection, idempotent event storage and rapid acknowledgement.
5. **Service/worker zone:** workload identity and least-privilege credentials; internal endpoints are not trusted merely because they are on a private network.
6. **Data zone:** encrypted transit/storage, private payout/document data, key rotation, retention/deletion policy and field-safe logging.

Audit records must include actor, role, action, resource, before/after reference or safe diff, request/correlation ID, timestamp and outcome. Audit storage must be append-oriented and protected from ordinary business-service updates.

---

## Observability and service objectives

### Mandatory telemetry

- Structured JSON logs in web server, API and every worker.
- Correlation/request ID accepted from a trusted edge or generated at ingress and propagated through jobs/events.
- RED metrics per endpoint: request rate, error rate and duration.
- USE metrics for runtime/database/queue resources: utilization, saturation and errors.
- Database metrics: connection usage, transaction duration, lock waits, slow queries, replica lag and storage growth.
- Worker metrics: queue age, claimed/running, retries, terminal failures, stale locks and completion latency.
- Business invariants: checkout success, payment reconciliation lag, unbalanced ledger count, payout failure, inventory oversell and search freshness.

### Initial SLOs

- Storefront/general API: 99.9% monthly availability.
- Checkout/order/payment acceptance: 99.95% monthly availability after HA rollout.
- Read API p95: below 400 ms, excluding external-provider latency.
- Command API p95: below 750 ms, excluding external-provider latency.
- Webhook acknowledgement p95: below 2 seconds with durable async completion.
- Critical jobs: 99% start in 60 seconds; each context defines completion SLO.
- Transactional database: RPO at most 15 minutes and RTO at most 60 minutes, valid only after restore drills demonstrate it.

---

## Evolution stages

### Stage 1 — Production-ready modular monolith

- Enforce context dependencies and schema ownership.
- Add transactional outbox/idempotency standards.
- Add structured API logging, correlation IDs, readiness checks, dashboards and alerts.
- Run two or more stateless web/API replicas.
- Use managed HA PostgreSQL, object storage/CDN and edge WAF/rate limits.
- Split worker groups by criticality/resource profile.
- Make lint, tests, migration replay, security scanning and OpenAPI compatibility blocking CI gates.

### Stage 2 — Read and workload scaling

- Add context-owned read projections for storefront, search, seller dashboard and reporting.
- Introduce PostgreSQL read replicas only for explicitly stale-tolerant queries.
- Partition queues and autoscale workers on queue age.
- Add dedicated search infrastructure only after PostgreSQL search misses measured latency/relevance targets.
- Introduce a warehouse/analytics store when reporting threatens transactional performance.

### Stage 3 — Selective extraction

Extraction requires stable ownership and contracts, independent scale or release need, measurable blast-radius benefit, removed cross-context transactions and an operationally staffed service.

Likely early candidates are notifications, report exports and search indexing. Payments and ledger are strategically separable but should be extracted only after append-only event contracts, reconciliation and operational maturity are proven.

---

## Priority risk register

| Priority | Risk | Immediate control |
|---|---|---|
| Critical | Main CI does not run the existing tests/lint | Make lint, unit/integration tests and build blocking |
| Critical | Shared schema permits invariant-bypassing writes | Assign table ownership; add cross-context write fitness tests |
| High | Single-host/single-process production topology | Deploy managed edge and 2+ stateless web/API replicas |
| High | API readiness and structured telemetry are insufficient | Separate liveness/readiness; add Pino/OpenTelemetry-style correlation and dashboards |
| High | Polling/worker duplication or noisy-neighbor effects | Standard claim leases; split worker groups; queue-age alerts |
| High | Per-process rate limiting is inconsistent across replicas | Enforce coarse limits at edge; shared Redis limiter when available; retain safe fallback |
| High | Broad module import graph increases blast radius | Publish context interfaces and dependency allowlists; prohibit internal imports |
| Medium | One schema file reduces ownership visibility | Add schema ownership map now; modularize Prisma schema when tooling/workflow permits |
| Medium | Reporting may load transactional tables | Build projections; impose query budgets; add replica/warehouse only from evidence |
| Medium | Redis fallback can mask reduced guarantees | Define and monitor feature-specific degraded semantics, not only successful bootstrap |

---

## Recommended ADR set

1. **ADR-001 — Evolutionary modular monolith:** accept enforced modular monolith; reject premature domain microservices.
2. **ADR-002 — Bounded-context and schema ownership:** one owner per model/table and invariant.
3. **ADR-003 — Transactional outbox and idempotent consumers:** standard delivery, retry and recovery semantics.
4. **ADR-004 — Separate identity trust planes:** Clerk-facing roles vs standalone back-office sessions.
5. **ADR-005 — Redis as optional accelerator:** define guarantees in normal and degraded modes.
6. **ADR-006 — Financial ledger and reconciliation:** immutable ledger, compensating entries and provider-event idempotency.
7. **ADR-007 — Highly available runtime topology:** stateless replicas, managed database, edge and worker groups.
8. **ADR-008 — API/event compatibility:** versioning and backward-compatibility policy.
9. **ADR-009 — Observability and SLO policy:** telemetry fields, service objectives, paging and error budgets.
10. **ADR-010 — Service extraction criteria:** evidence required before physical decomposition.

---

## 30/60/90-day architecture program

### Days 0–30: establish control

- Publish the context map, ownership map and ADRs 001–005.
- Add tests/lint/security/migration/API compatibility to CI.
- Add request IDs, structured API logs and readiness checks.
- Baseline endpoint latency, slow queries, queue age and error rates.
- Identify and allowlist current cross-context writes; forbid new ones.

### Days 31–60: make async and data changes safe

- Standardize outbox records, claims, idempotency, retries, dead letters and replay.
- Add clean/upgrade migration replay and expand/migrate/contract policy.
- Split worker workloads into critical, communication, projection, batch and integration groups.
- Load-test browse, search, checkout, order submission and webhook bursts.
- Restore a production-like backup and record actual RPO/RTO.

### Days 61–90: prove scale and resilience

- Rehearse or deploy multiple web/API replicas.
- Validate WebSocket backplane/session behavior and global rate-limit semantics.
- Run Redis-down, provider-timeout, queue-backlog and database-recovery exercises.
- Add architecture debt budget and quarterly context review.
- Choose the next scaling investment from the measured bottleneck; do not start service extraction without meeting the extraction gate.

---

## Final architecture position

1HandIndia already has enough deployment components. The next architectural step is to make boundaries, state transitions and operational guarantees explicit and testable. A rigorously governed modular monolith will scale materially further than an ungoverned system and is more reversible than an early microservice split. Build service seams now; pay the distributed-systems cost only where production evidence proves that it buys more than it costs.
