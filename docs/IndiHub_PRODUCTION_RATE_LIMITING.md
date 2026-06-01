# 1HandIndia Production Rate Limiting

Rate limiting is now implemented in two layers for the first Ubuntu VPS production launch:

1. **Nginx reverse-proxy limits** stop abusive traffic before it reaches Node.
2. **NestJS API limits** apply route-aware throttling inside the application.

## Nginx Layer

Use `deploy/nginx/indihub-rate-limits.conf` as the starting snippet for the VPS server block.

Recommended first-launch limits:

| Surface | Limit |
|---|---:|
| `/api/products` product list/search | 30 requests/min per IP |
| `/api/products/:slug` product detail | 240 requests/min per IP |
| `/api/auth`, `/api/admin/auth` | 20 requests/min per IP |
| `/api/checkout`, `/api/cart`, `/api/account/orders` | 60 requests/min per IP |
| `/api/admin/*` | 120 requests/min per IP |
| other `/api/*` | 300 requests/min per IP |

Important VPS rule:

- Keep the NestJS API port private, for example `127.0.0.1:4000`.
- Do not expose `4000` publicly if `INDIHUB_TRUST_PROXY_HEADERS=true`, because direct public access could spoof proxy headers.

## API Layer

The API uses an in-memory limiter at bootstrap:

- Anonymous product search: `30/min`.
- Authenticated product search: `100/min`.
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
INDIHUB_RATE_LIMIT_PRODUCT_DETAIL_PER_MINUTE=240
INDIHUB_RATE_LIMIT_CHECKOUT_PER_MINUTE=60
INDIHUB_RATE_LIMIT_AUTH_PER_MINUTE=20
INDIHUB_RATE_LIMIT_ADMIN_PER_MINUTE=120
INDIHUB_RATE_LIMIT_PUBLIC_PER_MINUTE=300
```

For local development, defaults are already usable. Set `INDIHUB_API_RATE_LIMIT_ENABLED=false` only for controlled debugging.

## Query Protection

Public product search now also protects the database:

- `search` is trimmed at API validation.
- Search term length must be at least `2` characters when provided.
- Search term length is capped at `120`.
- `limit` is capped at `100`.
- Storefront search uses `limit=24`.
- Storefront search uses cursor pagination, so it does not need expensive total-count queries.

## Later Redis Upgrade

The current API limiter is correct for one API process on one VPS. When production uses multiple API processes or multiple servers, replace the in-memory counter storage with Redis-backed counters so all API instances share the same rate-limit state.
