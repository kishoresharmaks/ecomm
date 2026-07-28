# 1HandIndia Docker VPS Production Deployment Runbook

**Prepared:** 27-07-2026  
**Target:** First production deployment on one Ubuntu VPS  
**Stack:** Docker Engine, Docker Compose, Nginx, Next.js web, NestJS API, worker, PostgreSQL 16  
**Primary domain pattern:** `https://YOUR_DOMAIN` with `/api` proxied to NestJS  
**Scope authority:** `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`

## 1. Purpose

This is the authoritative Docker-based VPS deployment procedure for 1HandIndia. It covers:

- VPS preparation and security.
- Docker installation.
- Production image construction.
- Docker Compose services and networking.
- PostgreSQL persistence and migrations.
- Nginx reverse proxy, WebSockets, rate limits, and TLS.
- Production environment variables.
- Private upload persistence.
- Backups and restore testing.
- Monitoring, logs, updates, and rollback.
- Final production sign-off.

Use the existing specialist documents for detailed business-flow QA, database tuning, and staging evidence:

- `docs/IndiHub_STAGING_DEPLOYMENT_AND_COMPLETE_E2E_HANDOFF.md`
- `docs/IndiHub_COMPLETE_E2E_MANUAL_QA_AND_SELLER_COMPLETION_ANALYSIS.md`
- `docs/IndiHub_PRODUCTION_DATABASE_OPERATIONS_RUNBOOK.md`
- `docs/IndiHub_B2B_ORDER_TO_CASH_V2_COMPLETE_TEST_RUNBOOK.md`
- `docs/IndiHub_GST_BROWSER_QA_CHECKLIST.md`

## 2. Production Decisions

### 2.1 Initial topology

Run these containers on one VPS:

| Service | Responsibility | Public port |
|---|---|---:|
| `nginx` | TLS termination, reverse proxy, WebSocket proxy, rate limits | `80`, `443` |
| `web` | Next.js storefront and all web portals | None |
| `api` | NestJS API and Socket.IO | None |
| `worker` | Search, reports, notifications, B2B, returns, routing, and maintenance jobs | None |
| `db` | PostgreSQL primary database | None |
| `certbot` | One-shot certificate issue and renewal | None |

Only Nginx publishes application ports. PostgreSQL, web, API, and worker remain private inside Docker networks.

### 2.2 Redis decision

Keep `REDIS_URL` empty for the first production launch.

The application already supports PostgreSQL polling, synchronous execution, and local fallbacks when Redis is unavailable. Adding Redis before measured queue or cache pressure creates another stateful service without being required for correctness.

Add Redis later only when one of these is measured:

- Email or background-job throughput exceeds PostgreSQL polling capacity.
- Multiple API/worker replicas require shared rate-limit or queue state.
- Safe read-heavy API caching produces a demonstrated database benefit.

### 2.3 Server baseline

Recommended production VPS:

- Ubuntu 24.04 LTS.
- 8 vCPU.
- 16 GB RAM.
- 200 GB or larger NVMe storage.
- Provider snapshots enabled.
- A second off-server backup destination.

Minimum staging or low-traffic launch testing:

- 4 vCPU.
- 8 GB RAM.
- 8 GB swap because Docker image builds can temporarily require more memory.
- 120 GB NVMe storage.

Do not place PostgreSQL data on slow network or HDD storage.

## 3. Required Domain and Accounts

Prepare before touching the server:

- Main domain, for example `1handindia.com`.
- Optional `www` domain redirect.
- VPS public IPv4 address.
- Production Clerk application.
- Razorpay production or test credentials.
- Email provider account.
- Public image and private document storage credentials when using managed storage.
- Sentry project if error monitoring is enabled.
- Off-server backup destination.

DNS records:

| Type | Host | Value |
|---|---|---|
| `A` | `@` | VPS IPv4 |
| `A` | `www` | VPS IPv4 |

Wait until both names resolve before requesting certificates.

## 4. Required Repository Deployment Files

Create these files in the repository before the first deployment:

```text
Dockerfile.production
.dockerignore
docker-compose.production.yml
deploy/nginx/nginx.conf
deploy/nginx/conf.d/indihub.bootstrap.conf
deploy/nginx/indihub.production.conf
deploy/postgres/postgresql.conf
deploy/scripts/backup-production.sh
deploy/scripts/restore-production.sh
```

Do not commit production `.env` files, certificate files, database dumps, private uploads, or provider credentials.

