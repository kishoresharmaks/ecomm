# 1HandIndia PostgreSQL Advanced Search

**Last updated:** 2026-06-08

## Scope

Advanced marketplace search is implemented with PostgreSQL only. Redis is not used for search indexing, search caching, search suggestions, or search rate limiting.

## Public API

| Endpoint | Purpose |
|---|---|
| `GET /api/search` | Product, store, and category search with filters, sorting, and cursor pagination |
| `GET /api/search/suggestions` | Debounced typeahead suggestions for products, stores, and categories |
| `GET /api/products` | Backward-compatible product listing/search API |

Request budgets:

- `q` is required for new search endpoints, minimum `2` and maximum `120` characters.
- Suggestions cap `limit` at `10`.
- Search caps `limit` at `50`.
- Search uses cursor pagination and does not run total-count queries.
- Invalid product-only filters with store/category-only searches return `400`.
- Search SQL runs under a PostgreSQL statement timeout.

## Index Tables

`SearchDocument` is the PostgreSQL inverted-index table for:

- `PRODUCT`
- `STORE`
- `CATEGORY`

It stores normalized title/subtitle/search text, entity IDs, category/seller IDs, price range, rating, review count, stock/deal flags, rank boost, source update time, and visibility status.

PostgreSQL indexes:

- Generated `tsvector` column for title, subtitle, and search text.
- GIN full-text index on visible search documents.
- `pg_trgm` GIN indexes for partial and typo-like matching.
- Filter indexes for entity type, visibility, seller, category, and updated time.

`SearchIndexJob` is the durable DB-backed indexing queue. Product, seller, and category changes enqueue deduped jobs. API/admin and worker processors claim jobs using `FOR UPDATE SKIP LOCKED`, retry failed jobs with attempt counts, and persist the latest error note.

## Ranking

Relevance scoring prioritizes:

- Exact normalized title match.
- Title prefix match.
- Product/store/category entity match.
- Full-text rank.
- Trigram similarity.
- Rank boost from featured products, product count, review count, and active deals.
- Small boosts for in-stock, active deal, rating, review count, and freshness.

Supported sorts:

- `relevance`
- `newest`
- `price_asc`
- `price_desc`
- `rating`
- `discount`

## UI

The storefront header uses debounced suggestions, keyboard navigation, and browser `localStorage` recent searches.

The `/search` page shows:

- Product, store, and category results.
- Desktop filter sidebar.
- Mobile filter sheet.
- Filter chips.
- Empty state with suggested terms.
- Cursor-based load more.

Filters include category, seller/store, price range, stock, deals, rating, and sort.

## Operations

Large traffic protection is intentionally outside Redis:

- Nginx/CDN `limit_req` is the shared first-line limiter.
- Optional anonymous GET micro-cache is configured in `deploy/nginx/indihub-rate-limits.conf`.
- `proxy_cache_lock` prevents duplicate popular-query stampedes.
- Authenticated search requests bypass Nginx micro-cache.
- App-level limiter remains a secondary per-process guard.
- PgBouncer should be used for runtime API connection pooling.

Admin controls:

- `GET /api/admin/search` shows search job status counts.
- `POST /api/admin/search/reindex` enqueues a full reindex and writes an audit log.
- `POST /api/admin/search/jobs/process` processes jobs manually.
- `GET /api/admin/search/explain` returns an `EXPLAIN` plan for verification.

## Rollout Notes

Apply the Prisma migration in a controlled database window. Do not use `db:push` on staging or production. After the migration:

1. Run `pnpm.cmd run db:generate`.
2. Run `pnpm.cmd db:validate`.
3. Start the worker with `SEARCH_INDEX_WORKER_ENABLED=true`.
4. Trigger admin full reindex.
5. Verify `/api/admin/search/explain?q=<term>` shows GIN/trigram-backed plans.
6. Open `/search?q=<term>` and check product, store, and category results.
