# 1HandIndia Docker VPS End-to-End Setup Guide

**Project:** 1HandIndia multi-vendor ecommerce marketplace  
**Audience:** Developer, DevOps operator, production owner  
**Target OS:** Ubuntu 24.04 LTS or Ubuntu 22.04 LTS  
**Target deployment:** Single VPS, Docker for app services, host PostgreSQL, Nginx edge  
**Last updated:** 2026-07-23

## 1. Decision

Use Docker for the three Node services only:

- `web`: Next.js app on `127.0.0.1:3000`
- `api`: NestJS API on `127.0.0.1:4000`
- `worker`: background jobs, no public port

Keep PostgreSQL on the VPS host, not inside Docker.

Do not install Redis for the current launch. Keep `REDIS_URL=""`.

This is the shortest production architecture that fits the current codebase. It avoids Kubernetes, avoids unnecessary service sprawl, and keeps database backup/restore simple.

## 2. Architecture

```text
Internet
  |
  v
Cloudflare or DNS provider
  |
  v
Nginx on VPS, ports 80 and 443
  |
  +--> 127.0.0.1:3000  Docker container: @indihub/web
  |
  +--> 127.0.0.1:4000  Docker container: @indihub/api

Background:
  - Docker container: @indihub/worker
  - Host PostgreSQL on 127.0.0.1:5432
  - Optional host PgBouncer later on 127.0.0.1:6432
  - Public images on ImageKit or S3-compatible storage
  - Private files on S3-compatible storage or backed-up local storage
```

Why host networking for app containers:

- The API, web, worker, Nginx, and PostgreSQL can all use `127.0.0.1`.
- No Docker port publishing is needed.
- Docker published ports can bypass `ufw`, so binding apps to localhost through host networking is simpler and safer for a single Ubuntu VPS.

## 3. Current Repo Readiness

Latest local readiness check:

```text
pnpm.cmd db:validate                         passed
pnpm.cmd --filter @indihub/api typecheck     passed
pnpm.cmd --filter @indihub/api build         passed
pnpm.cmd --filter @indihub/web typecheck     passed
pnpm.cmd --filter @indihub/web build         passed
pnpm.cmd --filter @indihub/worker typecheck  passed
pnpm.cmd --filter @indihub/worker build      passed
```

Known deploy caveat:

- The workspace currently has uncommitted and untracked changes.
- Do not copy the local folder directly to production.
- Create a release branch, review, commit, push, and deploy the exact commit.

Check before release:

```powershell
git status --short
git diff --check
git ls-files --others --exclude-standard
git check-ignore -v .env
```

Expected:

- `.env`, `.env.production`, `auth.json`, keys, PEM files, keystores, and provider credential files are not staged.
- `git diff --check` has no whitespace errors.

## 4. VPS Baseline

Recommended first serious VPS:

```text
Ubuntu 24.04 LTS
6 vCPU
12 GB RAM
100 GB NVMe
Daily external backup target
```

Minimum for staging or light launch:

```text
Ubuntu 22.04 or 24.04 LTS
4 vCPU
8 GB RAM
80 GB NVMe
```

Avoid HDD storage for PostgreSQL.

## 5. Domain Plan

Recommended:

```text
https://1handindia.com
https://www.1handindia.com
```

Same-domain API:

```text
https://1handindia.com/api
```

Use same-domain API first. It is simpler for CORS, cookies, Clerk authorized parties, Razorpay webhooks, and Nginx.

## 6. Official References

Use Docker's official Ubuntu apt repository:

- https://docs.docker.com/engine/install/ubuntu/

Docker Compose production guidance:

- https://docs.docker.com/compose/how-tos/production/

Docker Compose environment files:

- https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/
- https://docs.docker.com/compose/how-tos/environment-variables/best-practices/

Do not use Docker's convenience script for production.

## 7. Local Release Preparation

On your development machine:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:generate
pnpm.cmd db:validate

pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api build

pnpm.cmd --filter @indihub/worker typecheck
pnpm.cmd --filter @indihub/worker lint
pnpm.cmd --filter @indihub/worker build

pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web build
```

Run tests only when the connected database is a disposable local test database:

```powershell
pnpm.cmd --filter @indihub/api test
pnpm.cmd --filter @indihub/web test
pnpm.cmd --filter @indihub/worker test
```

Do not run DB-writing integration tests against staging or production.

Create a release branch:

```powershell
git switch -c release/vps-docker-launch-2026-07-23
git add -A
git diff --cached --name-only | Select-String -Pattern '(^|/)\.env$|auth\.json|\.pem$|\.key$|\.jks$|\.keystore$|google-services\.json'
git diff --cached --check
git commit -m "Prepare VPS Docker production launch"
git push -u origin release/vps-docker-launch-2026-07-23
git rev-parse HEAD
```

Record the commit SHA before deploying.

## 8. New VPS Setup

Log in as a sudo user:

```bash
ssh root@YOUR_SERVER_IP
```

Update the server:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential nginx postgresql postgresql-contrib ufw ca-certificates gnupg
```

Create the app user:

```bash
sudo adduser indihub
sudo usermod -aG sudo indihub
```

Enable firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do not open:

```text
3000
4000
5432
6379
6432
```

## 9. Install Docker

Remove conflicting packages if present:

```bash
sudo apt remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc || true
```

Add Docker's official apt repository:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
```

Install Docker Engine and Compose plugin:

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo docker run hello-world
```

Allow the `indihub` user to run Docker:

```bash
sudo usermod -aG docker indihub
```

Log out and back in:

```bash
exit
ssh indihub@YOUR_SERVER_IP
docker version
docker compose version
```

## 10. PostgreSQL Setup On Host

Run:

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

Confirm PostgreSQL is running:

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SHOW data_directory;"
```

Recommended PostgreSQL tuning for 12 GB RAM:

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Set values close to:

```conf
shared_buffers = 3GB
effective_cache_size = 8GB
maintenance_work_mem = 512MB
work_mem = 16MB
max_connections = 80
random_page_cost = 1.1
effective_io_concurrency = 200
checkpoint_completion_target = 0.9
wal_compression = on
```

Restart:

```bash
sudo systemctl restart postgresql
```

## 11. Place Source Code

Create app directory:

```bash
sudo mkdir -p /var/www/indihub
sudo chown -R indihub:indihub /var/www/indihub
cd /var/www/indihub
```

Clone the release branch:

```bash
git clone --branch release/vps-docker-launch-2026-07-23 YOUR_GIT_REPO_URL .
git rev-parse HEAD
```

Confirm it matches the approved release commit.

## 12. Add Docker Files

Create `.dockerignore`:

```bash
nano .dockerignore
```

```dockerignore
.git
.turbo
.cache
.next
node_modules
apps/*/node_modules
packages/*/node_modules
dist
build
coverage
playwright-report
test-results
.env
.env.*
!.env.example
storage/private
*.log
*.zip
*.dump
*.pem
*.key
*.jks
*.keystore
auth.json
```

Create `Dockerfile.production`:

```bash
nano Dockerfile.production
```

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED="1"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl openssl dumb-init \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

WORKDIR /app

ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS
ARG NEXT_PUBLIC_MAP_PROVIDER
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_ATTRIBUTION
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_ENABLE_SENTRY=false

ENV NODE_ENV="production"
ENV INDIHUB_ENV="production"
ENV NEXT_PUBLIC_APP_ENV="$NEXT_PUBLIC_APP_ENV"
ENV NEXT_PUBLIC_WEB_URL="$NEXT_PUBLIC_WEB_URL"
ENV NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
ENV NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS="$NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS"
ENV NEXT_PUBLIC_MAP_PROVIDER="$NEXT_PUBLIC_MAP_PROVIDER"
ENV NEXT_PUBLIC_MAP_TILE_URL="$NEXT_PUBLIC_MAP_TILE_URL"
ENV NEXT_PUBLIC_MAP_ATTRIBUTION="$NEXT_PUBLIC_MAP_ATTRIBUTION"
ENV NEXT_PUBLIC_MAPBOX_TOKEN="$NEXT_PUBLIC_MAPBOX_TOKEN"
ENV NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN"
ENV NEXT_PUBLIC_ENABLE_SENTRY="$NEXT_PUBLIC_ENABLE_SENTRY"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json prisma.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma
COPY scripts ./scripts
COPY config ./config

RUN pnpm install --frozen-lockfile
RUN pnpm db:generate
RUN pnpm --filter @indihub/api build
RUN pnpm --filter @indihub/worker build
RUN pnpm --filter @indihub/web build
RUN pnpm store prune

ENTRYPOINT ["dumb-init", "--"]
```