## 5. Production Dockerfile

Create `Dockerfile.production`:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true

RUN corepack enable \
  && corepack prepare pnpm@10.20.0 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile

RUN --mount=type=secret,id=web_build_env,target=/app/.env,required=true \
  pnpm db:generate \
  && pnpm --filter @indihub/api build \
  && pnpm --filter @indihub/worker build \
  && pnpm --filter @indihub/web build

FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

RUN corepack enable \
  && corepack prepare pnpm@10.20.0 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build --chown=node:node /app /app

RUN mkdir -p /app/storage/private \
  && chown -R node:node /app/storage/private

USER node

CMD ["node", "apps/api/dist/main.js"]
```

This intentionally creates one tested application image used by web, API, and worker. Separate optimized images can be introduced only when image size or deployment speed becomes an actual operational problem.

## 6. Docker Ignore Rules

Create `.dockerignore`:

```text
.git
.github
.next
**/.next
**/dist
**/coverage
**/node_modules
node_modules
.turbo
.tmp
tmp
storage/private
backups
*.log
.env
.env.*
!.env.example
auth.json
*.pem
*.key
*.jks
*.keystore
google-services.json
```

## 7. PostgreSQL Starting Configuration

Create `deploy/postgres/postgresql.conf` for a 16 GB single-VPS starting point:

```conf
listen_addresses = '*'
max_connections = 120
shared_buffers = 3GB
effective_cache_size = 9GB
maintenance_work_mem = 512MB
work_mem = 8MB
wal_compression = on
checkpoint_completion_target = 0.9
min_wal_size = 1GB
max_wal_size = 4GB
random_page_cost = 1.1
effective_io_concurrency = 200
log_min_duration_statement = 1000
log_checkpoints = on
log_lock_waits = on
log_temp_files = 10MB
timezone = 'UTC'
```

Do not copy this unchanged to a smaller server. For an 8 GB server, start with `shared_buffers = 1GB`, `effective_cache_size = 4GB`, and `maintenance_work_mem = 256MB`.

## 8. Nginx Base Configuration

Create `deploy/nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'request_time=$request_time upstream_time=$upstream_response_time';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    server_tokens off;
    client_max_body_size 16m;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    limit_req_zone $binary_remote_addr zone=public_api:20m rate=20r/s;
    limit_req_zone $binary_remote_addr zone=sensitive_api:20m rate=5r/s;
    limit_conn_zone $binary_remote_addr zone=per_ip:20m;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
}
```

## 9. Bootstrap Nginx Configuration

Create `deploy/nginx/conf.d/indihub.bootstrap.conf` and replace `YOUR_DOMAIN`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 '1HandIndia TLS bootstrap ready';
        add_header Content-Type text/plain;
    }
}
```

Only the bootstrap configuration should end in `.conf` before the first certificate is issued. Keep the production configuration outside `conf.d` until Section 18.

## 10. Production Nginx Configuration

Create `deploy/nginx/indihub.production.conf` and replace `YOUR_DOMAIN`:

```nginx
upstream indihub_web {
    server web:3000;
    keepalive 32;
}

upstream indihub_api {
    server api:4000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://YOUR_DOMAIN$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name www.YOUR_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;

    return 301 https://YOUR_DOMAIN$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name YOUR_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:TLS:10m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location = /api/health {
        proxy_pass http://indihub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/api/(docs|openapi\.(json|yaml)) {
        deny all;
    }

    location = /api/payments/razorpay/webhook {
        limit_req zone=public_api burst=120 nodelay;
        proxy_pass http://indihub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /api/webhooks/couriers/ {
        limit_req zone=public_api burst=120 nodelay;
        proxy_pass http://indihub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location ~ ^/api/(checkout|orders|payments|admin|finance) {
        limit_req zone=sensitive_api burst=30 nodelay;
        limit_conn per_ip 30;
        proxy_pass http://indihub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 120s;
    }

    location /api/ {
        limit_req zone=public_api burst=60 nodelay;
        limit_conn per_ip 60;
        proxy_pass http://indihub_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 120s;
    }

    location /socket.io/ {
        proxy_pass http://indihub_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 65s;
    }

    location /_next/static/ {
        proxy_pass http://indihub_web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://indihub_web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 120s;
    }
}
```

If Razorpay or another provider retries legitimate webhook bursts above this limit, create a dedicated signed-webhook location with a measured provider-safe rate instead of disabling rate limiting globally.

## 11. Docker Compose Production Stack

