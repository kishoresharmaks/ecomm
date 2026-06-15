# 1HandIndia Production Rate Limiting

Rate limiting is now implemented in two layers for the first Ubuntu VPS production launch:

1. **Nginx reverse-proxy limits** stop abusive traffic before it reaches Node.
2. **NestJS API limits** apply route-aware throttling inside the application.

## Nginx Layer

Use `deploy/nginx/indihub-rate-limits.conf` as the starting snippet for the VPS server block.

Recommended first-launch limits:

| Surface | Limit |
|---|---:|
| `/api/search` advanced storefront search | 30 requests/min per IP |
| `/api/search/suggestions` typeahead suggestions | 20 requests/min per IP |
| `/api/products` legacy product list/search | 30 requests/min per IP |
| `/api/products/:slug` product detail | 240 requests/min per IP |
| `/api/auth`, `/api/admin/auth` | 20 requests/min per IP |
| `/api/checkout`, `/api/cart`, `/api/account/orders` | 60 requests/min per IP |
| `/api/admin/*` | 120 requests/min per IP |
| other `/api/*` | 300 requests/min per IP |

Important VPS rule:

- Keep the NestJS API port private, for example `127.0.0.1:4000`.
- Do not expose `4000` publicly if `INDIHUB_TRUST_PROXY_HEADERS=true`, because direct public access could spoof proxy headers.
- Use the snippet's anonymous GET micro-cache for `/api/search` only after creating the Nginx cache directory with the correct owner and permissions.
- Authenticated search requests bypass the Nginx micro-cache.

## API Layer

The API uses an in-memory limiter at bootstrap:

- Anonymous product search: `30/min`.
- Authenticated product search: `100/min`.
- Anonymous search suggestions: `20/min`.
- Authenticated search suggestions: `60/min`.
- Product detail reads: `240/min`.
- Cart/checkout/order surfaces: `60/min`.
- Admin/finance surfaces: `120/min`.
- Auth/sign-in surfaces: `20/min`.
- General public API: `300/min`.

429 responses are JSON:

```json
{
  "statusCode": 429,
  "message": "Too many searches. Please wait a minute and try again.",
  "error": "Too Many Requests"
}
```

Response headers include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

## Environment Flags

```env
INDIHUB_API_RATE_LIMIT_ENABLED=true
INDIHUB_TRUST_PROXY_HEADERS=true

INDIHUB_RATE_LIMIT_SEARCH_ANON_PER_MINUTE=30
INDIHUB_RATE_LIMIT_SEARCH_AUTH_PER_MINUTE=100
INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_ANON_PER_MINUTE=20
INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_AUTH_PER_MINUTE=60
INDIHUB_RATE_LIMIT_PRODUCT_DETAIL_PER_MINUTE=240
INDIHUB_RATE_LIMIT_CHECKOUT_PER_MINUTE=60
INDIHUB_RATE_LIMIT_AUTH_PER_MINUTE=20
INDIHUB_RATE_LIMIT_ADMIN_PER_MINUTE=120
INDIHUB_RATE_LIMIT_PUBLIC_PER_MINUTE=300
```

For local development, defaults are already usable. Set `INDIHUB_API_RATE_LIMIT_ENABLED=false` only for controlled debugging.

## Query Protection

Public search now also protects the database:

- `q` is trimmed at API validation.
- Search term length must be at least `2` characters when provided.
- Search term length is capped at `120`.
- `/api/search/suggestions` caps `limit` at `10`.
- `/api/search` caps `limit` at `50`; the storefront uses `24`.
- Search uses cursor pagination only, so it does not run expensive total-count queries.
- Search queries run under a PostgreSQL statement timeout.
- Invalid product-only filters with store/category-only searches return `400`.
- Search uses PostgreSQL GIN/trigram indexes over `SearchDocument`.

## No Redis Search Limiter

Do not add Redis for search rate limiting or search caching. Shared protection belongs at Nginx/CDN, while the API process-local limiter remains a secondary guard. If production scales beyond one API process, keep the same pattern: shared edge limits first, PgBouncer for database connection pooling, and strict app query budgets.
