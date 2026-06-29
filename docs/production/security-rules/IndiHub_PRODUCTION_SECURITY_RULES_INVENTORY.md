# 1HandIndia Production Security Rules Inventory

**Project:** 1HandIndia multi-vendor ecommerce marketplace  
**Document type:** Production security, rate-limit, and VPS protection inventory  
**Last updated:** 2026-06-29  
**Domain:** `1handindia.com`  
**Primary sources:** Cloudflare API output supplied on 2026-06-29, `deploy/nginx/indihub-rate-limits.conf`, `docs/IndiHub_PRODUCTION_RATE_LIMITING.md`, `docs/IndiHub_VPS_PRODUCTION_SETUP_RUNBOOK.md`, and `apps/api/src/rate-limit/request-rate-limiter.ts`

## 1. Status Summary

| Layer | Status | Notes |
|---|---|---|
| Cloudflare zone | Active | Zone `1handindia.com` is active on Cloudflare Free Website plan. |
| Cloudflare rate-limit rule | Implemented and enabled | One active rule protects `/api/admin/auth/login`. |
| Cloudflare Security Center findings | Active remediation register added | Findings from 2026-06-23 and 2026-06-24 are tracked in section 4. |
| Security.txt | Remediated in source | Public file added at `apps/web/public/.well-known/security.txt`; deploy required before Cloudflare rescans it as fixed. |
| VPS Nginx rate-limit config | Implemented in repo | The production snippet is available at `deploy/nginx/indihub-rate-limits.conf`. Live Nginx reload must be verified on the VPS. |
| VPS firewall rules | Required by runbook | UFW should allow only SSH, HTTP, and HTTPS publicly. Live UFW status must be verified on the VPS. |
| API application rate limiter | Implemented in code | NestJS uses the in-process request limiter at API bootstrap. |

Important: this file records both verified live Cloudflare state and VPS rules present in this workspace. For VPS, run the verification commands in section 8 to confirm the live server has reloaded the same rules.

## 2. Cloudflare Zone

| Field | Current value |
|---|---|
| Zone name | `1handindia.com` |
| Zone ID | `6e8a5f604ffc59edf71dcb2c34449690` |
| Status | `active` |
| Zone type | `full` |
| Plan | `Free Website` |
| Legacy plan ID | `free` |
| Nameservers | `lia.ns.cloudflare.com`, `sri.ns.cloudflare.com` |
| Original registrar | Spaceship, Inc. |
| Page rule quota | `3` |

Cloudflare Free plan limitations seen during setup:

| Setting | Current entitlement |
|---|---|
| `http_ratelimit` rules allowed | `1` rule |
| Rate-limit period | `10` seconds only |
| Mitigation timeout | `10` seconds only |
| `managed_challenge` for rate limiting | Not entitled |
| Working action | `block` |

## 3. Cloudflare Rate-Limit Rule

### Rule: Protect Admin Login

| Field | Current value |
|---|---|
| Ruleset name | `1HandIndia rate limits` |
| Ruleset kind | `zone` |
| Ruleset phase | `http_ratelimit` |
| Ruleset source | `rate_limit` |
| Ruleset ID | `3d7286162d5640c5989ab2b7aa3a0f63` |
| Rule ID | `a0b0f7ffe9e44c6a8362608f6cf1c803` |
| Description | `Protect admin login` |
| Enabled | `true` |
| Action | `block` |
| Host | `1handindia.com` |
| Path | `/api/admin/auth/login` |
| Expression | `(http.host eq "1handindia.com" and http.request.uri.path eq "/api/admin/auth/login")` |
| Characteristics | `ip.src`, `cf.colo.id` |
| Period | `10` seconds |
| Requests per period | `2` |
| Mitigation timeout | `10` seconds |
| Last updated | `2026-06-29T08:58:34.635831Z` |

Operational meaning:

- Cloudflare blocks requests to the standalone admin login API after more than 2 requests in 10 seconds from the same IP/Cloudflare colo bucket.
- The rule protects only `/api/admin/auth/login`.
- It does not protect `/admin`, checkout, cart, search, support, tracking, or other APIs at the Cloudflare layer because the current plan allows only one rate-limit rule.