Create `docker-compose.production.yml`:

```yaml
name: indihub-production

services:
  db:
    image: postgres:16-bookworm
    restart: unless-stopped
    stop_grace_period: 60s
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./deploy/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    shm_size: 1gb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    networks:
      - backend
    logging: &logging
      driver: local
      options:
        max-size: 20m
        max-file: "5"

  web:
    image: indihub-app:${RELEASE_TAG}
    build:
      context: .
      dockerfile: Dockerfile.production
      secrets:
        - web_build_env
    restart: unless-stopped
    init: true
    working_dir: /app/apps/web
    command: ["node", "node_modules/next/dist/bin/next", "start", "--port", "3000", "--hostname", "0.0.0.0"]
    env_file:
      - ./env/web.runtime.env
    environment:
      NODE_ENV: production
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "--fail", "--silent", "http://127.0.0.1:3000/robots.txt"]
      interval: 20s
      timeout: 5s
      retries: 10
      start_period: 45s
    networks:
      - backend
    logging: *logging

  api:
    image: indihub-app:${RELEASE_TAG}
    restart: unless-stopped
    init: true
    command: ["node", "apps/api/dist/main.js"]
    env_file:
      - ./env/api.env
    environment:
      NODE_ENV: production
      API_HOST: 0.0.0.0
      API_PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      DATABASE_DIRECT_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      REDIS_URL: ""
    volumes:
      - private_uploads:/app/storage/private
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "--fail", "--silent", "http://127.0.0.1:4000/api/health"]
      interval: 20s
      timeout: 5s
      retries: 10
      start_period: 45s
    networks:
      - backend
    logging: *logging

  worker:
    image: indihub-app:${RELEASE_TAG}
    restart: unless-stopped
    init: true
    command: ["node", "apps/worker/dist/index.js"]
    env_file:
      - ./env/worker.env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      DATABASE_DIRECT_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
      REDIS_URL: ""
      WORKER_KEEP_ALIVE: "true"
    volumes:
      - private_uploads:/app/storage/private
    depends_on:
      db:
        condition: service_healthy
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "kill -0 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks:
      - backend
    logging: *logging

  nginx:
    image: nginx:stable-alpine
    restart: unless-stopped
    depends_on:
      web:
        condition: service_healthy
      api:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deploy/nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot_www:/var/www/certbot:ro
      - letsencrypt:/etc/letsencrypt:ro
    networks:
      - edge
      - backend
    logging: *logging

  certbot:
    image: certbot/certbot:latest
    profiles: ["maintenance"]
    volumes:
      - certbot_www:/var/www/certbot
      - letsencrypt:/etc/letsencrypt

networks:
  edge:
  backend:

volumes:
  postgres_data:
  private_uploads:
  certbot_www:
  letsencrypt:

secrets:
  web_build_env:
    file: ./env/web.build.env
```

Before production, resolve each image to a tested immutable digest and record it in the release evidence. Do not use an unreviewed floating image update during a release.

## 12. Production Environment Files

Create this server-only structure:

```text
/opt/indihub/
  .env.production.compose
  env/
    web.build.env
    web.runtime.env
    api.env
    worker.env
```

Permissions:

```bash
sudo chown -R "$USER":"$USER" /opt/indihub
chmod 700 /opt/indihub/env
chmod 600 /opt/indihub/.env.production.compose /opt/indihub/env/*.env
```

### 12.1 Compose interpolation file

Create `.env.production.compose`:

```dotenv
RELEASE_TAG=REPLACE_WITH_COMMIT_SHA
POSTGRES_DB=indihub
POSTGRES_USER=indihub_app
POSTGRES_PASSWORD=REPLACE_WITH_OPENSSL_HEX_SECRET
```

Generate the password without shell-special characters:

```bash
openssl rand -hex 32
```

### 12.2 Web build environment

