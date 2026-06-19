# 1HandIndia VPS Production Setup Runbook

**Project:** 1HandIndia multi-vendor ecommerce marketplace  
**Document type:** VPS deployment and complete feature setup guide  
**Audience:** Developer, DevOps operator, admin operator, finance operator, seller-support operator  
**Last updated:** 2026-06-09  
**Primary stack:** Turborepo, pnpm, Next.js, NestJS, worker app, PostgreSQL, Prisma, Nginx

## 1. Purpose

This document explains what to do after 1HandIndia is hosted on a VPS.

Use it as the production launch runbook. It covers server setup, deployment, environment variables, database migration, Nginx, SSL, workers, admin setup, payments, email, storage, search, sellers, customers, B2B, delivery, finance, reviews, monitoring, backups, and troubleshooting.

The goal is not only to make the website open. The goal is to make every selected marketplace feature operational, controlled from the right portal, protected by the right permissions, and verified before launch.

## 2. Hard Rules

Follow these rules for production and staging:

- Do not expose the API port `4000` to the public internet.
- Do not expose the web port `3000` to the public internet.
- Public traffic must enter through Nginx on `80` and `443`.
- Use Prisma migrations in production. Do not use `pnpm db:push` on production or staging.
- Use `pnpm db:seed:system` only for approved RBAC/reference setup.
- Do not use `pnpm db:seed:bootstrap` on production unless an approved one-time production bootstrap is required.
- Keep provider secrets out of Git, screenshots, chat messages, and shared documents.
- Do not configure Redis for the current VPS launch. Keep `REDIS_URL` empty.
- Search, rate limiting, indexing, and current notification operations must run without Redis.
- PostgreSQL is the source of truth for business data and search documents.
- Clerk handles customer/seller/B2B identity. 1HandIndia database roles handle business authorization.
- Standalone admin login is separate from Clerk and must stay protected.
- Every provider setup must be verified from the UI and from logs.

## 3. Production Topology

Recommended first VPS topology:

```text
Internet
  |
  v
Nginx + SSL + rate limits + optional search micro-cache
  |
  +--> Next.js web app on 127.0.0.1:3000
  |
  +--> NestJS API on 127.0.0.1:4000

Background:
  - Worker app for PostgreSQL search-index jobs and non-Redis background maintenance
  - PostgreSQL database
  - Optional PgBouncer for runtime API/worker DB pooling
```

Recommended process list:

| Process           | Purpose                                                                       | Private port |
| ----------------- | ----------------------------------------------------------------------------- | -----------: |
| `@indihub/web`    | Customer storefront, account, seller center, B2B, admin, finance, delivery UI |       `3000` |
| `@indihub/api`    | REST API, Swagger, auth guards, admin/seller/customer/B2B logic               |       `4000` |
| `@indihub/worker` | PostgreSQL search-index polling and non-Redis background maintenance          |         None |
| PostgreSQL        | Primary database                                                              |       `5432` |
| PgBouncer         | Optional runtime connection pool                                              |       `6432` |

## 4. Pre-Hosting Checklist

Collect these before starting:

| Item                  | Required value                                             |
| --------------------- | ---------------------------------------------------------- |
| Main domain           | Example: `1handindia.com`                                  |
| Admin URL             | Usually `https://1handindia.com/admin`                     |
| API public base       | Usually `https://1handindia.com/api`                       |
| VPS OS                | Ubuntu 22.04 LTS or 24.04 LTS recommended                  |
| VPS size              | Minimum 4 vCPU, 8 GB RAM for serious launch testing        |
| Database              | PostgreSQL 15+ recommended                                 |
| Node                  | Node.js 22+                                                |
| Package manager       | pnpm 10+                                                   |
| SSL                   | Certbot or managed certificate                             |
| Email provider        | Brevo, Resend, SendGrid, or SMTP                           |
| Payment provider      | Razorpay test and live account                             |
| Public image provider | ImageKit or S3-compatible public bucket                    |
| Private storage       | S3-compatible bucket if document/proof uploads are enabled |
| Clerk                 | Production Clerk application and domain configuration      |
| Backups               | Database backup path, retention, restore test owner        |
| Monitoring            | Uptime monitor, log access, alert recipient                |

## 5. Server Preparation

Run these on the VPS as a sudo user.

### 5.1 Update the server

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential nginx postgresql postgresql-contrib ufw
```

### 5.2 Create an application user

```bash
sudo adduser indihub
sudo usermod -aG sudo indihub
```

Use this user for application files and runtime services:

```bash
su - indihub
```

### 5.3 Install Node.js 22 and pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm@10.20.0
node -v
pnpm -v
```

Expected:

- Node version is `22.x` or newer.
- pnpm version is `10.x` or newer.

### 5.4 Configure firewall

Only public SSH, HTTP, and HTTPS should be open.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do not open `3000`, `4000`, `5432`, `6379`, or `6432` publicly.

## 6. Project Deployment

### 6.1 Place the source code

Use one stable production directory:

```bash
sudo mkdir -p /var/www/indihub
sudo chown -R indihub:indihub /var/www/indihub
```

Copy or clone the project into:

```text
/var/www/indihub
```

Then enter the project:

```bash
cd /var/www/indihub
```

### 6.2 Install dependencies

```bash
pnpm install --frozen-lockfile
```

If the lockfile is not present or is intentionally updated, resolve that before production deployment. Do not use random dependency versions in production.

### 6.3 Create production environment file

```bash
cp .env.example .env.production
chmod 600 .env.production
```

Edit the file:

```bash
nano .env.production
```

Do not paste real secret values into documentation, issue trackers, chat, or screenshots.

## 7. Environment Configuration

Production environment values must be explicit.

### 7.1 Required core values

Use production URLs:

```env
NODE_ENV="production"
INDIHUB_ENV="production"

NEXT_PUBLIC_APP_NAME="1HandIndia"
NEXT_PUBLIC_WEB_URL="https://YOUR_DOMAIN"
NEXT_PUBLIC_API_URL="https://YOUR_DOMAIN"

API_PORT="4000"
API_CORS_ORIGINS="https://YOUR_DOMAIN,https://www.YOUR_DOMAIN"
```

Important:

- `NEXT_PUBLIC_*` values are embedded at web build time.
- Rebuild the web app after changing `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_API_URL`, Clerk publishable key, or public map values.

### 7.2 Database values

Without PgBouncer:

```env
DATABASE_URL="postgresql://indihub_app:STRONG_PASSWORD@127.0.0.1:5432/indihub?schema=public"
DATABASE_DIRECT_URL=""
```

With PgBouncer:

```env
DATABASE_URL="postgresql://indihub_app:STRONG_PASSWORD@127.0.0.1:6432/indihub?schema=public"
DATABASE_DIRECT_URL="postgresql://indihub_app:STRONG_PASSWORD@127.0.0.1:5432/indihub?schema=public"
```

Recommended runtime pool values for first launch:

```env
PG_APP_NAME="indihub-api"
PG_POOL_MAX="10"
PG_POOL_CONNECTION_TIMEOUT_MS="10000"
PG_POOL_IDLE_TIMEOUT_MS="60000"
PG_POOL_MAX_LIFETIME_SECONDS="900"
```

### 7.3 Admin bootstrap values

```env
INDIHUB_FIRST_ADMIN_EMAIL="admin@YOUR_DOMAIN"
INDIHUB_FIRST_ADMIN_NAME="1HandIndia Admin"
INDIHUB_FIRST_ADMIN_PASSWORD="A_LONG_RANDOM_PASSWORD"
ADMIN_SESSION_TTL_HOURS="8"
INDIHUB_BOOTSTRAP_SECRET="A_LONG_RANDOM_SECRET"
INDIHUB_AUTH_SYNC_SECRET="A_LONG_RANDOM_SECRET"
```

After the first admin login works, rotate weak temporary values immediately.

### 7.4 Clerk production values

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----..."
CLERK_JWT_AUDIENCE=""
CLERK_AUTHORIZED_PARTIES="https://YOUR_DOMAIN,https://www.YOUR_DOMAIN"
CLERK_WEBHOOK_SECRET="whsec_..."
```

In Clerk Dashboard:

1. Create or select the production application.
2. Add the production domain.
3. Configure allowed redirect URLs for:
   - `https://YOUR_DOMAIN`
   - `https://YOUR_DOMAIN/sign-in`
   - `https://YOUR_DOMAIN/sign-up`
   - `https://YOUR_DOMAIN/seller`
   - `https://YOUR_DOMAIN/b2b`
4. Configure the Clerk webhook to the API endpoint if auth sync webhooks are enabled in this deployment.
5. Use the same Clerk application for frontend and backend keys.
6. If the customer mobile app is shipped, enable Google under Clerk SSO connections and add the mobile redirect/deep link:
   - `onehandindia://sso-callback`