Current Cloudflare verification command:

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

Expected important fields:

```json
{
  "success": true,
  "result": {
    "name": "1HandIndia rate limits",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "Protect admin login",
        "enabled": true,
        "action": "block",
        "expression": "(http.host eq \"1handindia.com\" and http.request.uri.path eq \"/api/admin/auth/login\")",
        "ratelimit": {
          "characteristics": ["ip.src", "cf.colo.id"],
          "period": 10,
          "requests_per_period": 2,
          "mitigation_timeout": 10
        }
      }
    ]
  }
}
```

## 4. Cloudflare Security Center Findings

The following findings were supplied from Cloudflare Security Center. They are tracked here so production security work does not get separated from the active Cloudflare/VPS rule inventory.

### Findings Register

| Severity | Issue class | Subject | Issue type | Scan performed on | Status | Risk | Current remediation state |
|---|---|---|---|---|---|---|---|
| Low | Security.txt not configured | `1handindia.com` | Configuration suggestion | `2026-06-24T01:41:17.195611Z` | Active | No clear vulnerability disclosure path for researchers. | Remediated in source by adding `apps/web/public/.well-known/security.txt`; pending production deploy and Cloudflare rescan. |
| Moderate | Dangling A Record detected | `1handindia.com` | Insecure configuration | `2026-06-24T23:39:49.307835Z` | Active | Possible domain/subdomain takeover if DNS points to an inactive resource. | Requires live DNS and VPS origin verification before closing. |
| Moderate | Unproxied CNAME Record detected | `accounts.1handindia.com` | Exposed infrastructure | `2026-06-24T23:39:50.027181Z` | Active | Origin/provider exposure and possible Cloudflare bypass. | Verify provider compatibility before proxying. If this is a Clerk/SaaS custom domain that requires DNS-only, document as accepted exception. |
| Moderate | Unproxied CNAME Record detected | `clerk.1handindia.com` | Exposed infrastructure | `2026-06-24T23:39:49.285776Z` | Active | Origin/provider exposure and possible Cloudflare bypass. | Verify Clerk custom-domain requirements before proxying. Do not toggle blindly if Clerk requires DNS-only. |
| Low | Review unwanted AI crawlers with AI Labyrinth | `1handindia.com` | Configuration suggestion | `2026-06-23T12:11:56.946272Z` | Active | Unwanted crawler traffic may increase scraping or load. | Optional Cloudflare dashboard setting. Enable only after checking SEO and operational preference. |
| Moderate | Bot Fight Mode not enabled | `1handindia.com` | Configuration suggestion | `2026-06-24T08:55:53.951623Z` | Active | More automated bot traffic may reach the application. | Recommended to enable in Cloudflare dashboard, then monitor Security Events. |

### Security.txt Remediation

Source file added:

```text
apps/web/public/.well-known/security.txt
```

Current contents:

```text
Contact: https://1handindia.com/contact
Expires: 2027-06-01T00:00:00Z
Preferred-Languages: en, hi
Canonical: https://1handindia.com/.well-known/security.txt
```

Deploy verification:

```bash
curl -i https://1handindia.com/.well-known/security.txt
```

Expected result:

- HTTP `200`.
- Body contains `Contact`, `Expires`, `Preferred-Languages`, and `Canonical`.
- Cloudflare Security Center should clear the finding after the next scan or manual refresh.

Optional improvement after a dedicated security inbox exists:

```text
Contact: mailto:security@1handindia.com
```

### Dangling A Record Remediation

Cloudflare reported a dangling A record for `1handindia.com`, but the pasted finding did not include the actual DNS record content, ASN name, or TTL values. Do not delete records until the active production origin is verified.

Run on the VPS or local admin machine:

```bash
dig +short 1handindia.com A
dig +short www.1handindia.com A
curl -I https://1handindia.com
curl -I https://www.1handindia.com
```

Run in Cloudflare DNS:

1. Open **Cloudflare > 1handindia.com > DNS > Records**.
2. Find A records for `1handindia.com` and `www`.
3. Confirm each A record points to the current VPS public IP.
4. Remove stale A records that point to old VPS, inactive hosting, or abandoned infrastructure.
5. Keep active web records **Proxied** unless a provider explicitly requires DNS-only.