Create `env/web.build.env`. Include browser-public values plus non-secret dummy database URLs required only for Prisma client generation during the image build:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
DATABASE_DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_NAME=1HandIndia
NEXT_PUBLIC_WEB_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_API_TIMEOUT_MS=30000
NEXT_PUBLIC_INDIHUB_ENABLE_LOCAL_AUTH=false
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=REPLACE
NEXT_PUBLIC_CLERK_FRONTEND_API=
NEXT_PUBLIC_MAP_PROVIDER=osm
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_ATTRIBUTION=OpenStreetMap contributors
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_ENABLE_SENTRY=true
NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_GOOGLE_ADS_ID=
NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN=
NEXT_PUBLIC_CSP_CONNECT_SRC=
NEXT_PUBLIC_CSP_IMG_SRC=
NEXT_PUBLIC_CSP_FRAME_SRC=
```

`NEXT_PUBLIC_*` values are embedded into the browser bundle. The build database URLs are placeholders and are never contacted by `prisma generate`. Never put production database or provider credentials in this file.

### 12.3 Web runtime environment

Create `env/web.runtime.env` with the same `NEXT_PUBLIC_*` runtime values as `web.build.env`, then add the server-only Clerk key required by Next.js proxy and seller route protection:

```dotenv
NODE_ENV=production
CLERK_SECRET_KEY=REPLACE
INDIHUB_ALLOW_LOCAL_API_BUILD_FETCH=false
SENTRY_ORG=
SENTRY_PROJECT=
```

Do not add database, Razorpay, email-provider, storage-provider, admin-password, or worker secrets to the web container.

### 12.4 API environment

Start from `.env.example` and include the production values required by enabled features. At minimum:

```dotenv
NODE_ENV=production
INDIHUB_ENV=production
INDIHUB_PRODUCTION=true
INDIHUB_STAGING=false
INDIHUB_PREPRODUCTION=false
INDIHUB_ALLOW_DEV_AUTH=false
NEXT_PUBLIC_WEB_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN
API_PUBLIC_URL=https://YOUR_DOMAIN
API_PUBLIC_HOST=YOUR_DOMAIN
API_CORS_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
CLERK_AUTHORIZED_PARTIES=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
INDIHUB_TRUST_PROXY_HEADERS=true

INTERNAL_API_URL=http://api:4000
INTERNAL_API_SECRET=REPLACE_WITH_64_HEX_CHAR_SECRET
INDIHUB_AUTH_SYNC_SECRET=REPLACE
INDIHUB_BOOTSTRAP_SECRET=REPLACE

INDIHUB_FIRST_ADMIN_EMAIL=admin@YOUR_DOMAIN
INDIHUB_FIRST_ADMIN_NAME=Production Administrator
INDIHUB_FIRST_ADMIN_PASSWORD=REPLACE_WITH_LONG_UNIQUE_PASSWORD
ADMIN_SESSION_TTL_HOURS=12

CLERK_SECRET_KEY=REPLACE
CLERK_WEBHOOK_SECRET=REPLACE
CLERK_JWT_KEY=

REDIS_URL=

EMAIL_PROVIDER=brevo
EMAIL_FROM_NAME=1HandIndia
EMAIL_FROM_ADDRESS=no-reply@YOUR_DOMAIN
EMAIL_ADMIN_RECIPIENTS=admin@YOUR_DOMAIN
BREVO_API_KEY=REPLACE_IF_USED
RESEND_API_KEY=
SENDGRID_API_KEY=
SMTP_BRIDGE_URL=

RAZORPAY_KEY_ID=REPLACE
RAZORPAY_KEY_SECRET=REPLACE
RAZORPAY_WEBHOOK_SECRET=REPLACE

FX_PROVIDER=frankfurter
FX_BASE_CURRENCY=INR
FX_CACHE_TTL_MINUTES=360
FX_CREDENTIAL_ENCRYPTION_KEY=REPLACE_WITH_32_PLUS_CHAR_SECRET

SELLER_PAYOUT_DATA_ENCRYPTION_KEY=REPLACE_WITH_32_PLUS_CHAR_SECRET
B2B_ERP_CREDENTIAL_ENCRYPTION_KEY=REPLACE_WITH_32_PLUS_CHAR_SECRET

INDIHUB_PRIVATE_STORAGE_PROVIDER=local
PRIVATE_STORAGE_PROVIDER=local
INDIHUB_PRIVATE_UPLOAD_ROOT=/app/storage/private

LOG_LEVEL=info
```

Add ImageKit, S3-compatible storage, Mapbox, GST, Razorpay, email, and other provider values only when that provider is selected and configured.

### 12.5 Worker environment

Create `env/worker.env` with:

- The same internal API secret and encryption keys used by the API.
- The same email and storage provider credentials needed by worker jobs.
- `INTERNAL_API_URL=http://api:4000`.
- `NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN` where required by generated links.
- Worker enable flags and batch/poll intervals from `.env.example`.
- `REDIS_URL=` and `WORKER_KEEP_ALIVE=true`.

