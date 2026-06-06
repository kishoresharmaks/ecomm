# 1HandIndia Production Ecommerce Optimization Plan

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Date:** 2026-06-01  
**Scope:** Production database, caching, search, pagination, and analytics readiness  
**Stack:** PostgreSQL, Prisma, NestJS API, Next.js web, Redis/BullMQ worker

## 1. Executive Decision

These 10 optimizations are valid for a serious production ecommerce platform, but they should not all be applied at the same time.

For the current 1HandIndia Phase 1 codebase, the safest rollout order is:

1. Keep current Prisma schema indexes and add production-only SQL indexes for hot read paths.
2. Add PostgreSQL full-text/GIN indexes for product search.
3. Add cursor pagination to public product lists, admin orders, audit logs, notifications, seller orders, and B2B lists.
4. Add Nginx and API-level rate limiting for search, auth, checkout, admin, and public API routes.
5. Add VPS PostgreSQL runtime connection-pool configuration before production deployment.
6. Add Redis caching for homepage/catalog/settings/read-heavy APIs, with explicit invalidation.
7. Keep current atomic inventory decrement, then add explicit row locking if concurrency tests show contention.
8. Add materialized analytics views once real order volume begins.
9. Add read replicas after production traffic proves read pressure.
10. Partition orders only after growth, because it is a major database migration.

## 2. Current Repo Status

| Optimization | Current Status | Notes |
|---|---|---|
| Read replicas | Not implemented | The database package currently uses one `DATABASE_URL` runtime connection. |
| Proper indexing | Implemented and expanded | Prisma schema has baseline indexes, and `20260601090000_production_ecommerce_optimizations` adds hot-path list/search indexes. |
| Partial indexes | Implemented | Raw SQL migration adds partial indexes for live approved products, approved sellers, and open fulfilment orders. |
| Partition orders table | Not implemented | This should be a later migration, not a Phase 1 quick patch. |
| Redis caching | Partially implemented | Redis/BullMQ exists for email queue jobs when `REDIS_URL` is configured. API response caching is not yet implemented. |
| VPS PostgreSQL pooling | Config prepared | Runtime `DATABASE_URL`, migration `DATABASE_DIRECT_URL`, and future `DATABASE_READ_URL` are documented/configured. Production target is the client's own PostgreSQL server. PgBouncer can run on the VPS when traffic grows, but Neon-style managed pooling is not the production assumption. |
| Full-text search with GIN | Implemented | Migration adds `pg_trgm` and GIN indexes; public product search now uses ranked PostgreSQL full-text search. |
| Search/API rate limiting | Implemented | Nginx deployment snippet protects the VPS before Node, and the NestJS API has route-aware in-memory rate limiting for single-instance launch. |
| Inventory row locking | Atomic safety plus test | Checkout uses transaction plus atomic conditional decrement. New concurrency test proves two customers cannot oversell one stock unit. |
| Cursor pagination | Implemented for large lists | Cursor pagination now covers products, orders, audit logs, notifications, B2B enquiries/business buyers, and key finance lists. |
| Materialized analytics views | Not implemented | Reports currently use live aggregate/groupBy queries. |

## 2A. Before Production Requirement Status

This section answers what is required before the first real production launch, and what is already done enough for the current Phase 1 codebase.

| Optimization | Needed Before First Production Launch? | Current State | Before-Launch Action |
|---|---|---|---|
| Proper indexing | Yes | Done in code | Apply the new SQL migration in staging and verify hot queries with `EXPLAIN (ANALYZE, BUFFERS)`. |
| Partial indexes | Yes | Done in code | Apply `20260601090000_production_ecommerce_optimizations` in staging/production migration flow. |
| Full-text search with GIN | Yes | Done in code | Apply migration, then test catalogue search against staging data. |
| PostgreSQL connection pooling | Yes | Config-ready | Put the VPS runtime PostgreSQL URL in `DATABASE_URL`. If PgBouncer is installed on the VPS, use the PgBouncer runtime URL there and keep the direct PostgreSQL URL in `DATABASE_DIRECT_URL`. |
| Cursor pagination | Recommended before production | Done for major large lists | Keep backward-compatible page/limit, but use cursor for large product/order/log/B2B/finance screens. |
| Search/API rate limiting | Yes | Done in code/docs | Install the Nginx snippet on the VPS, keep the API private on localhost, and leave API in-memory limiting enabled for the first single-instance launch. |
| Redis caching | Recommended before production | Partly done | Redis/BullMQ email queue is wired. Add API response caching for homepage, CMS, category tree, public stores, and safe catalogue reads. |
| Inventory row locking / stock safety | Core safety is done | Concurrency-tested | Current checkout uses atomic conditional stock decrement and has a two-customer low-stock race test. Explicit `FOR UPDATE` can be added later if high contention appears. |
| Materialized views for analytics | Not required for first launch | Not done | Live aggregate reports are acceptable for Phase 1. Add materialized views after real reporting volume grows. |
| Read replicas | Not required for first launch | Not done | Add only after production read traffic proves the need. Avoid replicas for checkout, payments, inventory, admin sessions, and payouts. |
| Partition orders table | Not required for first launch | Not done | Add only after large order/log volume and after staging backup/restore rehearsal. |