Close criteria:

- `1handindia.com` resolves only to the current controlled origin or Cloudflare-proxied target.
- `curl -I https://1handindia.com` returns the production app response.
- Cloudflare Security Center no longer reports the dangling A record.

### Unproxied CNAME Remediation

Cloudflare reported these DNS-only CNAMEs:

```text
accounts.1handindia.com
clerk.1handindia.com
```

Action rule:

- If the CNAME points to 1HandIndia-controlled infrastructure that works behind Cloudflare, switch it to **Proxied**.
- If the CNAME points to Clerk or another SaaS that requires DNS-only records for custom domain validation, keep DNS-only and document it as an accepted provider exception.
- If the hostname is unused, remove the DNS record.

Verification commands:

```bash
dig +short accounts.1handindia.com CNAME
dig +short clerk.1handindia.com CNAME
curl -I https://accounts.1handindia.com
curl -I https://clerk.1handindia.com
```

Before proxying Clerk-related records:

1. Confirm the exact Clerk dashboard custom-domain instructions for the current production instance.
2. Confirm whether the CNAME is for frontend API, account portal, verification, or another Clerk-managed endpoint.
3. Change only one record at a time.
4. Verify customer/seller/B2B sign-in and sign-up after the DNS change.

Close criteria:

- App-owned records are proxied through Cloudflare.
- Provider-required DNS-only records are documented as accepted exceptions.
- Unused records are removed.
- Auth flows still work after any DNS change.

### AI Labyrinth Remediation

Recommended dashboard path:

```text
Cloudflare > 1handindia.com > Security/Bots > AI Labyrinth
```

Action:

- Enable AI Labyrinth if the client wants extra protection against unwanted AI crawlers.
- Monitor Cloudflare analytics and app logs after enabling.
- If SEO or legitimate crawler behavior is affected, review the setting.

Close criteria:

- AI Labyrinth is either enabled, or the decision to leave it off is recorded with a reason.

### Bot Fight Mode Remediation

Recommended dashboard path:

```text
Cloudflare > 1handindia.com > Security > Bots > Bot Fight Mode
```

Action:

- Toggle Bot Fight Mode on.
- Monitor **Security > Events** for actions labeled `Bot Fight Mode`.
- Watch customer login, checkout, Razorpay callback, Clerk auth, and admin login after enabling.

Close criteria:

- Bot Fight Mode is enabled.
- No critical customer, seller, B2B, admin, finance, delivery, payment, or auth flow is blocked unexpectedly.
- Any false positives are documented and handled through Cloudflare allow rules or feature-specific exceptions.

## 5. VPS Nginx Rate-Limit Rules

Source file: `deploy/nginx/indihub-rate-limits.conf`

These rules are designed for the Ubuntu VPS reverse proxy. The API must stay bound to `127.0.0.1:4000`, and public traffic must enter through Nginx on ports `80` and `443`.

### Shared Zones

| Nginx zone | Key | Rate |
|---|---|---:|
| `indihub_search` | `$binary_remote_addr` | `30r/m` |
| `indihub_search_suggestions` | `$binary_remote_addr` | `20r/m` |
| `indihub_product_detail` | `$binary_remote_addr` | `240r/m` |
| `indihub_checkout` | `$binary_remote_addr` | `60r/m` |
| `indihub_auth` | `$binary_remote_addr` | `20r/m` |
| `indihub_admin` | `$binary_remote_addr` | `120r/m` |
| `indihub_public` | `$binary_remote_addr` | `300r/m` |

### Location Rules