7. For production Google login, enable custom Google OAuth credentials in Clerk, create a Google Cloud OAuth web client, paste Clerk's Google authorized redirect URI into Google Cloud, then paste the Google client ID and client secret back into Clerk.
8. Confirm the mobile app has `scheme: "onehandindia"` in `apps/mobile-customer/app.json` and uses the same Clerk publishable key through `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
9. Test mobile Google sign-in in an Expo dev-client or standalone Android build, not Expo Go, and confirm `/auth/sync-current-user` completes after OAuth.

### 7.5 No Redis value

```env
REDIS_URL=""
```

Current production mode does not use Redis anywhere. Keep `REDIS_URL` empty so API and worker do not open Redis/BullMQ connections.

Do not add Redis for:

- Search indexing.
- Search result caching.
- Search suggestions.
- Search rate limiting.
- Current email delivery operations.
- Current VPS background jobs.

### 7.6 Mobile app deep-link values

Set these on the web deployment before building/deploying the website if the customer mobile app should open indexed store URLs from Google Search, Chrome, Safari, WhatsApp, or any mobile browser.

```env
INDIHUB_ANDROID_APP_PACKAGE="com.onehandindia.customer"
INDIHUB_ANDROID_APP_LINK_SHA256="AA:BB:CC:DD:..."
INDIHUB_IOS_APP_ID="APPLE_TEAM_ID.com.onehandindia.customer"
```

Important:

- `INDIHUB_ANDROID_APP_LINK_SHA256` must be the SHA-256 certificate fingerprint for the Android app installed on the user's phone.
- For Google Play builds, use the Play App Signing certificate SHA-256 from Google Play Console -> Setup -> App integrity.
- For direct APK/AAB sideload builds, use the release signing keystore SHA-256 used to sign that installed build.
- `INDIHUB_IOS_APP_ID` must be the Apple Team ID plus bundle identifier, for example `ABCDE12345.com.onehandindia.customer`.
- Rebuild and redeploy the web app after changing these values because `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` are served by the web app.
- Rebuild and reinstall the mobile app after changing native App Link or Universal Link configuration because Android intent filters and iOS associated domains are compiled into the app binary.
- Rebuild and reinstall the mobile app after changing the app scheme, Clerk mobile redirect/deep-link setup, or native auth build profile. JS reload alone is not enough for native deep-link registration.

### 7.7 Search worker values

```env
SEARCH_INDEX_WORKER_ENABLED="true"
SEARCH_INDEX_POLL_INTERVAL_MS="5000"
SEARCH_INDEX_BATCH_SIZE="25"
```

Set `SEARCH_INDEX_WORKER_ENABLED=false` only when intentionally pausing indexing.

### 7.8 Email fallback values

Normal operation should use `/admin/email` settings. Environment values can act as bootstrap fallback:

```env
EMAIL_PROVIDER="smtp"
EMAIL_FROM_NAME="1HandIndia"
EMAIL_FROM_ADDRESS="no-reply@YOUR_DOMAIN"
EMAIL_ADMIN_RECIPIENTS="admin@YOUR_DOMAIN"

BREVO_API_KEY=""
RESEND_API_KEY=""
SENDGRID_API_KEY=""
SMTP_BRIDGE_URL=""
```

### 7.9 Razorpay fallback values

Normal operation should use `/admin/payments`. Environment values are fallback only:

```env
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
```

### 7.10 Storage values

Public image provider fallback:

```env
PUBLIC_IMAGE_PROVIDER="IMAGEKIT"
PUBLIC_IMAGE_BASE_URL="https://ik.imagekit.io/YOUR_ID"
IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/YOUR_ID"
IMAGEKIT_PUBLIC_KEY=""
IMAGEKIT_PRIVATE_KEY=""
```

Private S3-compatible storage fallback:

```env
INDIHUB_PRIVATE_STORAGE_PROVIDER="AUTO"
INDIHUB_PRIVATE_UPLOAD_ROOT="storage/private"
S3_ENDPOINT=""
S3_REGION=""
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
```

Use `AUTO` for normal VPS operation: the API uses S3 when all private S3 settings are complete, otherwise it falls back to local private storage below `INDIHUB_PRIVATE_UPLOAD_ROOT`. Use `S3` only when private S3 is mandatory and credentials are complete. Use `LOCAL` only when the VPS filesystem is the intended private-file store and its backup is configured.

Private upload cleanup worker:

```env
PRIVATE_UPLOAD_CLEANUP_WORKER_ENABLED="true"
PRIVATE_UPLOAD_ORPHAN_RETENTION_HOURS="24"
PRIVATE_UPLOAD_CLEANUP_INTERVAL_MS="3600000"
PRIVATE_UPLOAD_CLEANUP_BATCH_SIZE="50"
```

The worker removes private upload keys/files older than the retention window only when they are still not linked to a seller document or B2B order purchase-order record.

### 7.11 Maps and location values

```env
NEXT_PUBLIC_MAP_PROVIDER="OSM_LEAFLET"
NEXT_PUBLIC_MAP_TILE_URL=""
NEXT_PUBLIC_MAP_ATTRIBUTION=""
NEXT_PUBLIC_MAPBOX_TOKEN=""

MAPBOX_TOKEN=""
MAPBOX_ACCESS_TOKEN=""
DATAGOVINDIA_API_KEY=""
```

For real production traffic, use a provider plan for tiles and geocoding. Do not depend on free public tile usage for heavy traffic.

### 7.11 Rate limiting values

```env
INDIHUB_API_RATE_LIMIT_ENABLED="true"
INDIHUB_TRUST_PROXY_HEADERS="true"

INDIHUB_RATE_LIMIT_SEARCH_ANON_PER_MINUTE="30"
INDIHUB_RATE_LIMIT_SEARCH_AUTH_PER_MINUTE="100"
INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_ANON_PER_MINUTE="20"
INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_AUTH_PER_MINUTE="60"
INDIHUB_RATE_LIMIT_PRODUCT_DETAIL_PER_MINUTE="240"
INDIHUB_RATE_LIMIT_CHECKOUT_PER_MINUTE="60"
INDIHUB_RATE_LIMIT_AUTH_PER_MINUTE="20"
INDIHUB_RATE_LIMIT_ADMIN_PER_MINUTE="120"
INDIHUB_RATE_LIMIT_PUBLIC_PER_MINUTE="300"
```

Because `INDIHUB_TRUST_PROXY_HEADERS=true` trusts proxy headers, the API must remain private behind Nginx.

## 8. PostgreSQL Setup

### 8.1 Create database and user

Run as a sudo user:

```bash
sudo -u postgres psql
```

Inside PostgreSQL:

```sql
CREATE ROLE indihub_app WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE indihub OWNER indihub_app;
\c indihub
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT ALL PRIVILEGES ON DATABASE indihub TO indihub_app;
\q
```

Use a strong unique password. Keep it only in the VPS secret store and `.env.production`.

### 8.2 Validate Prisma schema

Load the environment in your shell:

```bash
set -a
source /var/www/indihub/.env.production
set +a
```

Then run:

```bash
pnpm db:generate
pnpm db:validate
```

### 8.3 Apply production migrations

Use migration deploy only:

```bash
npx prisma migrate status --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
```

Do not run:

```bash
pnpm db:push
```

on production or staging.

### 8.4 Seed system reference rows if required

For RBAC/system reference rows only:

```bash
pnpm db:seed:system
```

Do not run bootstrap seed on production unless explicitly approved for a one-time production bootstrap:

```bash
INDIHUB_ALLOW_PRODUCTION_SEED=true pnpm db:seed:bootstrap
```

Use that only when you fully understand which rows it creates.

## 9. Optional PgBouncer Setup

Use PgBouncer when traffic or worker count grows.

Install:

```bash
sudo apt install -y pgbouncer
```

Recommended rule:

- `DATABASE_URL` points to PgBouncer on `127.0.0.1:6432`.
- `DATABASE_DIRECT_URL` points directly to PostgreSQL on `127.0.0.1:5432`.
- Migrations use the direct connection.
- Runtime API and worker use PgBouncer.

After enabling PgBouncer, restart API and worker, then check:

```bash
curl -I https://YOUR_DOMAIN/api/health
```

## 10. No Redis Deployment Check

The current VPS launch does not use Redis.

Confirm `.env.production` contains:

```env
REDIS_URL=""
```

Do not install or start Redis for this deployment. If Redis already exists on the VPS from another project, 1HandIndia must still leave `REDIS_URL` empty.

Expected behavior with `REDIS_URL=""`:

- API starts without opening a Redis connection.
- Worker starts without opening a Redis connection.
- PostgreSQL search indexing still works through `SearchIndexJob`.
- Current transactional emails remain DB-audited through notification logs.
- Nginx/CDN and app-level local guards handle rate limiting.

Search is PostgreSQL plus Nginx/CDN protection.

## 11. Build the Apps

Load environment:

```bash
cd /var/www/indihub
set -a
source .env.production
set +a
```

Run:

```bash
pnpm db:generate
pnpm build
```

Recommended verification gates before starting services:

```bash
pnpm db:validate
pnpm --filter @indihub/api typecheck
pnpm --filter @indihub/api lint
pnpm --filter @indihub/api build
pnpm --filter @indihub/worker typecheck
pnpm --filter @indihub/worker lint
pnpm --filter @indihub/worker build
pnpm --filter @indihub/web typecheck
pnpm --filter @indihub/web lint
pnpm --filter @indihub/web build
```

Run test suites only against an approved disposable test database. Do not run DB-writing integration tests against production.

Mobile deep-link build reminder:

- Confirm `INDIHUB_ANDROID_APP_LINK_SHA256` is set before the web build if Android App Links should open installed app store pages from indexed URLs.
- Confirm `INDIHUB_IOS_APP_ID` is set before the web build if iOS Universal Links should open installed app store pages from indexed URLs.
- After deployment, check:
  - `https://YOUR_DOMAIN/.well-known/assetlinks.json`
  - `https://YOUR_DOMAIN/.well-known/apple-app-site-association`