Create `compose.production.yml`:

```bash
nano compose.production.yml
```

```yaml
name: indihub

x-indihub-app: &indihub-app
  image: indihub-app:${INDIHUB_IMAGE_TAG:-latest}
  build:
    context: .
    dockerfile: Dockerfile.production
    args:
      NEXT_PUBLIC_APP_ENV: ${NEXT_PUBLIC_APP_ENV:-production}
      NEXT_PUBLIC_WEB_URL: ${NEXT_PUBLIC_WEB_URL}
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS: ${NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS:-}
      NEXT_PUBLIC_MAP_PROVIDER: ${NEXT_PUBLIC_MAP_PROVIDER:-OSM_LEAFLET}
      NEXT_PUBLIC_MAP_TILE_URL: ${NEXT_PUBLIC_MAP_TILE_URL:-}
      NEXT_PUBLIC_MAP_ATTRIBUTION: ${NEXT_PUBLIC_MAP_ATTRIBUTION:-}
      NEXT_PUBLIC_MAPBOX_TOKEN: ${NEXT_PUBLIC_MAPBOX_TOKEN:-}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN:-}
      NEXT_PUBLIC_ENABLE_SENTRY: ${NEXT_PUBLIC_ENABLE_SENTRY:-false}
  env_file:
    - .env.production
  network_mode: host
  restart: unless-stopped
  init: true
  logging:
    driver: json-file
    options:
      max-size: "20m"
      max-file: "5"

services:
  api:
    <<: *indihub-app
    container_name: indihub-api
    command: pnpm --filter @indihub/api start
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:4000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 60s

  web:
    <<: *indihub-app
    container_name: indihub-web
    command: pnpm --filter @indihub/web exec next start --hostname 127.0.0.1 --port 3000
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -fsSI http://127.0.0.1:3000 || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 60s

  worker:
    <<: *indihub-app
    container_name: indihub-worker
    command: pnpm --filter @indihub/worker start
    depends_on:
      api:
        condition: service_healthy
```

## 13. Production Environment

Create the production env file:

```bash
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
```

Minimum required production values:

```env
NODE_ENV="production"
INDIHUB_ENV="production"
NEXT_PUBLIC_APP_ENV="production"

NEXT_PUBLIC_APP_NAME="1HandIndia"
NEXT_PUBLIC_WEB_URL="https://YOUR_DOMAIN"
NEXT_PUBLIC_API_URL="https://YOUR_DOMAIN"

API_HOST="127.0.0.1"
API_PORT="4000"
API_CORS_ORIGINS="https://YOUR_DOMAIN,https://www.YOUR_DOMAIN"
API_PUBLIC_URL="https://YOUR_DOMAIN/api"

INTERNAL_API_URL="https://YOUR_DOMAIN/api"
INTERNAL_API_SECRET="GENERATE_A_LONG_RANDOM_SECRET"

DATABASE_URL="postgresql://indihub_app:STRONG_PASSWORD@127.0.0.1:5432/indihub?schema=public"
DATABASE_DIRECT_URL="postgresql://indihub_app:STRONG_PASSWORD@127.0.0.1:5432/indihub?schema=public"

PG_APP_NAME="indihub-api"
PG_POOL_MAX="10"
PG_POOL_CONNECTION_TIMEOUT_MS="10000"
PG_POOL_IDLE_TIMEOUT_MS="60000"
PG_POOL_MAX_LIFETIME_SECONDS="900"

REDIS_URL=""

INDIHUB_FIRST_ADMIN_EMAIL="admin@YOUR_DOMAIN"
INDIHUB_FIRST_ADMIN_NAME="1HandIndia Admin"
INDIHUB_FIRST_ADMIN_PASSWORD="GENERATE_A_LONG_RANDOM_PASSWORD"
ADMIN_SESSION_TTL_HOURS="8"
INDIHUB_BOOTSTRAP_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
INDIHUB_AUTH_SYNC_SECRET="GENERATE_A_LONG_RANDOM_SECRET"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----..."
CLERK_AUTHORIZED_PARTIES="https://YOUR_DOMAIN,https://www.YOUR_DOMAIN"
CLERK_WEBHOOK_SECRET="whsec_..."

SEARCH_INDEX_WORKER_ENABLED="true"
RAZORPAY_RESERVATION_EXPIRY_WORKER_ENABLED="true"
PRIVATE_UPLOAD_CLEANUP_WORKER_ENABLED="true"

EMAIL_PROVIDER="smtp"
EMAIL_FROM_NAME="1HandIndia"
EMAIL_FROM_ADDRESS="no-reply@YOUR_DOMAIN"
EMAIL_ADMIN_RECIPIENTS="admin@YOUR_DOMAIN"

PUBLIC_IMAGE_PROVIDER="IMAGEKIT"
PUBLIC_IMAGE_BASE_URL="https://ik.imagekit.io/YOUR_ID"
NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS="https://ik.imagekit.io"

INDIHUB_PRIVATE_STORAGE_PROVIDER="AUTO"
INDIHUB_PRIVATE_UPLOAD_ROOT="storage/private"

INDIHUB_API_RATE_LIMIT_ENABLED="true"
INDIHUB_TRUST_PROXY_HEADERS="true"
```

Generate secrets:

```bash
openssl rand -base64 48
```

Important:

- `NEXT_PUBLIC_*` values are baked into the web build.
- Rebuild Docker images after changing public URLs, Clerk publishable key, image origins, map public values, or public Sentry DSN.
- Do not paste real secrets into docs, chats, screenshots, or Git.

## 14. Build Images

From `/var/www/indihub`:

```bash
docker compose --env-file .env.production -f compose.production.yml build
```

If the build fails, check:

```bash
docker compose --env-file .env.production -f compose.production.yml build --no-cache
```

Common build failure causes:

- Missing env value needed at Next.js build time.
- `pnpm-lock.yaml` not matching `package.json`.
- Sentry source-map upload misconfigured. Keep `SENTRY_AUTH_TOKEN` empty unless intentionally uploading source maps.
- Prisma schema validation failure.

## 15. Database Migration

Run migrations from a one-off API container:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm api pnpm db:generate
docker compose --env-file .env.production -f compose.production.yml run --rm api npx prisma migrate status --schema prisma/schema.prisma
docker compose --env-file .env.production -f compose.production.yml run --rm api npx prisma migrate deploy --schema prisma/schema.prisma
```

Never run this on production:

```bash
pnpm db:push
```

Seed system reference rows if required:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm api pnpm db:seed:system
```

Do not run bootstrap seed on production unless explicitly approved:

```bash
INDIHUB_ALLOW_PRODUCTION_SEED=true docker compose --env-file .env.production -f compose.production.yml run --rm api pnpm db:seed:bootstrap
```

## 16. Start Services

```bash
docker compose --env-file .env.production -f compose.production.yml up -d
docker compose -f compose.production.yml ps
```

Check logs:

```bash
docker compose -f compose.production.yml logs api --tail=100
docker compose -f compose.production.yml logs web --tail=100
docker compose -f compose.production.yml logs worker --tail=100
```

Local health checks on VPS:

```bash
curl http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3000
```

## 17. Nginx Setup

Use the repo config as the base:

```text
deploy/nginx/indihub-nextjs.conf
deploy/nginx/indihub-rate-limits.conf
```

Install site:

```bash
sudo cp deploy/nginx/indihub-nextjs.conf /etc/nginx/sites-available/indihub
sudo nano /etc/nginx/sites-available/indihub
```

Update:

```text
server_name YOUR_DOMAIN www.YOUR_DOMAIN;
ssl_certificate ...
ssl_certificate_key ...
```

For Certbot, first use a temporary HTTP-only config or comment SSL paths, then install certs.

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/indihub /etc/nginx/sites-enabled/indihub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
sudo nginx -t
sudo systemctl reload nginx
```

Public health checks:

```bash
curl -I https://YOUR_DOMAIN
curl https://YOUR_DOMAIN/api/health
```

## 18. DNS And Cloudflare

DNS records:

```text
A     @      YOUR_SERVER_IP
A     www    YOUR_SERVER_IP
```

Cloudflare recommended settings:

- SSL mode: Full strict
- Always use HTTPS: on
- HTTP/2 and HTTP/3: on
- Brotli: on
- Cache HTML: off unless rules are carefully written
- Cache `_next/static/*`: allowed
- WAF managed rules: on

Do not proxy API to a different host unless the env and CORS values are updated.

## 19. Clerk Production Setup

In Clerk Dashboard:

1. Create/select production app.
2. Add production domain.
3. Configure allowed redirect URLs:
   - `https://YOUR_DOMAIN`
   - `https://YOUR_DOMAIN/sign-in`
   - `https://YOUR_DOMAIN/sign-up`
   - `https://YOUR_DOMAIN/seller`
   - `https://YOUR_DOMAIN/b2b`
4. Copy production publishable key to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
5. Copy production secret key to `CLERK_SECRET_KEY`.
6. Copy JWT verification public key to `CLERK_JWT_KEY`.
7. Configure authorized parties:
   - `https://YOUR_DOMAIN`
   - `https://www.YOUR_DOMAIN`
8. Configure webhook secret if auth sync webhooks are enabled.

Test:

- Customer sign up.
- Customer sign in.
- Seller sign in.
- B2B sign in.
- Clerk user cannot access standalone admin routes.

## 20. Admin Bootstrap

Open:

```text
https://YOUR_DOMAIN/admin/login
```

Use:

```env
INDIHUB_FIRST_ADMIN_EMAIL
INDIHUB_FIRST_ADMIN_PASSWORD
```

After first login:

1. Create real admin users.
2. Assign roles.
3. Rotate temporary admin password if needed.
4. Keep first-admin env values secure.

Admin login does not use Clerk.

## 21. Storage Setup

Public images:

- Use ImageKit or S3-compatible public bucket.
- Set `PUBLIC_IMAGE_BASE_URL`.
- Set `NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS`.
- Rebuild web after changing image origins.

Private files:

- Prefer S3-compatible private storage for production.
- If using local fallback, back up `storage/private` with the database.

Open:

```text
/admin/storage
```

Verify:

- Public image readiness.
- Private document readiness.
- Product image upload.
- Seller logo/banner upload.
- Homepage banner upload.

## 22. Email Setup

Supported providers:

- Brevo
- Resend
- SendGrid
- SMTP

Open:

```text
/admin/email
```

Configure:

- Provider.
- Sender name.
- Sender email.
- API key or SMTP settings.
- Templates.
- Trigger enablement.

Verify:

- Sender domain is verified.
- Test email sends.
- Notification log records rendered subject/body.
- Failed email can be retried after fixing settings.
- Worker container is running.

## 23. Razorpay Setup

Open:

```text
/admin/payments
```

Configure:

- Test/live mode.
- Key ID.
- Key secret.
- Webhook secret.
- COD enablement and max order value.
- Bank transfer details if enabled.

Razorpay webhook URL:

```text
https://YOUR_DOMAIN/api/payments/razorpay/webhook
```

Verify:

- Razorpay test checkout opens.
- Captured payment marks order `PAID`.
- Failed payment does not mark order paid.
- Late failed webhook does not downgrade paid order.
- COD stays `PENDING` until admin/finance verification.
- Bank transfer stays `PENDING` until verification.

## 24. Search Setup

Current launch uses PostgreSQL search.

Keep:

```env
SEARCH_INDEX_WORKER_ENABLED="true"
REDIS_URL=""
```

After first migration and seed:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm worker pnpm search:reindex
```

Verify:

```bash
curl "https://YOUR_DOMAIN/api/search?q=test&limit=10"
```

Admin:

```text
/admin/search
```

## 25. Backup Setup

Create backup directories:

```bash
sudo mkdir -p /var/backups/indihub/postgres
sudo mkdir -p /var/backups/indihub/private-files
sudo chown -R postgres:postgres /var/backups/indihub/postgres
sudo chown -R indihub:indihub /var/backups/indihub/private-files
sudo chmod 700 /var/backups/indihub/postgres
```

Create DB backup script:

```bash
sudo nano /usr/local/bin/indihub-db-backup.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/indihub/postgres"
DATE="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/indihub-${DATE}.dump"

mkdir -p "${BACKUP_DIR}"
pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname="indihub" --file="${FILE}"
sha256sum "${FILE}" > "${FILE}.sha256"
find "${BACKUP_DIR}" -type f -name "indihub-*.dump" -mtime +14 -delete
find "${BACKUP_DIR}" -type f -name "indihub-*.sha256" -mtime +14 -delete
```

Enable:

```bash
sudo chmod +x /usr/local/bin/indihub-db-backup.sh
sudo crontab -u postgres -e
```

Cron:

```cron
30 2 * * * /usr/local/bin/indihub-db-backup.sh
```

If local private storage is used:

```bash
crontab -e
```

```cron
35 2 * * * mkdir -p /var/backups/indihub/private-files/$(date +\%Y\%m\%d-\%H\%M\%S) && rsync -a --delete /var/www/indihub/storage/private/ /var/backups/indihub/private-files/$(date +\%Y\%m\%d-\%H\%M\%S)/
```

Push backups to external storage. Local-only backups are not enough.

## 26. Restore Test

Create a test restore DB:

```bash
sudo -u postgres createdb indihub_restore_test
sudo -u postgres pg_restore -d indihub_restore_test /var/backups/indihub/postgres/BACKUP_FILE.dump
sudo -u postgres psql -d indihub_restore_test -c "SELECT COUNT(*) FROM \"User\";"
```

Then drop restore DB:

```bash
sudo -u postgres dropdb indihub_restore_test
```

Run one restore test before production launch.

## 27. Monitoring

Monitor:

```text
https://YOUR_DOMAIN
https://YOUR_DOMAIN/api/health
SSL expiry
Disk usage
RAM
CPU
PostgreSQL status
Backup freshness
Docker service health
```

Useful commands:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs api --tail=100
docker compose -f compose.production.yml logs web --tail=100
docker compose -f compose.production.yml logs worker --tail=100
sudo journalctl -u nginx -n 100 --no-pager
sudo journalctl -u postgresql -n 100 --no-pager
df -h
free -h
docker system df
```

Set Sentry if the client has an account:

```env
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_DSN="https://..."
SENTRY_ENVIRONMENT="production"
NEXT_PUBLIC_ENABLE_SENTRY="true"
```

Only set `SENTRY_AUTH_TOKEN` during controlled source-map upload builds.

## 28. Launch E2E QA

### Infrastructure

- [ ] DNS points to VPS.
- [ ] SSL works.
- [ ] Nginx proxies web.
- [ ] Nginx proxies `/api`.
- [ ] API port is not public.
- [ ] Web port is not public.
- [ ] PostgreSQL is not public.
- [ ] Docker containers restart after reboot.
- [ ] Backups run.
- [ ] Restore test completed.

### Public Storefront

- [ ] Home loads.
- [ ] Search works.
- [ ] Category page loads.
- [ ] Product detail loads.
- [ ] Store page loads.
- [ ] Cart works.
- [ ] CMS policy pages load.
- [ ] Contact/support form works.

### Customer

- [ ] Clerk sign up works.
- [ ] Clerk sign in works.
- [ ] Account dashboard opens.
- [ ] Address create/edit/default works.
- [ ] Wishlist works.
- [ ] Checkout summary is correct.
- [ ] COD order works if enabled.
- [ ] Razorpay test order works if enabled.
- [ ] Bank transfer order works if enabled.
- [ ] Order history/detail works.
- [ ] Public tracking works.
- [ ] Cancellation rules work.

### Seller

- [ ] Seller registration works.
- [ ] Pending approval page works.
- [ ] Admin approval works.
- [ ] Seller dashboard loads.
- [ ] Store profile save works.
- [ ] Product create/edit/archive works.
- [ ] Product image upload works.
- [ ] Seller order list/detail works.
- [ ] Seller delivery update works.
- [ ] Seller finance wallet/payout/statements work.

### B2B

- [ ] B2B sign up works.
- [ ] Company profile works.
- [ ] Enquiry create works.
- [ ] Seller/admin response works.
- [ ] Buyer confirmation works.
- [ ] Admin approval works.
- [ ] Finalisation works.
- [ ] Locked stages prevent invalid cancellation/response.

### Delivery

- [ ] Delivery partner login works.
- [ ] Assigned order appears.
- [ ] Delivery detail page opens.
- [ ] Progress updates work.
- [ ] Timeline updates roll up.
- [ ] COD collection record works.
- [ ] Admin/finance verification controls payment state.

### Finance

- [ ] Finance login works.
- [ ] Finance user cannot access unrelated admin pages.
- [ ] COD collections visible.
- [ ] Bank transfers visible.
- [ ] Payment verification works.
- [ ] Settlement draft works.
- [ ] Payout approve/mark-paid works.
- [ ] Ledger updates.
- [ ] Statement downloads work.

### Admin

- [ ] Standalone admin login works.
- [ ] Dashboard loads.
- [ ] Users/roles work.
- [ ] Customers work.
- [ ] Sellers/approvals work.
- [ ] Product approvals work.
- [ ] Orders work.
- [ ] CMS works.
- [ ] Locations work.
- [ ] Payments work.
- [ ] Email workspace works.
- [ ] Storage readiness works.
- [ ] Reports work.
- [ ] Audit logs record sensitive actions.

### Notifications

- [ ] Email settings enabled.
- [ ] Provider credentials valid.
- [ ] Sender domain verified.
- [ ] Templates published.
- [ ] Worker running.
- [ ] Email logs show rendered content.
- [ ] Retry works.

## 29. Release Update Procedure

For every release:

```bash
cd /var/www/indihub
git fetch origin
git checkout RELEASE_BRANCH_OR_TAG
git pull --ff-only
git rev-parse HEAD
```

Backup first:

```bash
sudo -u postgres /usr/local/bin/indihub-db-backup.sh
```

Build:

```bash
docker compose --env-file .env.production -f compose.production.yml build
```

Migrate:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm api npx prisma migrate status --schema prisma/schema.prisma
docker compose --env-file .env.production -f compose.production.yml run --rm api npx prisma migrate deploy --schema prisma/schema.prisma
```

Restart:

```bash
docker compose --env-file .env.production -f compose.production.yml up -d
```

Verify:

```bash
curl https://YOUR_DOMAIN/api/health
curl -I https://YOUR_DOMAIN
```

Smoke test:

- Public search.
- Product detail.
- Cart.
- Checkout.
- Admin login.
- Seller order page.
- Delivery order page.
- Finance dashboard.

## 30. Rollback

If app deploy fails before migration:

```bash
git checkout PREVIOUS_GOOD_COMMIT
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d
```

If migration already ran:

1. Stop app containers.
2. Restore DB backup from just before deploy.
3. Checkout previous commit.
4. Rebuild and start.

Commands:

```bash
docker compose -f compose.production.yml down
sudo -u postgres dropdb indihub
sudo -u postgres createdb indihub
sudo -u postgres pg_restore -d indihub /var/backups/indihub/postgres/BACKUP_FILE.dump
git checkout PREVIOUS_GOOD_COMMIT
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d
```

If local private storage is used, restore matching private files from the same backup timestamp.

## 31. Troubleshooting

### 31.1 502 Bad Gateway

Check:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs web --tail=100
docker compose -f compose.production.yml logs api --tail=100
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
```

Common causes:

- Container not running.
- Next.js build failed.
- API crashed because env is missing.
- Nginx points to wrong port.

### 31.2 API Health Fails

```bash
curl http://127.0.0.1:4000/api/health
docker compose -f compose.production.yml logs api --tail=200
```

Common causes:

- `DATABASE_URL` wrong.
- PostgreSQL down.
- Prisma generated client missing.
- Env secrets malformed.

### 31.3 Prisma P1001

Check:

```bash
sudo systemctl status postgresql
psql "$DATABASE_DIRECT_URL"
docker compose -f compose.production.yml logs api --tail=100
```

Fix:

- Confirm username/password/database.
- Confirm PostgreSQL is on `127.0.0.1:5432`.
- Confirm containers use `network_mode: host`.

### 31.4 Web Build Has Wrong Domain

Cause:

- `NEXT_PUBLIC_WEB_URL` or `NEXT_PUBLIC_API_URL` changed after image build.

Fix:

```bash
docker compose --env-file .env.production -f compose.production.yml build --no-cache web
docker compose --env-file .env.production -f compose.production.yml up -d web
```

### 31.5 Customer Cannot Sign In

Check:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- Clerk redirect URLs
- Production domain in Clerk

Rebuild web if publishable key changed.

### 31.6 Admin Cannot Sign In

Check:

- `INDIHUB_FIRST_ADMIN_EMAIL`
- `INDIHUB_FIRST_ADMIN_PASSWORD`
- `ADMIN_SESSION_TTL_HOURS`
- API health
- Database has admin/session rows

Admin login does not use Clerk.

### 31.7 Email Not Sending

Check:

```bash
docker compose -f compose.production.yml logs worker --tail=200
```

Then verify:

- `/admin/email` provider enabled.
- Sender domain verified.
- Template published.
- Trigger enabled.
- Notification log has error details.

### 31.8 Razorpay Stuck Pending

Check:

- Razorpay enabled in `/admin/payments`.
- Correct test/live mode.
- Key ID and key secret match mode.
- Webhook URL is `https://YOUR_DOMAIN/api/payments/razorpay/webhook`.
- Webhook secret matches dashboard.
- Payment captured in Razorpay dashboard.
- API logs have no signature error.

### 31.9 Search Empty

Run:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm worker pnpm search:reindex
curl "https://YOUR_DOMAIN/api/search?q=PRODUCT_NAME&limit=10"
```

Check:

- Product approved.
- Product active.
- Seller approved.
- Category active.
- Worker running.

### 31.10 Disk Filling

Check:

```bash
df -h
docker system df
docker image prune
docker builder prune
```

Do not delete PostgreSQL data or backup directories unless a newer verified backup exists externally.

## 32. Final Go-Live Checklist

- [ ] Release commit approved.
- [ ] Docker files added and committed.
- [ ] `.env.production` created on VPS only.
- [ ] Docker build passes.
- [ ] Migrations deployed.
- [ ] System seed completed if needed.
- [ ] Nginx and SSL working.
- [ ] Public web health passes.
- [ ] API health passes.
- [ ] Worker logs healthy.
- [ ] Admin login verified.
- [ ] Clerk production auth verified.
- [ ] Storage configured and tested.
- [ ] Email configured and tested.
- [ ] Razorpay/COD/bank transfer tested as enabled.
- [ ] Search reindex completed.
- [ ] Full E2E QA completed.
- [ ] Daily backup scheduled.
- [ ] Restore test completed.
- [ ] Monitoring enabled.
- [ ] Provider secrets stored securely.
- [ ] Operators trained on admin, seller, delivery, finance, and support workflows.

## 33. Ponytail Audit Notes

Do not add these until the product needs them:

- Kubernetes: not needed for one VPS.
- Redis: current code has no-Redis fallback and PostgreSQL workers.
- PgBouncer: add when DB connections become a measured bottleneck.
- Separate API domain: add only when same-domain routing becomes a real limitation.
- Managed log stack: add after basic uptime, Sentry, Docker logs, and Nginx logs are not enough.

The current shortest safe production path is:

```text
Docker app containers + host PostgreSQL + host Nginx + external backups.
```
