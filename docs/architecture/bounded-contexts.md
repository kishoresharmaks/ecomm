# Bounded Contexts and Dependency Direction

## Architectural style

1HandIndia remains an evolutionary modular monolith. Contexts share the NestJS runtime and PostgreSQL instance but own business rules and writes. Cross-context collaboration should use exported application services, typed commands/queries, or durable events—not imports of internal repositories or uncoordinated writes.

## Context map

| Context | API roots | Responsibility | Primary upstream/downstream relationships |
|---|---|---|---|
| Identity & Access | `auth`, `customers`, selected `admin/*` | Sessions, users, roles, customer identity, back-office credentials | Upstream policy provider for all protected contexts |
| Seller Management | `sellers`, `admin/sellers`, `delivery-partner-applications` | Seller lifecycle, verification, subscriptions, partner onboarding | Supplies approved seller state to catalog, orders, services, B2B |
| Catalog | `categories`, `products`, `product-templates`, `hsn-master`, `sac-master` | Product taxonomy, listings, variants, inventory | Publishes catalog/search changes; reads seller eligibility |
| Merchandising | `coupons`, `deals`, `reviews` | Promotions, eligibility, redemption, reviews | Supplies pricing inputs to shopping and orders |
| Shopping Experience | `cart`, `checkout`, `storefront`, `mobile` | Storefront reads, cart, checkout orchestration | Composes catalog, merchandising, identity, location and order commands |
| Order Management | `orders`, `returns` | Order aggregate, seller splits, fulfilment state, returns/refunds workflow | Coordinates finance, delivery, notifications, tax through contracts/events |
| Finance & Tax | `finance`, `payments`, `reports`, `tax`, `market` | Payments, ledger, commissions, settlements, payouts, taxation and reporting | Receives immutable business facts; owns financial state and reconciliation |
| Services Marketplace | `services-marketplace` | Service listings, quotes, bookings, service payments/refunds | Uses seller, customer, finance, tax and communications contracts |
| B2B Commerce | `b2b` | Enquiry-to-cash, negotiation, procurement and ERP integration | Uses identity, seller, finance, location and communications contracts |
| Content & Support | `cms`, `support`, `chat` | Managed content, support cases and conversations | Uses identity and communications; does not own commerce decisions |
| Communications | `notifications` | Email, push and notification preferences/delivery | Downstream of domain events; must not become business workflow owner |
| Discovery | `search` | Search projections and indexing jobs | Downstream projection of catalog, seller, deals and reviews |
| Location & Routing | `locations`, `maps` | Address catalog, serviceability, routes and distance | Shared domain capability used by checkout and fulfilment |
| Administration | remaining `admin` composition | Back-office use cases and dashboards | Orchestrates public context contracts; no independent duplicate business rules |
| Platform | `audit`, `common`, `documents`, `health`, `prisma`, `rate-limit`, `settings`, `storage`, `types` | Cross-cutting infrastructure | May be used by all contexts; must not depend on business contexts |
| Worker Runtime | `apps/worker/src` | Durable background execution and projections | Consumes owned jobs/events; follows `worker-job-contract.md` |
| Shared Packages | `packages/*` | Stable configuration, types, validators, UI and database client | Must remain business-neutral unless explicitly assigned ownership |

## Dependency rules

1. Composition roots may wire any context but contain no business rules.
2. Platform and shared packages are allowed targets, not business orchestration sources.
3. A context may import only another context's explicit public interface. Current direct relative imports are tracked as debt in the machine baseline.
4. Controllers do not query Prisma directly. Application/domain services coordinate owned repositories or Prisma access.
5. Prisma model ownership means write authority and schema-change accountability. Other contexts may read when documented, but may not mutate another owner's state without an exported command or reviewed transaction contract.
6. Payment, payout, ledger, order, return, tax, permission, and audit changes require focused tests and owner review.
7. Cross-context asynchronous delivery uses an outbox or durable job record written in the same transaction as the originating state change.
8. Consumers are idempotent and assume at-least-once delivery.
9. Redis is an accelerator. No correctness invariant may depend solely on Redis availability.
10. Reporting and search use read models/projections and never become sources of transactional truth.

## Public contract convention

New context APIs should be exposed from a small `public.ts` or application-service export rather than importing arbitrary internal files. A public contract may contain:

- Commands and command results.
- Queries and immutable read DTOs.
- Domain event schemas with explicit versions.
- Narrow provider interfaces.

It must not expose Prisma delegates, transaction clients, mutable ORM entities, controller types, or private provider credentials.

## Extraction criteria

A context becomes a service candidate only when all apply:

- It requires sustained independent scaling of at least three times the core API.
- It has caused repeated blast-radius incidents or needs independent availability.
- A clearly accountable team owns its release and operations.
- Its versioned APIs/events have remained stable for two quarters.
- Cross-context database transactions have been replaced by outbox/saga semantics.
- Monitoring, on-call, deployment, migration, and data-reconciliation budgets exist.

Until then, module boundaries are cheaper and safer than network boundaries.