- Rebuild the mobile app when native App Link or Universal Link domains change.
- Rebuild and reinstall the mobile app when splash, launcher icon, adaptive icon, package name, associated domains, or intent filters change. Expo OTA updates and JS reloads cannot update Android system splash resources.
- If Android still shows an old splash/icon after installing a new build, uninstall `com.onehandindia.customer` first, then install the new APK/AAB. Some launchers cache old app icons.

## 12. Process Management With systemd

systemd is recommended for a single VPS because it is predictable after reboot.

Find the pnpm path:

```bash
command -v pnpm
```

Use that exact path in service files. Examples below use `/usr/bin/pnpm`.

### 12.1 API service

Create:

```bash
sudo nano /etc/systemd/system/indihub-api.service
```

Content:

```ini
[Unit]
Description=1HandIndia API
After=network.target postgresql.service

[Service]
Type=simple
User=indihub
WorkingDirectory=/var/www/indihub
EnvironmentFile=/var/www/indihub/.env.production
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm --filter @indihub/api start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 12.2 Web service

Create:

```bash
sudo nano /etc/systemd/system/indihub-web.service
```

Content:

```ini
[Unit]
Description=1HandIndia Web
After=network.target indihub-api.service

[Service]
Type=simple
User=indihub
WorkingDirectory=/var/www/indihub
EnvironmentFile=/var/www/indihub/.env.production
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm --filter @indihub/web start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 12.3 Worker service

Create:

```bash
sudo nano /etc/systemd/system/indihub-worker.service
```

Content:

```ini
[Unit]
Description=1HandIndia Worker
After=network.target postgresql.service

[Service]
Type=simple
User=indihub
WorkingDirectory=/var/www/indihub
EnvironmentFile=/var/www/indihub/.env.production
Environment=NODE_ENV=production
Environment=WORKER_KEEP_ALIVE=true
ExecStart=/usr/bin/pnpm --filter @indihub/worker start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 12.4 Start services

```bash
sudo systemctl daemon-reload
sudo systemctl enable indihub-api indihub-web indihub-worker
sudo systemctl start indihub-api indihub-web indihub-worker
sudo systemctl status indihub-api
sudo systemctl status indihub-web
sudo systemctl status indihub-worker
```

Local health checks on the VPS:

```bash
curl http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3000
```

Logs:

```bash
journalctl -u indihub-api -f
journalctl -u indihub-web -f
journalctl -u indihub-worker -f
```

## 13. Nginx and SSL Setup

### 13.1 Add rate-limit zones

Use `deploy/nginx/indihub-rate-limits.conf` as the project source.

Place these lines in the Nginx `http` context:

- `limit_req_zone ...`
- `proxy_cache_path ...`
- `map $http_authorization ...`

Typical file:

```bash
sudo nano /etc/nginx/conf.d/indihub-rate-zones.conf
```

Copy only the global `limit_req_zone`, `proxy_cache_path`, and `map` sections there.

Create cache directory:

```bash
sudo mkdir -p /var/cache/nginx/indihub_search
sudo chown -R www-data:www-data /var/cache/nginx/indihub_search
```

### 13.2 Create site config

Create:

```bash
sudo nano /etc/nginx/sites-available/indihub
```

Example:

```nginx
server {
  listen 80;
  server_name YOUR_DOMAIN www.YOUR_DOMAIN;

  client_max_body_size 20m;

  location = /api/search/suggestions {
    limit_req zone=indihub_search_suggestions burst=10 nodelay;
    proxy_cache indihub_search_cache;
    proxy_cache_methods GET HEAD;
    proxy_cache_valid 200 10s;
    proxy_cache_lock on;
    proxy_cache_bypass $indihub_search_cache_bypass;
    proxy_no_cache $indihub_search_cache_bypass;
    add_header X-Search-Cache $upstream_cache_status always;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location = /api/search {
    limit_req zone=indihub_search burst=20 nodelay;
    proxy_cache indihub_search_cache;
    proxy_cache_methods GET HEAD;
    proxy_cache_valid 200 20s;
    proxy_cache_lock on;
    proxy_cache_bypass $indihub_search_cache_bypass;
    proxy_no_cache $indihub_search_cache_bypass;
    add_header X-Search-Cache $upstream_cache_status always;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location = /api/products {
    limit_req zone=indihub_search burst=20 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location ^~ /api/products/ {
    limit_req zone=indihub_product_detail burst=60 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location ~ ^/api/(auth|admin/auth) {
    limit_req zone=indihub_auth burst=10 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location ~ ^/api/(checkout|cart|account/orders) {
    limit_req zone=indihub_checkout burst=20 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location ^~ /api/admin/ {
    limit_req zone=indihub_admin burst=40 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location ^~ /api/ {
    limit_req zone=indihub_public burst=80 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4000;
  }

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000;
  }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/indihub /etc/nginx/sites-enabled/indihub
sudo nginx -t
sudo systemctl reload nginx
```

### 13.3 Add SSL

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificate:

```bash
sudo certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

Verify renewal:

```bash
sudo certbot renew --dry-run
```

Public health check:

```bash
curl https://YOUR_DOMAIN/api/health
curl -I https://YOUR_DOMAIN
```

## 14. First Production Verification

Run these after services and Nginx are live:

```bash
curl https://YOUR_DOMAIN/api/health
curl https://YOUR_DOMAIN/api/products
curl "https://YOUR_DOMAIN/api/search?q=test&limit=5"
```

Open in browser:

- `https://YOUR_DOMAIN`
- `https://YOUR_DOMAIN/search?q=test`
- `https://YOUR_DOMAIN/admin`
- `https://YOUR_DOMAIN/seller`
- `https://YOUR_DOMAIN/b2b`
- `https://YOUR_DOMAIN/delivery`
- `https://YOUR_DOMAIN/finance`

Expected:

- Public pages load over HTTPS.
- API returns JSON.
- Admin login appears instead of a broken dashboard.
- Seller/B2B/customer areas use Clerk or local production auth as configured.
- Delivery and finance portals are protected.

## 15. PostgreSQL Search Setup

The search system uses PostgreSQL `SearchDocument` and `SearchIndexJob`.

### 15.1 Migration requirements

Confirm the search migration is applied:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

If pending migrations exist:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

### 15.2 Generate full search index

Run:

```bash
pnpm search:reindex
```

Expected:

- Products, stores, and categories get queued.
- Jobs complete.
- `documentCount` is greater than `0` when visible records exist.

### 15.3 Keep indexing live

The worker must be running:

```bash
sudo systemctl status indihub-worker
```

Worker env:

```env
SEARCH_INDEX_WORKER_ENABLED="true"
SEARCH_INDEX_POLL_INTERVAL_MS="5000"
SEARCH_INDEX_BATCH_SIZE="25"
```

### 15.4 Admin search verification

Open:

```text
/admin/search
```

Verify:

- Job status counts.
- Full reindex action.
- Manual job processing.
- Explain plan check.

API endpoints:

```text
GET  /api/search
GET  /api/search/suggestions
GET  /api/admin/search
POST /api/admin/search/reindex
POST /api/admin/search/jobs/process
GET  /api/admin/search/explain
```

### 15.5 Public search verification

Search with real product terms:

```text
/search?q=Nilkamal
/search?q=bag
/search?q=electronics
```

If a visible product exists but search shows zero results:

1. Confirm product is `ACTIVE`.
2. Confirm product approval is `APPROVED`.
3. Confirm seller status is `APPROVED`.
4. Confirm category is active.
5. Run `pnpm search:reindex`.
6. Check `/admin/search`.
7. Try `GET /api/search?q=PRODUCT_TERM&limit=10`.

## 16. Admin Setup

### 16.1 First admin login

Open:

```text
https://YOUR_DOMAIN/admin
```

Use:

- `INDIHUB_FIRST_ADMIN_EMAIL`
- `INDIHUB_FIRST_ADMIN_PASSWORD`

Immediately after first login:

1. Open `/admin/users`.
2. Create or verify real admin users.
3. Assign only required roles.
4. Confirm finance users have `FINANCE` role, not unrestricted admin access.
5. Confirm delivery partner users have `DELIVERY_PARTNER` role.
6. Confirm seller/customer identities are not given admin roles.

### 16.2 Verify admin session

In browser DevTools or API test:

```text
GET /api/admin/auth/me
```

Expected:

- Signed-in admin returns a valid admin profile.
- Signed-out request returns unauthorized.
- Clerk customer token does not grant admin access.

### 16.3 Admin navigation setup checklist

Verify every key admin surface opens:

- `/admin`
- `/admin/users`
- `/admin/customers`
- `/admin/sellers`
- `/admin/products`
- `/admin/categories`
- `/admin/orders`
- `/admin/reviews`
- `/admin/b2b-enquiries`
- `/admin/business-buyers`
- `/admin/support`
- `/admin/cms`
- `/admin/locations`
- `/admin/locations/import`
- `/admin/storage`
- `/admin/search`
- `/admin/settings/general`
- `/admin/email`
- `/admin/payments`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/finance/commission-rules`
- `/admin/finance/settlements`
- `/admin/finance/payouts`
- `/admin/finance/ledger`
- `/admin/finance/statements`

## 17. General Platform Settings

Open:

```text
/admin/settings/general
```

Complete:

1. Platform name and support contact values.
2. Public website URL.
3. Checkout settings.
4. Payment settings.
5. Platform fee settings.
6. Storage settings.
7. Payout settings.
8. Map routing settings if used.

Verification:

- Change one non-secret setting.
- Save.
- Refresh page.
- Confirm value persists.
- Restart API.
- Refresh page again.
- Confirm value still persists.

## 18. Payment Setup

Primary admin path:

```text
/admin/payments
```

Settings center path:

```text
/admin/settings/general
```

API endpoints:

```text
GET   /api/admin/payments/readiness
GET   /api/admin/payments/config
PATCH /api/admin/payments/config
GET   /api/payments/checkout-methods
POST  /api/payments/razorpay/orders/:orderNumber
POST  /api/payments/razorpay/verify
POST  /api/payments/razorpay/webhook
```

### 18.1 Razorpay setup

In Razorpay Dashboard:

1. Create or use the business account.
2. Complete KYC and activation.
3. Create test keys first.
4. Configure webhook URL:

```text
https://YOUR_DOMAIN/api/payments/razorpay/webhook
```

5. Select payment events used by the app:
   - payment captured
   - payment failed
   - order paid, if enabled in Razorpay account
6. Copy webhook secret.

In 1HandIndia Admin:

1. Open `/admin/payments`.
2. Enable Razorpay.
3. Select `TEST` mode first.
4. Enter key ID.
5. Enter key secret.
6. Enter webhook secret.
7. Save.
8. Check readiness panel.

Test:

1. Place customer order with Razorpay.
2. Razorpay checkout must open.
3. Complete a test payment.
4. Order payment must move to `PAID`.
5. `/admin/orders/:orderNumber` must show payment event.
6. `/admin/email` logs should show payment/order emails if email is enabled.

Live switch:

1. Replace test keys with live keys.
2. Switch mode to `LIVE`.
3. Confirm webhook secret is from live dashboard.
4. Run one low-value live transaction.
5. Confirm settlement in Razorpay dashboard.

### 18.2 COD setup

In `/admin/payments`:

1. Enable COD only if operations can collect cash.
2. Set max COD order value.
3. Add clear COD instructions.
4. Confirm COD is allowed only for serviceable areas.

Test:

1. Place COD order.
2. Payment stays `PENDING`.
3. Seller fulfills order.
4. Delivery partner records COD collected.
5. Finance/Admin verifies collection.
6. Only after verification, payment becomes `PAID`.

### 18.3 Bank transfer setup

In `/admin/payments`:

1. Enable bank transfer if accepted.
2. Enter bank name, account name, account number, IFSC, UPI, and instructions.
3. Place test order with bank transfer.
4. Customer submits reference or UTR if UI flow is enabled.
5. Finance verifies from `/finance/bank-transfers`.
6. Payment becomes `PAID` only after verification.

### 18.4 Manual payment setup

Use manual payment only for controlled admin/finance cases.

1. Enable manual payment.
2. Restrict who can update payment status.
3. Confirm audit logs are written.
4. Use finance workspace for payment status corrections.

### 18.5 Buyer platform fee

Open:

```text
/admin/settings/general
```

Configure:

1. Enable or disable buyer platform fee.
2. Choose percentage or fixed amount.
3. Save.
4. Add item to cart.
5. Open checkout summary.
6. Confirm fee appears correctly.
7. Place order.
8. Confirm order stores the platform fee snapshot.

## 19. Email Setup

Primary admin path:

```text
/admin/email
```

Compatibility tracking path:

```text
/admin/notifications
```

API endpoints:

```text
GET   /api/admin/email/overview
GET   /api/admin/email/settings/current
PUT   /api/admin/email/settings/current
GET   /api/admin/email/templates
POST  /api/admin/email/templates
PATCH /api/admin/email/templates/:id
GET   /api/admin/email/themes
POST  /api/admin/email/themes
PATCH /api/admin/email/themes/:id
GET   /api/admin/email/triggers
PATCH /api/admin/email/triggers/:id
GET   /api/admin/email/logs
POST  /api/admin/email/logs/:id/retry
```

### 19.1 Choose provider

Supported providers:

- Brevo.
- Resend.
- SendGrid.
- SMTP.
- SMTP bridge.

Recommended practical first launch:

- Use Brevo or Resend for transactional emails if the domain is verified.
- Use SMTP only if provider limits and deliverability are understood.

### 19.2 Domain authentication

In your email provider:

1. Add sending domain.
2. Add SPF DNS record.
3. Add DKIM DNS records.
4. Add DMARC DNS record.
5. Wait for verification.
6. Send a test email from provider dashboard.

### 19.3 Configure inside 1HandIndia

In `/admin/email`:

1. Open Settings.
2. Enable email sending.
3. Choose provider.
4. Enter sender name.
5. Enter sender email.
6. Enter admin alert recipients.
7. Enter provider key or SMTP settings.
8. Save.

### 19.4 Template and trigger setup

In `/admin/email`:

1. Open Themes.
2. Confirm default 1HandIndia theme.
3. Open Templates.
4. Confirm templates are published.
5. Open Triggers.
6. Confirm required events are enabled.
7. Do not use unknown placeholders.

Required live email flow checks:

- Customer account created.
- Seller registration submitted.
- Seller approved.
- Product submitted.
- Product approved.
- Order placed.
- Payment success.
- Payment failed.
- Delivery assigned to partner.
- Delivery COD collected.
- B2B enquiry submitted.
- B2B enquiry response.
- Support request received.

### 19.5 Worker verification

Worker must be running:

```bash
sudo systemctl status indihub-worker
```

Logs:

```bash
journalctl -u indihub-worker -f
```

Admin checks:

1. Open `/admin/email` Overview.
2. Confirm pending count is not stuck.
3. Open Logs.
4. Confirm emails show `SENT`, `FAILED`, or `SKIPPED`.
5. Retry a failed log only after fixing the cause.

## 20. Storage Setup

Primary admin paths:

```text
/admin/storage
/admin/settings/general
```

API endpoints:

```text
GET /api/storage/readiness
GET /api/storage/configuration
PUT /api/storage/configuration
```

### 20.1 Public image storage

Public images include:

- Product images.
- Seller logos.
- Seller banners.
- Homepage banners.
- CMS media.

Recommended provider options:

- ImageKit.
- S3-compatible public bucket with CDN.

Setup:

1. Create provider account.
2. Create public image bucket or ImageKit endpoint.
3. Configure CORS for browser image loading.
4. Configure allowed image domain in Next.js if required.
5. Open `/admin/settings/general`.
6. Save public image provider credentials.
7. Open `/admin/storage`.
8. Confirm public image readiness is green.

Test uploads:

1. Seller logo upload.
2. Seller banner upload.
3. Product image upload.
4. Homepage banner upload.
5. Public product detail image loading.
6. Public store page logo/banner loading.

### 20.2 Private document storage

Private storage is used when document/proof workflows are enabled.

Examples:

- Seller KYC documents.
- Support attachments.
- Delivery proof files.
- Finance proof files.

Setup:

1. Create private S3-compatible bucket.
2. Block public access.
3. Create access key with bucket-specific permissions.
4. Save endpoint, region, bucket, access key, and secret in `/admin/settings/general`.
5. Enable private storage only after readiness is green.
6. Test upload and protected download from an authorized role.
7. Confirm unauthorized users cannot download private files.

## 21. Location and Serviceability Setup

Admin paths:

```text
/admin/locations
/admin/locations/import
/admin/locations/serviceability
```

API endpoints:

```text
GET /api/locations/countries
GET /api/locations/states
GET /api/locations/cities
GET /api/locations/areas
GET /api/admin/locations/india-postal-lookup
GET /api/admin/locations/serviceability
```

### 21.1 Load reference locations

If the production DB has no India location data, run the approved import:

```bash
set -a
source /var/www/indihub/.env.production
set +a
pnpm locations:import:india
```

Run this only after approving the write operation for the target database.

### 21.2 Configure coverage

In admin:

1. Open `/admin/locations`.
2. Confirm countries, states, cities, and local areas.
3. Enable serviceable areas.
4. Set local delivery availability.
5. Set COD availability if needed.
6. Test pincode lookup.

### 21.3 Serviceability test

Open:

```text
/admin/locations/serviceability
```

Check:

- Customer city.
- Local area.
- Pincode.
- Payment method.
- Cart subtotal.

Expected:

- Checkout is allowed only where serviceability rules allow it.
- Shipping, COD, and delivery-partner assignment rules match operations.

## 22. CMS, SEO, and Public Content Setup

Primary admin path:

```text
/admin/cms
```

Public API endpoints:

```text
GET /api/cms/pages
GET /api/cms/pages/:slug
GET /api/cms/banners
GET /api/cms/homepage-sections
GET /api/cms/menus
GET /api/cms/seo/resolve
GET /api/cms/sitemap
```

### 22.1 Required CMS pages

Create or verify:

- About.
- Contact.
- Privacy policy.
- Terms and conditions.
- Refund and cancellation policy.
- Shipping policy.
- Seller policy.
- B2B terms if used.

### 22.2 Homepage setup

In `/admin/cms`:

1. Create homepage banners.
2. Add desktop image.
3. Add mobile image.
4. Add CTA URL.
5. Publish only ready banners.
6. Create homepage sections.
7. Select categories, products, stores, or custom items.
8. Sort sections.
9. Open public homepage and verify.

### 22.3 SEO setup

Configure:

- Product SEO.
- Category SEO.
- Store SEO.
- B2B landing SEO.
- CMS page metadata.
- Sitemap readiness.
- Robots rules for private portals.

Verify:

```text
https://YOUR_DOMAIN/sitemap.xml
https://YOUR_DOMAIN/robots.txt
```

Private surfaces such as admin, seller orders, finance, and B2B enquiry details must not be publicly indexed.

## 23. Category, Product, HSN, GST, and Catalogue Setup

Admin paths:

```text
/admin/categories
/admin/products
/admin/product-templates
```

Seller paths:

```text
/seller/products
```

Public paths:

```text
/products/:slug
/categories/:slug
/search
```

### 23.1 Categories

Steps:

1. Open `/admin/categories`.
2. Create top-level categories.
3. Create subcategories.
4. Add category images.
5. Set active status.
6. Verify categories appear publicly.
7. Run search reindex after large category import.

### 23.2 HSN and GST data

For products:

1. Confirm HSN code source.
2. Confirm GST rate.
3. Use admin/product template fields where available.
4. Do not show internal HSN/GST/weight fields on public product pages unless legally required for that surface.

### 23.3 Product approval workflow

Seller:

1. Open `/seller/products`.
2. Create product.
3. Add images.
4. Add variants.
5. Set stock.
6. Submit for approval.

Admin:

1. Open `/admin/products`.
2. Review product details.
3. Approve or reject.
4. Add moderation note if rejected.
5. Confirm audit log.

Public:

1. Product appears only after approval.
2. Product search works.
3. Product detail loads.
4. Cart add works only when variant is available and in stock.

After bulk catalogue updates:

```bash
pnpm search:reindex
```

## 24. Seller Setup

Seller paths:

```text
/seller
/seller/register
/seller/profile
/seller/products
/seller/orders
/seller/reviews
/seller/b2b-enquiries
/seller/reports
/seller/finance/wallet
/seller/finance/payouts
/seller/finance/statements
```

Admin paths:

```text
/admin/sellers
/admin/sellers/approvals
/admin/products
/admin/reviews
/admin/finance/commission-rules
```

### 24.1 Seller registration

Seller:

1. Sign up through Clerk.
2. Open `/seller/register`.
3. Enter store name.
4. Enter business details.
5. Add address and service area.
6. Upload logo/banner.
7. Submit registration.

Admin:

1. Open `/admin/sellers`.
2. Review seller.
3. Approve, reject, suspend, or reactivate.
4. Confirm audit log.
5. Confirm seller receives email if email is enabled.

### 24.2 Seller operational readiness

Before seller goes live:

1. Seller profile is complete.
2. Seller address is serviceable.
3. Seller status is approved.
4. Seller payout details are filled if payouts are used.
5. Seller products are approved.
6. Seller can see only their own products and orders.
7. Seller cannot moderate customer reviews.
8. Seller cannot access admin or finance-only surfaces.

## 25. Customer Storefront Setup

Public/customer paths:

```text
/
/search
/products/:slug
/stores
/stores/:slug
/cart
/checkout
/checkout/success/:orderNumber
/account
/account/orders
/account/orders/:orderNumber
/wishlist
/track-order
/support
```

### 25.1 Public browsing

Verify:

1. Homepage loads.
2. Header search returns results.
3. Suggestions work after typing 2 or more characters.
4. Category pages load.
5. Product detail pages load.
6. Store pages load.
7. Approved reviews show publicly.
8. Pending/rejected/hidden reviews do not show publicly.

### 25.2 Customer account

Verify:

1. Clerk sign up works.
2. Clerk sign in works.
3. Account profile opens.
4. Address book works.
5. Wishlist works.
6. Cart persists.
7. Checkout requires valid address.
8. Orders appear in account.
9. Order cancellation rules work.
10. Support request works.

### 25.3 Checkout

Test every enabled payment method:

- Razorpay.
- COD.
- Bank transfer.
- Manual payment, if enabled.

Checkout checks:

1. Suspended seller products cannot be checked out.
2. Hidden or unapproved products cannot be checked out.
3. Out-of-stock variants cannot be checked out.
4. Platform fee is correct.
5. Shipping charge is correct.
6. Payment state is correct.
7. Order confirmation page is clear.
8. Customer email notification logs are created.

## 26. Order and Fulfilment Setup

Order surfaces:

```text
/admin/orders
/seller/orders
/delivery/orders
/account/orders
```

### 26.1 Multi-seller order rule

A single customer checkout can contain products from multiple sellers.

Operational rule:

- The platform order has one customer order number.
- Each seller has its own seller package/split.
- Each seller sees only its own package and items.
- Delivery assignment must wait until the relevant package is packed.
- For combined local delivery, assignment should happen only when all packages that belong to the delivery task are packed and ready.
- A seller that has not accepted or packed must not be shown as ready for pickup.

### 26.2 Seller fulfilment steps

Seller order flow:

1. New order appears in `/seller/orders`.
2. Seller accepts the package.
3. Seller moves package to processing.
4. Seller marks package packed.
5. Seller marks dispatched or hands over to delivery.
6. Timeline records every status change.

Admin checks:

1. Seller package status updates correctly.
2. Overall order rollup is correct.
3. Delivery status does not jump before seller package is ready.
4. Payment status is not overwritten by fulfilment updates.

### 26.3 Customer order detail

Customer should see:

- Order number.
- Order date.
- Payment status.
- Delivery progress.
- Items ordered.
- Delivery address.
- Payment summary.
- Order summary.
- Required support/review actions.

Customer should not see:

- Internal HSN/GST/package-weight fields unless legally required.
- Admin-only notes.
- Seller internal commission data.
- Delivery partner internal workload or COD exposure.

## 27. Delivery Partner Setup

Delivery paths:

```text
/delivery
/delivery/register
/delivery/orders
/delivery/orders/:orderNumber
/delivery/wallet
```

Admin paths:

```text
/admin/delivery-partner-applications
/admin/delivery-partners
/admin/delivery
/courier/local-delivery
/courier/local-delivery/partners
```

API endpoints:

```text
GET   /api/delivery/profile
GET   /api/delivery/orders
GET   /api/delivery/orders/:orderNumber
PATCH /api/delivery/orders/:orderNumber/assignment
PATCH /api/delivery/orders/:orderNumber/delivery
POST  /api/delivery/orders/:orderNumber/attempts
GET   /api/admin/delivery/unassigned-orders
POST  /api/admin/delivery/orders/:orderNumber/auto-assign
PATCH /api/admin/delivery/orders/:orderNumber/assignment
```

### 27.1 Delivery partner onboarding

Partner:

1. Sign in or register.
2. Open `/delivery/register`.
3. Submit name, phone, vehicle, service area, and operational profile.

Admin:

1. Open `/admin/delivery-partner-applications`.
2. Review application.
3. Approve only verified partners.
4. Open `/admin/delivery-partners`.
5. Set availability, service coverage, workload settings, and COD exposure limits.

### 27.2 Assignment rules

Assignment must follow this sequence:

1. Customer places order.
2. Seller accepts package.
3. Seller processes package.
4. Seller marks package packed.
5. Only packed package enters delivery assignment queue.
6. Admin or auto-assignment assigns partner.
7. Delivery partner accepts assignment.
8. Partner updates pickup, transit, out-for-delivery, delivered, failed attempt, and COD collection where applicable.

If any seller package in a combined local delivery task is not packed, that package must not be treated as pickup-ready.

### 27.3 Delivery partner order detail setup

The delivery partner order detail must show:

- Assignment acceptance action.
- Pickup step.
- Seller/store pickup address.
- Customer delivery address.
- Phone/contact allowed by policy.
- Items/package count.
- COD amount if applicable.
- Current delivery status.
- Tracking reference as read-only once assigned.
- Delivery note.
- Proof/COD collection controls if enabled.

The delivery partner must not edit tracking reference after assignment.

### 27.4 COD collection

For COD:

1. Partner delivers order.
2. Partner records cash collected.
3. Order payment remains `PENDING`.
4. Finance/Admin verifies collection.
5. Payment becomes `PAID`.
6. Seller split becomes settlement-eligible only after delivered and paid.

## 28. Courier and Local Delivery Operations

Courier paths:

```text
/courier
/courier/local-delivery
/courier/local-delivery/partners
/courier/cod-remittances
```

Admin/API areas:

```text
/api/admin/courier-providers
/api/admin/courier-shipments
/api/courier/providers
/api/webhooks/couriers/:providerCode/tracking
```

Setup:

1. Configure courier provider from admin if live courier integration is enabled.
2. Add provider code.
3. Add API credentials.
4. Add webhook secret.
5. Add serviceability rules.
6. Test rate card or routing simulator.
7. Create shipment from packed package.
8. Verify tracking updates.
9. Verify webhook idempotency.
10. Verify COD remittance and finance handoff.

For manual local delivery:

1. Keep provider mode as local delivery partner.
2. Use delivery partner profiles.
3. Use assignment queue.
4. Keep pickup and delivery timeline accurate.

## 29. Finance Setup

Admin finance paths:

```text
/admin/finance/commission-rules
/admin/finance/settlements
/admin/finance/payouts
/admin/finance/ledger
/admin/finance/statements
```

Finance manager paths:

```text
/finance
/finance/cod-collections
/finance/bank-transfers
/finance/payment-status
/finance/settlements
/finance/payouts
/finance/ledger
/finance/statements
/finance/commission-rules
/finance/reports
/finance/settings
```

Seller finance paths:

```text
/seller/finance/wallet
/seller/finance/payouts
/seller/finance/statements
```

### 29.1 Finance roles

Setup:

1. Create finance user.
2. Assign `FINANCE` role.
3. Verify finance user can open `/finance`.
4. Verify finance user cannot access full admin-only routes such as users/products/settings unless allowed by role policy.

### 29.2 Commission rules

In `/admin/finance/commission-rules`:

1. Create default commission rule.
2. Add GST/TDS/TCS rules if required.
3. Add category or seller-specific overrides only when approved.
4. Mark active.
5. Test order settlement calculation.

### 29.3 Payment verification

COD:

1. Open `/finance/cod-collections`.
2. Review partner collection.
3. Verify amount.
4. Mark verified.
5. Confirm order payment becomes `PAID`.

Bank transfer:

1. Open `/finance/bank-transfers`.
2. Search order number or UTR.
3. Verify bank receipt.
4. Mark paid.
5. Confirm audit log.

Manual corrections:

1. Open `/finance/payment-status`.
2. Use only for controlled correction.
3. Add clear note.
4. Confirm audit log.

### 29.4 Seller settlements and payouts

Settlement eligibility:

- Order is delivered.
- Payment is paid.
- Seller split is not already locked in another payout.

Process:

1. Open `/admin/finance/settlements`.
2. Draft settlement.
3. Review seller totals.
4. Submit settlement.
5. Open `/admin/finance/payouts`.
6. Approve payout.
7. Mark payout paid with payment reference.
8. Generate statement.
9. Seller sees statement in `/seller/finance/statements`.

## 30. B2B Buyer Setup

B2B paths:

```text
/b2b
/b2b/register
/b2b/company-profile
/b2b/enquiries
/b2b/enquiries/new
/b2b/enquiries/:id
/b2b/sign-in
/b2b/sign-up
```

Seller B2B path:

```text
/seller/b2b-enquiries
```

Admin B2B paths:

```text
/admin/b2b-enquiries
/admin/business-buyers
```

### 30.1 Business buyer onboarding

Buyer:

1. Sign up.
2. Open `/b2b/register`.
3. Add business profile.
4. Add GST or registration details if required.
5. Add procurement address.
6. Submit profile.

Admin:

1. Open `/admin/business-buyers`.
2. Review buyer.
3. Approve, disable, or request correction.

### 30.2 Enquiry workflow

Flow:

1. Buyer creates enquiry from `/b2b/enquiries/new`.
2. Seller or admin responds with quotation.
3. Status becomes `RESPONDED`.
4. Buyer confirms quotation.
5. Status becomes `BUYER_CONFIRMED`.
6. Admin approves confirmed enquiry.
7. Status becomes `ADMIN_APPROVED`.
8. Admin finalises.
9. Status becomes `FINALISED`.

Rules:

- Seller cannot respond after buyer confirmation.
- Buyer cancellation is allowed only while enquiry is still open.
- Admin status changes must write audit logs.

## 31. Ratings and Reviews Setup

Customer paths:

```text
/account/orders/:orderNumber
```

Seller path:

```text
/seller/reviews
```

Admin path:

```text
/admin/reviews
```

Public paths:

```text
/products/:slug
/stores/:slug
/search
```

API endpoints:

```text
GET   /api/reviews/products/:productId
GET   /api/reviews/products/:productId/summary
GET   /api/account/reviews/orders/:orderNumber
POST  /api/account/reviews
GET   /api/admin/reviews
PATCH /api/admin/reviews/:reviewId/moderation
GET   /api/seller/reviews/summary
GET   /api/seller/reviews
```

### 31.1 Customer review rule

Customer can review only when:

- Product was purchased by that customer.
- Order is delivered.
- Payment is paid.
- Review is tied to order item.

New or edited review status:

```text
PENDING
```

### 31.2 Admin moderation

In `/admin/reviews`:

1. Filter pending reviews.
2. Read review.
3. Approve, reject, or hide.
4. Add moderation note if needed.
5. Confirm audit log.

Public pages show only approved reviews.

### 31.3 Seller review page

In `/seller/reviews`, seller can:

- View average rating.
- View review count.
- Search/filter product reviews.
- Read safe customer display name.
- See order context if allowed.

Seller cannot:

- Approve reviews.
- Reject reviews.
- Hide reviews.
- Edit customer review text.
- Delete customer reviews.
- See customer phone/email from review page.

### 31.4 Public rating checks

Verify:

1. Product card rating uses approved reviews only.
2. Product detail rating uses approved reviews only.
3. Store page rating is calculated from approved product reviews.
4. JSON-LD `aggregateRating` appears only when approved reviews exist.
5. Pending/rejected/hidden/deleted reviews never show publicly.

## 32. Deals and Promotions Setup

Admin paths:

```text
/admin/deals
```

Seller paths:

```text
/seller/deals
```

Setup:

1. Create deal campaign.
2. Set start and end time.
3. Set discount.
4. Enroll products.
5. Approve or publish campaign as required.
6. Confirm storefront badges.
7. Confirm search sorting by discount.
8. Confirm expired deals disappear automatically.

## 33. Support Setup

Public/customer paths:

```text
/support
/contact
```

Admin path:

```text
/admin/support
```

API endpoints:

```text
POST /api/support-requests
GET  /api/admin/support-requests
```

Setup:

1. Confirm support categories.
2. Confirm public support form.
3. Submit test request.
4. Admin views request.
5. Admin updates status.
6. Email logs show submitter/admin alerts if email is enabled.

## 34. Reports and Analytics Setup

Admin report path:

```text
/admin/reports
```

Finance report path:

```text
/finance/reports
```

Seller report path:

```text
/seller/reports
```

Verify:

1. Cancelled orders are excluded from revenue.
2. Seller/product totals use database aggregates.
3. Finance reports match paid/pending/settled state.
4. Seller sees only own sales.
5. Admin sees marketplace-wide reports.

If external analytics such as Sentry or product analytics is configured, keep provider keys in environment/settings only.

## 35. Security and Access Control Setup

### 35.1 Role checks

Verify:

- Customer cannot access seller center.
- Seller cannot access admin.
- Seller cannot access other sellers' orders.
- Seller cannot moderate reviews.
- Finance user cannot access full admin-only routes.
- Delivery partner sees only assigned orders.
- B2B buyer sees only own enquiries.
- Public user sees only public approved content.

### 35.2 Admin audit checks

Open:

```text
/admin/audit-logs
```

Verify audit logs for:

- Seller approval/rejection/suspension.
- Product approval/rejection/archive.
- Order status update.
- Delivery assignment.
- Payment verification.
- COD verification.
- Review moderation.
- Settings update.
- CMS publish/archive/delete.
- Role changes.
- Finance payout actions.

### 35.3 Headers and CORS

Check:

```bash
curl -I https://YOUR_DOMAIN
curl -I https://YOUR_DOMAIN/api/health
```

Confirm:

- HTTPS is enforced.
- API accepts only configured origins.
- API private port is not reachable publicly.
- Admin pages are not indexable.

## 36. Backup and Restore Setup

### 36.1 Database and local private-file backup

Create backup directories:

```bash
sudo mkdir -p /var/backups/indihub/postgres
sudo mkdir -p /var/backups/indihub/private-files
sudo chown -R postgres:postgres /var/backups/indihub/postgres
sudo chown -R indihub:indihub /var/backups/indihub/private-files
```

Manual database backup:

```bash
sudo -u postgres pg_dump -Fc indihub > /var/backups/indihub/postgres/indihub_$(date +%F_%H%M).dump
```

Manual local private-file backup, if `INDIHUB_PRIVATE_STORAGE_PROVIDER=LOCAL` or `AUTO` is using local fallback:

```bash
sudo -u indihub mkdir -p /var/backups/indihub/private-files/$(date +%F_%H%M)
sudo -u indihub rsync -a --delete /var/www/indihub/storage/private/ /var/backups/indihub/private-files/$(date +%F_%H%M)/
```

If `INDIHUB_PRIVATE_UPLOAD_ROOT` is changed, replace `/var/www/indihub/storage/private/` with the resolved production path.

Automate with cron:

```bash
sudo crontab -u postgres -e
sudo crontab -u indihub -e
```

Example daily database backup at 2:30 AM:

```cron
30 2 * * * pg_dump -Fc indihub > /var/backups/indihub/postgres/indihub_$(date +\%F_\%H\%M).dump
```

Example daily private-file backup at 2:35 AM:

```cron
35 2 * * * mkdir -p /var/backups/indihub/private-files/$(date +\%F_\%H\%M) && rsync -a --delete /var/www/indihub/storage/private/ /var/backups/indihub/private-files/$(date +\%F_\%H\%M)/
```

Keep the database dump timestamp and private-file backup timestamp together. Private upload keys live in PostgreSQL, while LOCAL private file bytes live on disk. Restoring only one side can create broken seller document or B2B purchase-order links.

### 36.2 Restore database and private files together

Stop the application before restore:

```bash
sudo systemctl stop indihub-api indihub-web indihub-worker
```

Restore the database from the selected backup window:

```bash
sudo -u postgres dropdb indihub
sudo -u postgres createdb indihub
sudo -u postgres pg_restore -d indihub /var/backups/indihub/postgres/BACKUP_FILE.dump
```

Restore local private files from the matching timestamped directory:

```bash
sudo -u indihub rsync -a --delete /var/backups/indihub/private-files/MATCHING_TIMESTAMP/ /var/www/indihub/storage/private/
```

Then restart and verify:

```bash
sudo systemctl start indihub-api indihub-web indihub-worker
curl https://YOUR_DOMAIN/api/health
```

Verify at least one seller document and one B2B purchase-order document from the restored backup if those features are enabled.

### 36.3 Restore test

At least once before launch:

1. Create a separate restore database.
2. Restore the latest backup.
3. Run `pnpm db:validate` against restore DB.
4. Confirm key table counts.
5. Restore the matching private-file backup into a temporary directory if local private storage is enabled.
6. Confirm stored private file keys resolve to files.
7. Document restore time.

Restore example:

```bash
sudo -u postgres createdb indihub_restore_test
sudo -u postgres pg_restore -d indihub_restore_test /var/backups/indihub/postgres/BACKUP_FILE.dump
```

### 36.4 Asset backup

Back up:

- Public image provider bucket.
- Private storage bucket.
- `.env.production` through a secure password manager or encrypted vault.
- Nginx config.
- systemd service files.

Do not store plaintext secrets in normal backups accessible to non-admin staff.

## 37. Monitoring and Logs

### 37.1 Basic uptime checks

Monitor:

```text
https://YOUR_DOMAIN
https://YOUR_DOMAIN/api/health
```

Alert when:

- Site is down.
- API health fails.
- SSL certificate expires soon.
- Disk usage crosses 80 percent.
- Database backup missing.

### 37.2 Logs

API:

```bash
journalctl -u indihub-api -f
```

Web:

```bash
journalctl -u indihub-web -f
```

Worker:

```bash
journalctl -u indihub-worker -f
```

Nginx:

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

PostgreSQL:

```bash
sudo journalctl -u postgresql -f
```

### 37.3 Sentry

Sentry is wired for the web app and native customer app. Treat this as mandatory production observability unless the client explicitly chooses a different provider.

```env
# Web runtime
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_DSN="https://..."
SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_ENABLE_SENTRY_EXAMPLE="false"

# Web build/source-map upload
SENTRY_ORG="demo-n0b"
SENTRY_PROJECT="javascript-nextjs"
SENTRY_AUTH_TOKEN="set-in-ci-or-server-secret-store"

# Native customer app runtime
EXPO_PUBLIC_SENTRY_DSN="https://..."
EXPO_PUBLIC_APP_ENV="production"
EXPO_PUBLIC_ENABLE_SENTRY_EXAMPLE="false"

# Optional only if a proxy/webview blocks direct Sentry requests
EXPO_PUBLIC_SENTRY_TUNNEL_URL=""
```

Do not commit `SENTRY_AUTH_TOKEN`. Put it in CI, server secret storage, or EAS secrets only.

Web production checklist:

1. `@sentry/nextjs` is installed in `apps/web`.
2. `apps/web/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and `instrumentation.ts` exist.
3. `apps/web/src/app/global-error.tsx` captures app-level render errors.
4. `apps/web/next.config.mjs` wraps config with `withSentryConfig`.
5. Web tunnel route is `/_1hi/relay`; verify this path is not blocked by browser extensions, CDN rules, WAF, or Nginx.
6. Web replay privacy remains strict: default PII off, inputs/text/media masked.
7. Source maps upload during production build when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are present.
8. `/sentry-example-page` stays disabled in production unless `NEXT_PUBLIC_ENABLE_SENTRY_EXAMPLE=true` is intentionally set for a short verification window.
9. Trigger one captured test error, confirm it appears in Sentry with readable release/source-map context, then disable the example flag again.

Native customer app production checklist:

1. `@sentry/react-native` is installed in `apps/mobile-customer`.
2. `apps/mobile-customer/app.json` includes the `@sentry/react-native/expo` plugin.
3. `apps/mobile-customer/app/_layout.tsx` initializes and wraps the root with mobile telemetry.
4. `apps/mobile-customer/src/lib/mobile-telemetry.ts` is used by screens instead of calling Sentry directly.
5. Mobile telemetry keeps PII out of events: default PII off, screenshots off, sanitized event properties only.
6. `SENTRY_AUTH_TOKEN` is available to EAS/CI for source maps and native debug symbols.
7. `EXPO_PUBLIC_ENABLE_SENTRY_EXAMPLE=false` in normal production builds.
8. Build a production/internal app, trigger the mobile Sentry test screen only during verification, confirm the event appears in Sentry, then keep the trigger disabled.
9. If using EAS, set Sentry secrets through EAS/CI. Do not rely on local `.env` for cloud builds.

Final verification:

1. Web client errors report.
2. Web server/edge errors report.
3. Native customer app errors report.
4. Source maps and native debug symbols resolve stack traces.
5. Sensitive data is not sent.
6. Sentry example routes/screens are disabled after verification.

## 38. Deployment Update Procedure

Use this process for every release:

1. Announce maintenance window if needed.
2. Back up database.
3. Pull/copy latest code.
4. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

5. Generate Prisma client:

```bash
pnpm db:generate
```

6. Validate schema:

```bash
pnpm db:validate
```

7. Check migration status:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

8. Apply migrations:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

9. Build:

```bash
pnpm build
```

10. Restart:

```bash
sudo systemctl restart indihub-api indihub-web indihub-worker
```

11. Health check:

```bash
curl https://YOUR_DOMAIN/api/health
curl -I https://YOUR_DOMAIN
```

12. Verify key flows:

- Public search.
- Product detail.
- Cart.
- Checkout.
- Admin login.
- Seller order page.
- Delivery order page.
- Finance dashboard.

13. If search schema or catalogue logic changed:

```bash
pnpm search:reindex
```

## 39. Complete Launch QA Checklist

### 39.1 Infrastructure

- [ ] DNS points to VPS.
- [ ] SSL works.
- [ ] Nginx reverse proxy works.
- [ ] API port is private.
- [ ] Web port is private.
- [ ] PostgreSQL is private.
- [ ] `REDIS_URL` is empty for the current no-Redis deployment.
- [ ] `INDIHUB_ANDROID_APP_LINK_SHA256` is set when Android App Links are enabled for the customer app.
- [ ] `INDIHUB_IOS_APP_ID` is set when iOS Universal Links are enabled for the customer app.
- [ ] `/.well-known/assetlinks.json` returns the production Android package and SHA-256 fingerprint.
- [ ] `/.well-known/apple-app-site-association` returns the production Apple app ID and store paths.
- [ ] systemd restarts services after reboot.
- [ ] Backups are scheduled.
- [ ] Restore test completed.

### 39.2 Public storefront

- [ ] Home loads.
- [ ] Header is responsive.
- [ ] Mobile menu works.
- [ ] Search suggestions work.
- [ ] `/search` returns products/stores/categories.
- [ ] Product detail loads.
- [ ] Store page loads.
- [ ] Tapping a Google/Search/mobile-browser store link opens the installed customer app directly to the matching store page.
- [ ] Cart works.
- [ ] Wishlist works.
- [ ] CMS policy pages load.
- [ ] Support/contact form works.

### 39.3 Customer

- [ ] Clerk sign up works.
- [ ] Clerk sign in works.
- [ ] Customer mobile Google sign-in opens Clerk Google OAuth and returns through `onehandindia://sso-callback`.
- [ ] Mobile OAuth account sync completes through `/auth/sync-current-user`; sync failure shows retry and sign-out recovery.
- [ ] Account opens.
- [ ] Address create/edit/default works.
- [ ] Cart checkout summary correct.
- [ ] Razorpay test order works if enabled.
- [ ] COD order works if enabled.
- [ ] Bank transfer order works if enabled.
- [ ] Order detail shows clean customer UI.
- [ ] Cancellation rules work.
- [ ] Review eligibility appears only after delivered and paid.

### 39.4 Seller

- [ ] Seller registration works.
- [ ] Admin approval works.
- [ ] Seller profile works.
- [ ] Product create/edit/archive works.
- [ ] Product image upload works.
- [ ] Seller order list works.
- [ ] Seller order detail works.
- [ ] Status timeline is clear and not duplicated.
- [ ] Seller reviews page is read-only.
- [ ] Seller finance wallet/payout/statement pages work.

### 39.5 Admin

- [ ] Standalone admin login works.
- [ ] Clerk user cannot access admin routes.
- [ ] Dashboard loads.
- [ ] Users/roles works.
- [ ] Sellers works.
- [ ] Products approval works.
- [ ] Orders work.
- [ ] Reviews moderation works.
- [ ] CMS works.
- [ ] Locations work.
- [ ] Storage readiness works.
- [ ] Search index admin works.
- [ ] Email workspace works.
- [ ] Payments readiness works.
- [ ] Reports work.
- [ ] Audit logs record sensitive changes.

### 39.6 Delivery

- [ ] Delivery partner registration works.
- [ ] Admin approval works.
- [ ] Delivery partner profile opens.
- [ ] Assigned order appears.
- [ ] Completed assigned order still appears in proper completed/history view or API filter.
- [ ] Seller pickup address is visible to delivery partner.
- [ ] Customer address is visible.
- [ ] Assignment accept/reject works.
- [ ] Tracking reference is read-only after assignment.
- [ ] Pickup/in-transit/out-for-delivery/delivered updates work.
- [ ] COD collection works.
- [ ] Finance/Admin verification controls payment state.

### 39.7 Finance

- [ ] Finance login works.
- [ ] Finance role cannot access unrelated admin-only routes.
- [ ] COD collections visible.
- [ ] Bank transfers visible.
- [ ] Payment status corrections require notes.
- [ ] Commission rules work.
- [ ] Settlement draft works.
- [ ] Payout approval works.
- [ ] Mark paid works.
- [ ] Seller ledger updates.
- [ ] Seller statement downloads.

### 39.8 B2B

- [ ] B2B sign up works.
- [ ] Business profile works.
- [ ] Enquiry creation works.
- [ ] Seller response works.
- [ ] Buyer confirmation works.
- [ ] Admin approval works.
- [ ] Finalise works.
- [ ] Seller cannot respond after buyer confirmation.
- [ ] Buyer cannot cancel after locked stage.

### 39.9 Notifications

- [ ] Email provider configured.
- [ ] Sender domain verified.
- [ ] Email settings enabled.
- [ ] Templates published.
- [ ] Triggers enabled.
- [ ] Logs show rendered content.
- [ ] Retry works after fixing failed config.
- [ ] Worker is running.

### 39.10 Payments

- [ ] Razorpay keys configured if Razorpay enabled.
- [ ] Razorpay webhook URL configured.
- [ ] Razorpay test payment marks order paid.
- [ ] Failed Razorpay payment does not mark order paid.
- [ ] Late failed webhook does not downgrade paid order.
- [ ] COD stays pending until verification.
- [ ] Bank transfer stays pending until verification.
- [ ] Audit logs exist for payment changes.

## 40. Troubleshooting

### 40.1 `prisma` command not found

Use:

```bash
npx prisma migrate status --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
```

or:

```bash
pnpm exec prisma migrate status --schema prisma/schema.prisma
```

On Windows local machines, use `npx.cmd` or `pnpm.cmd`.

### 40.2 Prisma P1001

Cause:

- API cannot reach PostgreSQL.
- Wrong host, port, database, username, or password.
- PostgreSQL not running.
- Firewall blocks connection.
- PgBouncer misconfigured.

Check:

```bash
sudo systemctl status postgresql
psql "$DATABASE_DIRECT_URL"
```

Fix:

1. Confirm `DATABASE_URL`.
2. Confirm `DATABASE_DIRECT_URL`.
3. Confirm DB user and password.
4. Confirm PostgreSQL listens on localhost.
5. Restart API and worker.

### 40.3 502 Bad Gateway

Cause:

- Web or API service is down.
- Nginx points to wrong port.
- App crashed on startup.

Check:

```bash
sudo systemctl status indihub-api
sudo systemctl status indihub-web
journalctl -u indihub-api -n 100
journalctl -u indihub-web -n 100
sudo nginx -t
```

### 40.4 Search returns zero results for visible product

Check:

```bash
pnpm search:reindex
curl "https://YOUR_DOMAIN/api/search?q=PRODUCT_NAME&limit=10"
```

Then verify:

- Product is active.
- Product is approved.
- Seller is approved.
- Category is active.
- Search document count is not zero.
- Worker is running.
- Nginx is not caching an old empty response for too long.

### 40.5 Email not sending

Check:

1. `/admin/email` Settings enabled.
2. Provider credentials saved.
3. Sender domain verified.
4. Template published.
5. Trigger enabled.
6. Worker running.
7. `REDIS_URL` is empty, so no Redis queue dependency is expected.
8. `/admin/email` Logs error message.

Commands:

```bash
sudo systemctl status indihub-worker
journalctl -u indihub-worker -n 100
```

### 40.6 Razorpay order stays pending

Check:

1. Razorpay is enabled.
2. Correct test/live mode.
3. Correct key ID and key secret.
4. Checkout signature verify succeeded.
5. Webhook URL is `https://YOUR_DOMAIN/api/payments/razorpay/webhook`.
6. Webhook secret matches Razorpay dashboard.
7. Payment captured in Razorpay dashboard.
8. API logs have no webhook signature error.

### 40.7 Images not loading

Check:

1. `/admin/storage` readiness.
2. Public image base URL.
3. ImageKit or S3 CORS.
4. Provider credentials.
5. Stored asset key.
6. Next image remote allowlist if needed.
7. Browser console network error.

### 40.8 Customer cannot sign in

Check:

1. Clerk publishable key.
2. Clerk secret key.
3. Clerk domain settings.
4. Redirect URLs.
5. `CLERK_JWT_KEY` from same Clerk app.
6. `CLERK_AUTHORIZED_PARTIES`.
7. Browser URL is production domain, not localhost.

### 40.9 Admin cannot sign in

Check:

1. `INDIHUB_FIRST_ADMIN_EMAIL`.
2. `INDIHUB_FIRST_ADMIN_PASSWORD`.
3. API running.
4. `/api/admin/auth/me` behavior.
5. Admin session TTL.
6. Database contains admin user/session rows.

Admin login does not use Clerk.

### 40.10 Delivery partner assigned order not showing

Check:

1. User has `DELIVERY_PARTNER` role.
2. Delivery profile is active.
3. Assignment exists for that user.
4. API filter includes assigned and completed statuses where needed.
5. Order was not assigned before package was packed.
6. Completed orders are shown in completed/history view, not only active queue.
7. `/api/delivery/orders` returns the expected filter result.

### 40.11 Tracking reference editable after assignment

Correct behavior:

- Admin/system creates the tracking reference.
- Once assigned, delivery partner sees it read-only.
- Partner can update delivery note/status/proof, not the reference.

If editable:

1. Check delivery detail UI.
2. Check API DTO validation.
3. Check role permissions.
4. Confirm attempts to change reference are rejected or ignored.

## 41. Production Handoff Checklist

Before declaring VPS production ready:

- [ ] Domain and SSL working.
- [ ] All services restart after reboot.
- [ ] Migrations deployed.
- [ ] System seed completed if required.
- [ ] Search reindex completed.
- [ ] Admin login verified.
- [ ] Clerk production auth verified.
- [ ] Mobile Clerk Google OAuth redirect and account sync verified if the customer app is shipped.
- [ ] Payments configured and tested.
- [ ] Email configured and tested.
- [ ] Storage configured and tested.
- [ ] Backup and restore tested.
- [ ] Public storefront QA completed.
- [ ] Customer checkout QA completed.
- [ ] Seller operations QA completed.
- [ ] Delivery partner QA completed.
- [ ] Finance QA completed.
- [ ] B2B QA completed.
- [ ] Review moderation QA completed.
- [ ] Audit logs verified.
- [ ] Nginx rate limiting enabled.
- [ ] API ports are private.
- [ ] Provider secrets stored securely.
- [ ] Admin/operator team trained on daily flows.

## 42. Daily Operations After Launch

Every day:

1. Check `/admin` dashboard.
2. Check pending seller approvals.
3. Check pending product approvals.
4. Check pending review approvals.
5. Check payment pending queue.
6. Check COD collections.
7. Check failed emails.
8. Check delivery exceptions.
9. Check support requests.
10. Check backup completed.

Every week:

1. Review audit logs.
2. Review failed search jobs.
3. Review slow or failed API logs.
4. Test one restore backup.
5. Review seller settlement queue.
6. Review storage usage.
7. Review SSL renewal status.
8. Review provider invoices and limits.

Every release:

1. Backup DB.
2. Apply migrations.
3. Build.
4. Restart services.
5. Run launch QA smoke checklist.
6. Record release notes and operator impacts.