| Route match | Nginx rule | Burst | Delay mode | Upstream |
|---|---|---:|---|---|
| `= /api/search/suggestions` | `limit_req zone=indihub_search_suggestions` | `10` | `nodelay` | `http://127.0.0.1:4000` |
| `= /api/search` | `limit_req zone=indihub_search` | `20` | `nodelay` | `http://127.0.0.1:4000` |
| `= /api/products` | `limit_req zone=indihub_search` | `20` | `nodelay` | `http://127.0.0.1:4000` |
| `^~ /api/products/` | `limit_req zone=indihub_product_detail` | `60` | `nodelay` | `http://127.0.0.1:4000` |
| `~ ^/api/(auth|admin/auth)` | `limit_req zone=indihub_auth` | `10` | `nodelay` | `http://127.0.0.1:4000` |
| `~ ^/api/(checkout|cart|account/orders)` | `limit_req zone=indihub_checkout` | `20` | `nodelay` | `http://127.0.0.1:4000` |
| `^~ /api/admin/` | `limit_req zone=indihub_admin` | `40` | `nodelay` | `http://127.0.0.1:4000` |
| `^~ /api/` | `limit_req zone=indihub_public` | `80` | `nodelay` | `http://127.0.0.1:4000` |

### Search Micro-Cache

| Setting | Value |
|---|---|
| Cache path | `/var/cache/nginx/indihub_search` |
| Cache zone | `indihub_search_cache:20m` |
| Max size | `256m` |
| Inactive TTL | `2m` |
| Cache methods | `GET`, `HEAD` |
| `/api/search/suggestions` valid cache | `200` for `10s` |
| `/api/search` valid cache | `200` for `20s` |
| Authenticated request behavior | Bypass and no-cache when `Authorization` header is present |
| Response header | `X-Search-Cache` |

## 6. VPS Firewall and Port Exposure Rules

Source file: `docs/IndiHub_VPS_PRODUCTION_SETUP_RUNBOOK.md`

### Publicly Allowed

| Service | Port | Purpose |
|---|---:|---|
| SSH | `22/tcp` or configured SSH port | Server administration |
| HTTP | `80/tcp` | Redirect/Certbot/Nginx public entry |
| HTTPS | `443/tcp` | Public application traffic |

### Must Not Be Public

| Port | Service | Required exposure |
|---:|---|---|
| `3000` | Next.js web app | `127.0.0.1` or private only |
| `4000` | NestJS API | `127.0.0.1` or private only |
| `5432` | PostgreSQL | Local/private only |
| `6379` | Redis | Not used in current VPS mode; keep closed |
| `6432` | PgBouncer, if used | Local/private only |

Recommended UFW commands from the production runbook:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 7. API Application Rate-Limit Rules

Source file: `apps/api/src/rate-limit/request-rate-limiter.ts`

The NestJS API registers the middleware from `apps/api/src/main.ts`:

```ts
app.use(createRateLimitMiddleware(rateLimitOptionsFromEnv()));
```

The limiter is enabled unless `INDIHUB_API_RATE_LIMIT_ENABLED=false`.

### Default API Policies

| Policy | Route match | Limit | Window | Message |
|---|---|---:|---:|---|
| `auth` | `/api/admin/auth*`, `/api/auth*` | `20` | `60s` | Too many sign-in attempts. |
| `admin` | `/api/admin*`, `/api/finance*` | `120` | `60s` | Too many back-office requests. |
| `checkout` | `/api/checkout*`, `/api/cart*`, `/api/account/orders*` | `60` | `60s` | Too many cart or checkout requests. |
| `product-detail` | `GET /api/products/*` | `240` | `60s` | Too many product requests. |
| `search-anonymous` | `GET /api/search`, `GET /api/products?search=...` without auth | `30` | `60s` | Too many searches. |
| `search-authenticated` | `GET /api/search`, `GET /api/products?search=...` with auth | `100` | `60s` | Too many searches. |
| `search-suggestions-anonymous` | `GET /api/search/suggestions` without auth | `20` | `60s` | Too many search suggestions. |
| `search-suggestions-authenticated` | `GET /api/search/suggestions` with auth | `60` | `60s` | Too many search suggestions. |
| `public` | All other API routes | `300` | `60s` | Too many requests. |

### API Identity Rules

| Request identity | Limiter key |
|---|---|
| `x-indihub-user-id` | Stable platform user key |
| `x-clerk-user-id` | Clerk user key |
| `x-indihub-dev-clerk-id` | Local/dev Clerk fallback key |
| `Authorization` header | Hashed bearer-token key |
| Anonymous request | Hashed client IP key |

If `INDIHUB_TRUST_PROXY_HEADERS=true`, the API reads the client IP from:

1. `X-Forwarded-For`
2. `X-Real-IP`
3. request socket/IP fallback