Enable only reviewed workers. Every enabled worker must have a tested retry, idempotency, and no-Redis behavior.

## 13. VPS Initial Security Setup

Log in using the provider console or the temporary root account.

Create an operator account:

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

After confirming key-based login as `deploy`, update `/etc/ssh/sshd_config.d/99-indihub.conf`:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Validate and reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

Never disable the current working SSH session before a second key-authenticated session succeeds.

Install baseline packages:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git openssl ufw fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban
```

Firewall:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Docker-published ports can bypass normal UFW expectations. This stack publishes only `80` and `443`; never add host mappings for `3000`, `4000`, or `5432`.

Enable automatic security updates:

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Set timezone to UTC:

```bash
sudo timedatectl set-timezone UTC
timedatectl
```

If the VPS has less than 16 GB RAM, add an 8 GB swap file before building images:

```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-indihub-swap.conf
free -h
```

Swap protects builds from abrupt out-of-memory termination; it is not a substitute for adequate production RAM.

## 14. Install Docker Engine and Compose

Use Docker's official Ubuntu repository, not an unofficial convenience package.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"${UBUNTU_CODENAME:-$VERSION_CODENAME}\") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

Docker group membership grants root-equivalent control. For the smallest secure setup, keep production Docker commands behind `sudo` instead of adding every operator to the `docker` group.

Configure daemon log rotation in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  },
  "live-restore": true
}
```

Validate and restart:

```bash
sudo dockerd --validate --config-file=/etc/docker/daemon.json
sudo systemctl restart docker
```

## 15. Prepare Application Directory

```bash
sudo mkdir -p /opt/indihub
sudo chown deploy:deploy /opt/indihub
cd /opt/indihub
git clone YOUR_REPOSITORY_URL .
git fetch --all --tags
git checkout YOUR_REVIEWED_RELEASE_COMMIT
mkdir -p env deploy/nginx/conf.d backups scripts
```

Confirm the release:

```bash
git status --short
git rev-parse HEAD
git diff --check
```

Expected:

- Clean workspace.
- Exact reviewed commit.
- No `.env`, `auth.json`, private key, certificate, or backup file tracked.

## 16. Validate Configuration Before Build

```bash
cd /opt/indihub
chmod 600 .env.production.compose env/*.env

sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  config > /tmp/indihub-compose.rendered.yml
```

Review the rendered service names, images, mounts, and ports. Do not paste the rendered file into tickets because it contains resolved secrets.

Confirm only Nginx publishes ports:

```bash
grep -nE '3000:|4000:|5432:' /tmp/indihub-compose.rendered.yml
```

Expected: no output.

Delete the rendered secret-bearing file:

```bash
rm -f /tmp/indihub-compose.rendered.yml
```

## 17. Build the Application Image

```bash
cd /opt/indihub
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  build --pull web
```

The build must complete:

- Prisma generation.
- API production bundle.
- Worker production bundle.
- Next.js production build.

Record the image:

```bash
sudo docker image inspect "indihub-app:$(grep '^RELEASE_TAG=' .env.production.compose | cut -d= -f2)" \
  --format '{{.Id}} {{.Created}}'
```

## 18. Bootstrap TLS

Start PostgreSQL first:

```bash
cd /opt/indihub
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  up -d db
```

Wait for PostgreSQL and apply committed migrations before starting the API:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  run --rm api \
  pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

Start the application and bootstrap Nginx:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  up -d api worker web nginx
```

Confirm HTTP bootstrap:

```bash
curl -i http://YOUR_DOMAIN/
```

Issue the certificate:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  --profile maintenance run --rm certbot \
  certonly --webroot \
  --webroot-path /var/www/certbot \
  --email ADMIN_EMAIL \
  --agree-tos \
  --no-eff-email \
  -d YOUR_DOMAIN \
  -d www.YOUR_DOMAIN
```

Activate production Nginx configuration:

```bash
mv deploy/nginx/conf.d/indihub.bootstrap.conf deploy/nginx/indihub.bootstrap.conf.disabled
cp deploy/nginx/indihub.production.conf deploy/nginx/conf.d/indihub.conf

sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  exec -T nginx nginx -t

sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  restart nginx
```

Verify:

```bash
curl -I https://YOUR_DOMAIN
curl --fail https://YOUR_DOMAIN/api/health
```

Certificate renewal cron:

```bash
sudo crontab -e
```

Add:

```cron
17 3 * * * cd /opt/indihub && docker compose --env-file .env.production.compose -f docker-compose.production.yml --profile maintenance run --rm certbot renew --quiet && docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T nginx nginx -s reload
```

Test renewal without changing certificates:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  --profile maintenance run --rm certbot renew --dry-run
```

## 19. Database Migration Rules and Verification

Do not use `prisma db push` in staging or production.

The first production migration is applied before API startup in Section 18. Repeat the following procedure for every later release before replacing the running application containers.

Before migration:

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml ps
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Apply committed migrations:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  run --rm api \
  pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

Check migration status:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  run --rm api \
  pnpm exec prisma migrate status --schema prisma/schema.prisma
```

If a migration fails, stop. Follow the migration-specific recovery procedure in `docs/IndiHub_STAGING_DEPLOYMENT_AND_COMPLETE_E2E_HANDOFF.md`. Never mark a failed migration applied merely to make deployment continue.

Restart application services after migrations:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  up -d --force-recreate api worker web nginx
```

## 20. First Admin and Reference Data

`pnpm db:seed` is schema-only and writes no application data by default.

For approved initial RBAC reference setup only:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  run --rm api pnpm db:seed:system
```

Do not run bootstrap seed mode in production unless the exact operation is approved and `INDIHUB_ALLOW_PRODUCTION_SEED=true` is intentionally set for that one operation.

Use the configured `INDIHUB_FIRST_ADMIN_EMAIL` and `INDIHUB_FIRST_ADMIN_PASSWORD` for first standalone admin setup, verify access, and rotate the initial password through the admin credential workflow.

After the database-backed admin credential is verified:

1. Remove `INDIHUB_FIRST_ADMIN_PASSWORD` from `env/api.env`.
2. Remove `INDIHUB_FIRST_ADMIN_EMAIL` and `INDIHUB_FIRST_ADMIN_NAME` unless an approved disaster-recovery procedure explicitly requires them.
3. Recreate the API container.
4. Confirm the rotated database-backed credential still signs in.

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  up -d --no-deps --force-recreate api
```

Do not leave the bootstrap password as a permanent production login fallback.

## 21. Private Upload Storage

The Compose stack mounts the `private_uploads` volume at `/app/storage/private` in API and worker containers.

Rules:

- Never publish this volume through Nginx.
- Downloads must continue through authenticated API endpoints.
- Back up the volume with the database when local private storage is enabled.
- Prefer managed private S3-compatible storage before multiple VPS replicas are introduced.
- Public images should use the configured managed public image provider for production durability.

Verify permissions:

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T api \
  sh -lc 'test -w /app/storage/private && echo writable'
```

Expected: `writable`.

## 22. Production Backup Script

Create `deploy/scripts/backup-production.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /opt/indihub
set -a
source .env.production.compose
set +a

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="/opt/indihub/backups/${timestamp}"
mkdir -p "$target"
chmod 700 "$target"

docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$target/database.dump"

docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  pg_dumpall -U "$POSTGRES_USER" --globals-only > "$target/globals.sql"

docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T api \
  tar -C /app/storage -czf - private > "$target/private-uploads.tar.gz"

sha256sum "$target"/* > "$target/SHA256SUMS"

find /opt/indihub/backups -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -mtime +7 -exec rm -rf -- {} +

echo "Backup created: $target"
```

Install:

```bash
chmod 700 deploy/scripts/backup-production.sh
sudo ln -sfn /opt/indihub/deploy/scripts/backup-production.sh /usr/local/sbin/indihub-backup
```

Schedule daily:

```cron
35 1 * * * /usr/local/sbin/indihub-backup >> /var/log/indihub-backup.log 2>&1
```

A backup stored only on the production VPS is not a production backup. Copy each completed backup to encrypted object storage, a second server, or a provider-managed backup system. Keep at least:

- 7 daily copies.
- 4 weekly copies.
- 6 monthly copies.

Also enable VPS provider snapshots, but do not treat snapshots as the only database backup.

## 23. Restore Procedure

Restore only during an approved maintenance window and only after preserving the current state.