### First Production Must-Do From This Plan

Before the first production launch, the optimization must-do list is:

1. Apply the production SQL migration in staging and production.
2. Configure the VPS PostgreSQL runtime URL, and add PgBouncer on the VPS if expected traffic or worker count requires it.
3. Run staging query-plan checks for product search, product lists, order lists, audit logs, notifications, B2B, and finance lists.
4. Install the Nginx rate-limit snippet for `/api/products`, auth, checkout/cart/order, admin, and public API routes.
5. Keep API rate limiting enabled and set `INDIHUB_TRUST_PROXY_HEADERS=true` only when the Node API port is private behind Nginx.
6. Run the checkout stock concurrency test as part of API production checks.

### Already Good Enough For First Launch

These items are already acceptable for early production:

- Baseline Prisma indexes exist across core marketplace tables.
- Partial SQL indexes and GIN product-search indexes are now present in a migration.
- Public product search uses PostgreSQL full-text ranking for searched catalogue requests.
- Cursor pagination is available for the major large-list APIs while keeping existing page/limit compatibility.
- Search abuse protection is available at both Nginx and NestJS API layers for a single Ubuntu VPS launch.
- Checkout stock decrement is atomic, guarded by stock availability, and covered by a low-stock concurrency test.
- Redis/BullMQ is already wired for email queue jobs when `REDIS_URL` is configured.
- Reports use database aggregates and can stay live-query based during early Phase 1.

### Implemented On 2026-06-01

- Added `prisma/migrations/20260601090000_production_ecommerce_optimizations/migration.sql` with partial indexes, GIN product search indexes, and cursor/list hot-path indexes.
- Added VPS PostgreSQL runtime/direct/read database URL configuration through `.env.example`, `packages/config`, and `prisma.config.ts`.
- Added cursor pagination helpers in `apps/api/src/common/pagination.ts`.
- Updated public product search to use ranked PostgreSQL full-text search with safe parameterized Prisma raw SQL.
- Added cursor support to product, order, audit, notification, B2B, and key finance list APIs.
- Added API-level in-memory route-aware rate limiting for anonymous search, authenticated search, product detail, auth, checkout/cart/order, admin/finance, and general public API traffic.
- Added `deploy/nginx/indihub-rate-limits.conf` and `docs/IndiHub_PRODUCTION_RATE_LIMITING.md` for the Ubuntu VPS Nginx layer and later Redis-backed rate-limit upgrade path.
- Added backend integration coverage for two customers concurrently checking out the final stock unit.
- Verification passed: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/api test` with 23 files and 133 tests, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test` with 11 files and 31 tests, and `pnpm.cmd --filter @indihub/web build`.

### Later Scale Work

These should stay out of the first production launch unless staging load tests prove they are needed:

- Read replicas.
- Order table partitioning.
- Materialized analytics views.
- Explicit inventory `FOR UPDATE` locking beyond the current atomic decrement.

## 3. Optimization Details

### 3.1 Read Replicas

**Recommendation:** Later production optimization, not first launch blocker.

Add read replicas when customer browsing, admin lists, reports, and public product search create real read load.

Implementation approach:

- Keep checkout, payment verification, cart mutation, stock updates, admin sessions, seller payout changes, and audit writes on the primary database.
- Add a separate read-only Prisma client using `DATABASE_READ_URL`.
- Route safe read-only services through a small `DatabaseReadService`.
- Never use replica reads immediately after writes where stale data can confuse checkout, payments, stock, or admin approvals.

Recommended env shape:

```env
DATABASE_URL="postgresql://indihub_app:change_me@127.0.0.1:5432/indihub?schema=public"
DATABASE_DIRECT_URL="postgresql://indihub_owner:change_me@127.0.0.1:5432/indihub?schema=public"
DATABASE_READ_URL=""
```

Good first read-replica candidates:

- Storefront homepage product/category rails.
- Public product listing/search.
- Public store pages.
- CMS published pages/banners/sections.
- Admin reports after materialized views are available.