Security requirement: only enable trusted proxy headers when the API port is not publicly reachable.

### API Response Headers

The API rate limiter sends:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Active policy limit |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when the bucket resets |
| `Retry-After` | Seconds to wait after a blocked request |

Blocked response shape:

```json
{
  "statusCode": 429,
  "message": "Too many requests. Please wait a minute and try again.",
  "error": "Too Many Requests"
}
```

### API Environment Overrides

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

## 8. Live VPS Verification Checklist

Run these commands on the VPS. Do not print `.env` secret values.

### Nginx Rule Verification

```bash
sudo nginx -t
sudo nginx -T | grep -E "limit_req_zone|limit_req zone|indihub_search|indihub_auth|indihub_checkout|indihub_admin|proxy_cache_path"
```

Expected result:

- `nginx -t` reports syntax OK and test successful.
- `nginx -T` includes the `indihub_*` zones and route-level `limit_req` lines.

### Firewall Verification

```bash
sudo ufw status verbose
ss -tulpn | grep -E ":80|:443|:3000|:4000|:5432|:6432|:6379"
```

Expected result:

- UFW allows SSH, `80/tcp`, and `443/tcp`.
- Ports `3000`, `4000`, `5432`, and `6432` are not listening on `0.0.0.0` or a public interface.
- Redis port `6379` is closed because Redis is not part of the current VPS launch mode.

### API Rate-Limit Verification

```bash
curl -I https://1handindia.com/api/health
curl -I "https://1handindia.com/api/search?q=test"
```

Expected result:

- API responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
- Repeated requests beyond a route budget return HTTP `429`.

### Cloudflare Verification

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

Expected result:

- `success` is `true`.
- The enabled rule has action `block`.
- The expression targets `/api/admin/auth/login`.

### Cloudflare Security Center Verification

```bash
curl -I https://1handindia.com/.well-known/security.txt
dig +short 1handindia.com A
dig +short accounts.1handindia.com CNAME
dig +short clerk.1handindia.com CNAME
```

Expected result:

- Security.txt returns HTTP `200` after deployment.
- Root A records point only to the current controlled VPS/origin or valid Cloudflare-proxied target.
- CNAME records are either proxied, removed, or documented as provider-required DNS-only exceptions.

## 9. Known Gaps and Next Actions

| Gap | Current reason | Recommended action |
|---|---|---|
| Cloudflare protects only admin login | Free plan allows only one rate-limit rule | Keep the rule on admin login. Use Nginx and API limits for other surfaces. |
| Cloudflare cannot use `managed_challenge` for this rule | Current plan entitlement does not allow it | Use `block` on Free plan. Consider upgrade later if challenge-based mitigation is required. |
| Cloudflare checkout/cart rule not active | Free plan one-rule limit | Keep Nginx/API checkout limits active. Add Cloudflare rule after plan upgrade. |
| Security.txt not live until deploy | File was added to source only | Deploy the web app, then verify `https://1handindia.com/.well-known/security.txt`. |
| Dangling A record still active in Cloudflare Security Center | DNS target details were not included in pasted finding | Verify root A record targets and remove stale IPs. |
| CNAME proxy findings need provider checks | Clerk/custom SaaS records may require DNS-only mode | Verify target provider before orange-cloud proxying `accounts` or `clerk`. |
| Bot Fight Mode not enabled | Cloudflare dashboard setting still active as a finding | Enable in dashboard and monitor Security Events. |
| AI Labyrinth not enabled | Cloudflare dashboard setting still active as a finding | Enable or document accepted decision to leave off. |
| Live VPS Nginx reload not proven in this file | Workspace inspection cannot verify server runtime state | Run section 8 commands on the VPS and record the date/operator. |
| Live UFW state not proven in this file | Workspace inspection cannot verify server firewall state | Run section 8 commands on the VPS and record the result. |

## 10. Change Log

| Date | Change |
|---|---|
| 2026-06-29 | Added Cloudflare Security Center findings, remediation steps, verification commands, and Security.txt source-file status. |
| 2026-06-29 | Added Cloudflare Free-plan active admin-login rate-limit rule and current VPS/API rate-limit inventory. |