Create `deploy/scripts/restore-production.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/backup-directory" >&2
  exit 1
fi

if [[ "${INDIHUB_CONFIRM_RESTORE:-}" != "RESTORE_PRODUCTION" ]]; then
  echo "Set INDIHUB_CONFIRM_RESTORE=RESTORE_PRODUCTION for an approved restore." >&2
  exit 1
fi

backup="$(realpath "$1")"
case "$backup" in
  /opt/indihub/backups/*) ;;
  *)
    echo "Backup must be inside /opt/indihub/backups." >&2
    exit 1
    ;;
esac

cd /opt/indihub
set -a
source .env.production.compose
set +a

test -f "$backup/database.dump"
test -f "$backup/private-uploads.tar.gz"
(cd "$backup" && sha256sum -c SHA256SUMS)

docker compose --env-file .env.production.compose -f docker-compose.production.yml stop nginx web worker api

docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"

docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$backup/database.dump"

docker compose --env-file .env.production.compose -f docker-compose.production.yml run --rm api \
  sh -lc 'find /app/storage/private -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /app/storage -xzf -' < "$backup/private-uploads.tar.gz"

docker compose --env-file .env.production.compose -f docker-compose.production.yml up -d api worker web nginx
```

Run restore tests on a disposable VPS or disposable database at least monthly. Never discover that a backup is unusable during an incident.

## 24. Monitoring and Logs

Minimum checks:

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml ps
sudo docker stats --no-stream
curl --fail https://YOUR_DOMAIN/api/health
curl --fail --head https://YOUR_DOMAIN
df -h
free -h
```

Service logs:

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=200 nginx
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=200 web
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=200 api
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=200 worker
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=200 db
```

Configure external uptime checks for:

- `https://YOUR_DOMAIN/`
- `https://YOUR_DOMAIN/api/health`

Configure Sentry for web, API, and worker errors if approved. Alerts must not include passwords, bearer tokens, provider secrets, complete payment data, or private document content.

Operational alert thresholds for the first VPS:

- Disk above 75% warning and 85% critical.
- Memory above 85% for 10 minutes.
- PostgreSQL unavailable.
- API health failure for two consecutive checks.
- Repeated container restart.
- Backup older than 26 hours.
- TLS certificate expiry under 21 days.

## 25. Deployment Update Procedure

Never update production from a dirty workspace.

```bash
cd /opt/indihub

sudo /usr/local/sbin/indihub-backup

git fetch --all --tags
git checkout NEW_REVIEWED_COMMIT
git status --short
git rev-parse HEAD
```

Update `RELEASE_TAG` in `.env.production.compose` to the exact commit SHA.

Build without replacing running containers:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  build --pull web
```

Apply migrations:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  run --rm api \
  pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

Replace application containers:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  up -d --no-deps --force-recreate api worker web

sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  exec -T nginx nginx -t
```

Smoke test immediately:

```bash
curl --fail https://YOUR_DOMAIN/api/health
curl --fail --head https://YOUR_DOMAIN
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml ps
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --since=10m api worker web
```

Keep the previous application image until the new release is signed off.

## 26. Rollback

### 26.1 Application-only rollback

If the new migration is backward compatible:

1. Set `RELEASE_TAG` back to the previous image tag.
2. Run:

```bash
sudo docker compose \
  --env-file .env.production.compose \
  -f docker-compose.production.yml \
  up -d --no-deps --force-recreate api worker web
```

3. Run health and portal smoke tests.

### 26.2 Database rollback

Do not automatically reverse Prisma migrations.

If the database must be rolled back:

1. Enter maintenance mode or stop Nginx/web/API/worker.
2. Preserve a fresh incident backup.
3. Restore the approved pre-deployment backup.
4. Restore matching private uploads when local storage is used.
5. Start the previous application image.
6. Reconcile payment, order, payout, and webhook events received during the incident window.

## 27. Production Security Checklist

- [ ] SSH root login disabled.
- [ ] SSH password login disabled.
- [ ] UFW exposes only SSH, HTTP, and HTTPS.
- [ ] No Docker host ports for web, API, PostgreSQL, or worker.
- [ ] Docker access limited to trusted administrators.
- [ ] `.env` files owned by the deployment operator and mode `600`.
- [ ] No `.env`, `auth.json`, key, certificate, or private document committed.
- [ ] Local development auth disabled.
- [ ] Production Clerk allowed origins configured.
- [ ] CORS restricted to production domains.
- [ ] `INDIHUB_TRUST_PROXY_HEADERS=true` only while API remains private behind Nginx.
- [ ] Swagger/OpenAPI blocked publicly or restricted to approved administrator IPs.
- [ ] Razorpay webhook signature verification enabled.
- [ ] Provider secrets rotated if ever exposed.
- [ ] Private uploads inaccessible except through authenticated API downloads.
- [ ] Admin, finance, courier, support, seller, B2B, delivery, and customer permissions tested separately.
- [ ] Backup restore test recorded.
- [ ] Security updates and fail2ban enabled.
- [ ] Docker and base images reviewed and pinned to tested digests.