Avoid replica reads for:

- Cart and checkout.
- Payment callback/webhook verification.
- Inventory stock decrement.
- Admin login/session validation.
- Seller settlement/payout workflows.

### 3.2 Proper Indexing

**Recommendation:** Immediate production hardening.

The schema already has useful B-tree indexes, especially around:

- Products: seller, category, status, approval, featured, created date.
- Orders: customer, status, payment, delivery, created date.
- Payments: order, status, provider identifiers.
- Delivery: partner assignment, delivery status, COD collection.
- Audit and notification logs: actor/entity/status/date patterns.

Before launch, run `EXPLAIN (ANALYZE, BUFFERS)` against real-seeded data for:

- Public product listing by category.
- Product search.
- Admin orders list with status/date filters.
- Seller orders list.
- Audit log list.
- Notification log list.
- Finance settlement/payout list.

Suggested production SQL indexes to evaluate:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_id_desc
ON orders (created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_created_id_desc
ON orders (customer_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_seller_created
ON order_items (seller_id, created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_id_desc
ON audit_logs (created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_logs_status_created_id
ON notification_logs (status, created_at DESC, id DESC);
```

### 3.3 Partial Indexes

**Recommendation:** Immediate production hardening for hot filtered tables.

Partial indexes are valuable because most ecommerce reads only need live records, not archived/deleted/draft records.

Suggested SQL:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_public_active_created
ON products (created_at DESC, id DESC)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_public_category_created
ON products (category_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_public_seller_created
ON products (seller_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sellers_public_approved_store
ON sellers (store_name, id)
WHERE deleted_at IS NULL
  AND status = 'APPROVED'
  AND approval_status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_open_fulfilment
ON orders (created_at DESC, id DESC)
WHERE order_status <> 'CANCELLED'
  AND delivery_status <> 'DELIVERED';
```

Prisma schema cannot fully express all production partial indexes cleanly. Keep these in a reviewed SQL migration or production DBA script, and verify with `EXPLAIN`.

### 3.4 Partition Orders Table

**Recommendation:** Later optimization after real order volume.

Partitioning is powerful, but it is also a heavy database design decision. It affects foreign keys, Prisma migrations, backups, restore drills, analytics, and operational scripts.

Use partitioning when:

- `orders`, `order_items`, `order_status_events`, `payments`, and delivery/payment event tables are large enough that indexes and materialized views are not enough.
- Old orders are mostly read by date range.
- Archival and retention policies are clear.

Recommended future strategy:

- Range partition `orders` by `created_at` monthly or quarterly.
- Keep recent partitions hot.
- Add matching indexes per partition.
- Consider partitioning large append-only logs too: `audit_logs`, `notification_logs`, `order_status_events`, `payment_events`.
- Build the migration in staging with restore rehearsal before production.

Do not start by partitioning only because it sounds advanced. For Phase 1 and early production, strong indexes plus PgBouncer plus caching will give safer gains.

### 3.5 Redis Caching

**Recommendation:** Add before launch for read-heavy surfaces.

Redis is already part of the locked stack and email queue path. The next step is API response caching for read-heavy public data.

First cache targets:

- Storefront homepage payload.
- Published CMS banners and homepage sections.
- Category tree.
- Public store directory.
- Popular public product listing filters.
- Platform settings that are read frequently at checkout/display time.

Cache rules:

- Use short TTLs for product and homepage data, for example 30 to 120 seconds.
- Use event invalidation after product approval/archive, seller suspension, category changes, CMS publish/delete, and settings save.
- Never cache checkout totals, cart state, admin sessions, payment verification, or inventory mutation responses.

Recommended service shape:

- `CacheService` wraps `ioredis`.
- `cache.getJson<T>(key)` and `cache.setJson(key, value, ttlSeconds)`.
- `cache.delByPrefix(prefix)` for CMS/catalog invalidation.
- Fallback to direct DB reads if Redis is unavailable, with a warning log.

### 3.6 VPS PostgreSQL Connection Pooling

**Recommendation:** Required before real production traffic.

NestJS API workers, background workers, migrations, and admin tools can create many database connections. For the first production launch, the target is the client's own PostgreSQL server on the VPS or private VPS network. PgBouncer is optional at very low traffic, but recommended once API/worker process counts increase.

Recommended split:

- Runtime app uses `DATABASE_URL`.
- If PgBouncer runs on the VPS, `DATABASE_URL` points to PgBouncer, usually `127.0.0.1:6432`.
- Prisma CLI/migrations and large imports use direct PostgreSQL through `DATABASE_DIRECT_URL`, usually `127.0.0.1:5432`.
- Read replica, if used later, has its own runtime URL: `DATABASE_READ_URL`.

Code/docs changes needed:

- Keep `.env.example` focused on VPS PostgreSQL URLs and pool variables.
- Keep `prisma.config.ts` preferring non-empty `DATABASE_DIRECT_URL` for migrations when available.
- Keep `packages/database/src/index.ts` runtime on `DATABASE_URL`.
- Tune `PG_POOL_MAX` per Node process, not globally. For one API process plus one worker on a small VPS, start with API `PG_POOL_MAX=10` and worker `PG_POOL_MAX=4` if they have separate process env files.

Deployment note:

- Neon or any other hosted database can remain a development/staging test database. Production readiness should be verified against the actual VPS PostgreSQL server before launch.

### 3.7 Full-Text Search With GIN

**Recommendation:** Immediate improvement for Phase 1 product search.

Current product search uses string `contains` filters. That is acceptable during early development, but it will not scale well for a real catalogue.

Use PostgreSQL search for Phase 1, keeping the future Meilisearch/OpenSearch boundary open.

Suggested SQL:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search_text_trgm
ON products USING GIN (search_text gin_trgm_ops)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search_vector
ON products USING GIN (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(search_text, '')
  )
)
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED';
```

Then update public product search to use ranked SQL:

```sql
SELECT *
FROM products
WHERE deleted_at IS NULL
  AND status = 'ACTIVE'
  AND approval_status = 'APPROVED'
  AND to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(search_text, ''))
      @@ plainto_tsquery('simple', $1)
ORDER BY
  ts_rank(
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(search_text, '')),
    plainto_tsquery('simple', $1)
  ) DESC,
  created_at DESC,
  id DESC
LIMIT $2;
```

Use Prisma `$queryRaw` only in a small search repository/helper, with parameterized values.

### 3.8 Inventory Row Locking

**Recommendation:** Current checkout is already oversell-safe, but row locking is useful for high-contention products.

Current checkout flow:

- Runs inside a Prisma transaction.
- Validates cart products and variants.
- Uses `updateMany` with `stockQuantity >= item.quantity`.
- Decrements stock only if the conditional update matches exactly one row.
- Creates an inventory movement.

That pattern prevents overselling because the stock decrement is atomic.

Optional high-concurrency upgrade:

```sql
SELECT id
FROM product_variants
WHERE id = ANY($1::uuid[])
ORDER BY id
FOR UPDATE;
```

Then re-read stock and price inside the same transaction before creating the order.

Rules:

- Lock variant rows in deterministic order to avoid deadlocks.
- Keep payment-provider calls outside the DB lock when possible.
- Keep transaction duration short.
- Add a concurrency test that fires multiple checkout attempts for one low-stock variant.

### 3.9 Cursor Pagination

**Recommendation:** Immediate API hardening for large lists.

Current pagination uses page/limit offset through `apps/api/src/common/pagination.ts`. Offset pagination is easy for small data, but it gets slower and less stable when orders, logs, notifications, and products grow.

Add cursor pagination for:

- Public product listing/search.
- Admin orders.
- Seller orders.
- Customer order history.
- Audit logs.
- Notification logs.
- B2B enquiries.
- Finance ledgers/payouts/settlements.

Recommended cursor format:

```text
base64url(json({ createdAt: "2026-06-01T10:00:00.000Z", id: "uuid" }))
```

Query rule:

```sql
WHERE (created_at, id) < ($cursor_created_at, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT $limit_plus_one;
```

Response shape:

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": "string-or-null",
    "hasNextPage": false
  }
}
```

Keep page/limit for small admin pages if needed, but public and append-only lists should move to cursor pagination first.

### 3.10 Nginx And API Rate Limiting

**Recommendation:** Required before first production traffic.

Search, auth, checkout, and admin endpoints need abuse protection before requests reach expensive application logic. For the first single Ubuntu VPS launch, use Nginx for edge protection and the NestJS in-memory limiter for route-aware application limits.

Current production shape:

- Nginx protects `/api/products`, `/api/products/:slug`, auth, checkout/cart/order, admin, and all remaining `/api/*` routes before traffic reaches Node.
- NestJS applies separate counters for anonymous search, authenticated search, product details, auth, checkout/cart/order, admin/finance, and public API routes.
- Public product search trims input, requires at least 2 characters when a search term is provided, caps search at 120 characters, caps limit at 100, and storefront search uses `limit=24`.
- Cursor-based storefront search avoids expensive total-count queries.

Recommended first-launch limits:

| Surface | First-launch limit |
|---|---:|
| Anonymous product search | 30 requests/min |
| Logged-in product search | 100 requests/min |
| Product detail pages | 240 requests/min |
| Auth/sign-in APIs | 20 requests/min |
| Checkout/cart/order APIs | 60 requests/min |
| Admin/finance APIs | 120 requests/min |
| Other public APIs | 300 requests/min |

Deployment files:

- `deploy/nginx/indihub-rate-limits.conf`
- `docs/IndiHub_PRODUCTION_RATE_LIMITING.md`

VPS safety rules:

- Keep the NestJS API bound to localhost/private networking, for example `127.0.0.1:4000`.
- Set `INDIHUB_TRUST_PROXY_HEADERS=true` only when direct public access to the Node API port is blocked.
- Keep Redis-backed counters as the later upgrade when multiple API processes or multiple servers are deployed.

### 3.11 Materialized Views For Analytics

**Recommendation:** Add after launch or before launch if seeded data is large.

Current reports use live aggregates. That is good for correctness and Phase 1 simplicity, but materialized views are better once orders grow.

Suggested materialized views:

- `mv_daily_sales`
- `mv_seller_daily_sales`
- `mv_product_daily_sales`
- `mv_payment_daily_status`
- `mv_b2b_daily_enquiries`

Example:

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales AS
SELECT
  date_trunc('day', created_at)::date AS sales_date,
  currency,
  count(*) AS order_count,
  sum(subtotal_paise) AS subtotal_paise,
  sum(shipping_paise) AS shipping_paise,
  sum(platform_fee_paise) AS platform_fee_paise,
  sum(total_paise) AS total_paise
FROM orders
WHERE order_status <> 'CANCELLED'
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_sales_date_currency
ON mv_daily_sales (sales_date, currency);
```

Refresh strategy:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
```

Run refresh jobs through the worker on a schedule after order/payment flows are stable.

## 4. Recommended Implementation Phases

### Phase A - Safe Pre-Production Hardening

- Add VPS PostgreSQL runtime/direct URL env documentation.
- Add raw SQL migration for partial indexes and search GIN indexes.
- Update public product search to use indexed full-text search.
- Add cursor pagination helper and migrate public products plus admin orders first.
- Add Nginx/API rate limiting for search, auth, checkout, admin, and public API traffic.
- Add a checkout concurrency test for low-stock variants.

### Phase B - Runtime Performance

- Add Redis cache service.
- Cache storefront home, category tree, CMS published content, and public store/product rails.
- Add cache invalidation from product approval/archive, CMS publish/delete, category updates, seller suspension, and settings save.
- Add metrics/logging for cache hit/miss and slow DB queries.
- Move API rate-limit counters to Redis if the API runs in multiple processes or multiple servers.

### Phase C - Scale After Real Traffic

- Add read-replica routing for safe read-only services.
- Add materialized analytics views and scheduled refresh worker jobs.
- Evaluate order/log partitioning after real table growth and backup/restore testing.

## 5. Production Acceptance Checklist

- `pnpm.cmd db:validate` passes.
- API typecheck, lint, tests, and build pass.
- Web typecheck, lint, tests, and build pass.
- Raw SQL indexes are applied in staging without table lock issues.
- `EXPLAIN (ANALYZE, BUFFERS)` proves product search and list queries use the expected indexes.
- Nginx rate limiting is installed for the VPS API routes and `nginx -t` passes on the server.
- API 429 responses are verified for excessive anonymous search requests.
- Checkout concurrency test proves no oversell.
- Redis outage fallback proves public pages still work.
- VPS PostgreSQL connection test passes under load. If PgBouncer is installed, test through PgBouncer for runtime traffic and through direct PostgreSQL for migrations.
- Analytics refresh can run without blocking checkout/order writes.
- Backup and restore are tested before partitioning or major SQL migrations.

## 6. Practical Priority For 1HandIndia

For this codebase, the highest-value immediate production optimizations are:

1. Full-text search with GIN.
2. Partial indexes for public products, active sellers, orders, logs, and notifications.
3. Cursor pagination for large lists.
4. Nginx/API rate limiting for search, auth, checkout, admin, and public API traffic.
5. VPS PostgreSQL runtime pooling, with PgBouncer on the VPS when traffic requires it.
6. Redis caching for read-heavy public/CMS/catalog responses.
7. Checkout stock concurrency test around the existing atomic decrement.

Read replicas, order partitioning, and materialized analytics views are important, but they should come after staging load tests or real production volume confirms the need.