## 28. Complete Launch Smoke Matrix

Test each route with the correct separate account:

| Surface | Route | Required result |
|---|---|---|
| Storefront | `/` | Homepage, navigation, search, CMS content |
| Customer auth | `/sign-in`, `/sign-up` | Clerk production flow and redirects |
| Customer | `/account/orders` | Customer-only orders |
| Checkout | `/checkout` | Server-priced totals and enabled payments |
| Seller Hub | `/seller` | Seller-specific navigation and data |
| Seller products | `/seller/products` | Seller ownership enforcement |
| Seller finance | `/seller/finance/wallet` | Seller-only balances and statements |
| B2B buyer | `/b2b/orders` | Buyer-owned orders and documents |
| Delivery | `/delivery/orders` | Assigned orders only |
| Courier | `/courier/packages` | Courier-role package operations |
| Finance | `/finance` | Finance-only operations |
| Admin | `/admin` | Standalone admin login and controls |
| GST | `/admin/finance/gst-reports` | Tax reports and protected downloads |
| API health | `/api/health` | HTTP 200 JSON response |

Also test:

- Razorpay test payment and signed webhook.
- COD collection and finance verification.
- Bank-transfer proof and verification.
- Seller order fulfilment and timeline rollup.
- Return, reverse pickup, refund, and finance reconciliation.
- B2B enquiry, quotation, PO, order, payment, shipment, invoice, dispute, and reconciliation.
- Transactional email generation, worker delivery, failure, and retry.
- Authenticated PDF/CSV/private-document downloads.
- Mobile widths, keyboard navigation, loading, empty, error, and long-text states.
- Worker operation with `REDIS_URL` empty.

Production promotion remains blocked until the sign-off list in `docs/IndiHub_STAGING_DEPLOYMENT_AND_COMPLETE_E2E_HANDOFF.md` is complete.

## 29. Troubleshooting

### Container repeatedly restarts

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml ps
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=300 SERVICE
```

Check missing environment values, database health, volume permissions, and migration status before changing code.

### Nginx returns 502

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T nginx nginx -t
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T nginx wget -qO- http://api:4000/api/health
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T nginx wget -qO- http://web:3000/robots.txt
```

### Database is unhealthy

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=300 db
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T db \
  sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
df -h
```

### Migration fails

- Stop deployment.
- Do not run `db push`.
- Do not mark the migration applied without verifying every statement.
- Preserve the database and logs.
- Follow the migration-specific recovery runbook.

### Private upload fails

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml exec -T api \
  sh -lc 'id && ls -ld /app/storage/private && test -w /app/storage/private'
```

### Worker appears idle

```bash
sudo docker compose --env-file .env.production.compose -f docker-compose.production.yml logs --tail=300 worker
```

Confirm enabled worker flags, polling intervals, internal API URL, internal secret, database connection, and expected pending records.

## 30. Scaling Triggers

Do not add infrastructure because a marketplace might become large. Add it when metrics justify it.

| Trigger | Next change |
|---|---|
| Database CPU or storage latency remains high after query/index tuning | Move PostgreSQL to a dedicated server or managed service |
| Web/API CPU saturation | Add replicas behind Nginx after session and worker behavior are verified |
| Background backlog grows continuously | Add Redis/BullMQ and additional worker replicas |
| Safe read traffic dominates database load | Add Redis response caching with explicit invalidation and fallback |
| Local private uploads block horizontal scaling | Move private documents to managed S3-compatible storage |
| Reporting queries affect transactions | Add read-optimized reporting infrastructure or materialized views |
| Proven read pressure | Add a read replica only for explicitly safe read paths |

Order-table partitioning is not a first-launch task.

## 31. Final Production Handoff

Record:

| Item | Value |
|---|---|
| Production commit SHA |  |
| Application image ID |  |
| PostgreSQL image digest |  |
| Nginx image digest |  |
| Deployment date/time UTC |  |
| Operator |  |
| Reviewer |  |
| Database migration status |  |
| Backup reference |  |
| Restore-test reference |  |
| TLS expiry date |  |
| Provider configuration evidence |  |
| E2E evidence location |  |
| Finance sign-off |  |
| GST sign-off |  |
| Product owner approval |  |

Do not mark production complete until every required field and launch blocker has evidence.
