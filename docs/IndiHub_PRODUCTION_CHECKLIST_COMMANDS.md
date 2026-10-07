# 1HandIndia Production Deployment & Verification Commands Checklist

> **Target Platform:** 1HandIndia Multi-Vendor Marketplace  
> **Repository:** `kishoresharmaks/ecomm`  
> **Target Production Topology:** Ubuntu 24.04 LTS VPS, Docker Engine, Docker Compose, Nginx, Next.js 16 Web, NestJS API, Background Worker, PostgreSQL 16  
> **Scope Governance:** `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`

---

## Quick Reference Summary

| Phase | Purpose | Workstation / CI | Production Host |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Pre-Release Quality Gates | `pnpm run architecture:baseline:verify`<br>`pnpm test`<br>`pnpm run build` | — |
| **Phase 2** | Database Migrations & Hygiene | `pnpm db:migrations:check`<br>`pnpm db:baseline:check` | `prisma migrate deploy` |
| **Phase 3** | Environment & Secrets Gate | Env validation scripts | Secure `.env.production` |
| **Phase 4** | Docker Build & Service Bootstrap | — | `docker compose -f docker-compose.prod.yml up -d --build` |
| **Phase 5** | Live Health & Smoke Testing | Curl / HTTP checks | Monitoring & Log verification |
| **Phase 6** | System & Reference Seeding | — | `pnpm db:seed:system`<br>`pnpm locations:import:india` |
| **Phase 7** | Backups & Emergency Rollback | — | `pg_dump` & Container rollback |

---

## Phase 1: Pre-Release Quality Gates (Run on Workstation or CI)

Run these checks offline before creating release tags or deploying to VPS. All commands must exit with code `0`.

### 1.1 Fast Monorepo Schema & Type Validation
```powershell
# Validate Prisma schema syntax and model definitions
pnpm.cmd db:validate

# Generate Prisma Client bindings
pnpm.cmd run db:generate

# Typecheck all monorepo packages (Database, Web, API, Worker, Config)
$env:NODE_OPTIONS="--max-old-space-size=8192"
pnpm.cmd run typecheck
```

### 1.2 Architecture Boundary & Contract Compliance
```powershell
# Verify Bounded Context Architecture (strictly zero growing boundary debt)
pnpm.cmd run architecture:baseline:verify

# Verify OpenAPI Contract against locked schema (zero breaking API mutations)
pnpm.cmd run api:contract:check
```

### 1.3 Static Linting & Code Hygiene
```powershell
# Lint all applications and shared packages
pnpm.cmd run lint
```

### 1.4 Automated Unit & Regression Test Suites
```powershell
# Run all unit tests across monorepo (550+ tests in API, 220+ in Web, Database tests)
pnpm.cmd run test
```

> [!NOTE]
> Backend integration tests requiring an active database can be executed separately on a dedicated test DB:
> ```powershell
> $env:INDIHUB_ALLOW_INTEGRATION_TEST_DB="true"
> pnpm.cmd test:integration:api
> ```

### 1.5 Full Monorepo Production Build Test
```powershell
# Verify full production build passes (Next.js SSG/SSR pages, NestJS dist, Worker)
pnpm.cmd run build
```

---

## Phase 2: Database Migration & Schema Hygiene

Ensures database migrations apply cleanly, deterministic schemas match baseline SQL, and data integrity constraints are honored.

### 2.1 Pre-Deploy Migration Verification
```powershell
# Verify migration timestamps, sequential ordering, and baseline manifest
pnpm.cmd run db:migrations:check

# Verify complete production schema SQL alignment
pnpm.cmd run db:baseline:check
```

### 2.2 Applying Migrations on Production (Linux VPS)
On the target production server, execute migrations using `prisma migrate deploy` (never use `db push` on production databases):

```bash
# Inside docker container or with production DATABASE_URL exported:
pnpm prisma migrate deploy --schema prisma/schema.prisma
```

> [!CAUTION]
> **Never run `prisma db push` on production.** `db push` can silently drop columns or alter table structures without historical tracking. Use strictly `prisma migrate deploy`.

---

## Phase 3: Production Environment Variables & Secrets Gate

Ensure all required production variables are set. Missing or default values for critical secrets will cause startup termination.

### 3.1 Security-Critical Variables Checklist

| Variable Name | Requirement | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | Must be `"production"` | Activates production optimizations, secure cookies, and strict auth guards. |
| `DATABASE_URL` | PostgreSQL 16 connection string | Primary database credentials with SSL (`sslmode=prefer` or `require`). |
| `ADMIN_SESSION_SECRET` | Min 32 random characters | Signs and validates database-backed administrator session cookies. |
| `ADMIN_IMPERSONATION_SECRET` | Min 32 random characters | Signs HMAC tokens for audited seller account impersonation. |
| `CLERK_SECRET_KEY` | Production `sk_live_...` | Backend verification of customer and seller Clerk JWT tokens. |
| `CLERK_PUBLISHABLE_KEY` | Production `pk_live_...` | Storefront Clerk authentication integration. |
| `CLERK_JWT_KEY` | PEM Public Key | Local JWT signature verification avoiding external Clerk network requests. |
| `RAZORPAY_KEY_ID` | Production key | Customer checkout payment gateway integration. |
| `RAZORPAY_KEY_SECRET` | Production secret | HMAC-SHA256 signature verification for online payments. |
| `RAZORPAY_WEBHOOK_SECRET` | Production secret | Verifies raw-body signatures for captured and refund webhooks. |
| `STORAGE_DRIVER` | `"local"` or `"s3"` | Configures asset key resolution and document preservation. |
| `PRIVATE_DOCUMENT_STORAGE_DIR` | Absolute path | Directory containing private KYC, GST, and seller invoices. |

### 3.2 Generate Secure Production Secrets (Bash/Linux)
```bash
# Generate high-entropy 64-character hex secrets:
ADMIN_SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_IMPERSONATION_SECRET=$(openssl rand -hex 32)
echo "ADMIN_SESSION_SECRET=$ADMIN_SESSION_SECRET"
echo "ADMIN_IMPERSONATION_SECRET=$ADMIN_IMPERSONATION_SECRET"
```

---

## Phase 4: Production Docker Build & Deployment (VPS)

Execute on the target production Ubuntu server (`/opt/1handindia` or `/var/www/1handindia`).

### 4.1 VPS Directory Setup & Permissions
```bash
# Create application directory
sudo mkdir -p /opt/1handindia/storage/private
sudo mkdir -p /opt/1handindia/storage/public
sudo mkdir -p /opt/1handindia/backups

# Set appropriate ownership for Docker daemon
sudo chown -R 1000:1000 /opt/1handindia/storage
sudo chmod 700 /opt/1handindia/storage/private
```

### 4.2 Pull Latest Repository & Deploy
```bash
cd /opt/1handindia

# Fetch latest main branch
git pull origin main

# Build and start services in detached mode
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d
```

### 4.3 Verify Container Status
```bash
# Check running containers (nginx, web, api, worker, db)
docker compose -f docker-compose.prod.yml ps

# Inspect logs for bootstrap initialization
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
```

---

## Phase 5: Post-Deployment Smoke & Health Validation

Verify that public and internal surfaces are functioning normally.

### 5.1 Service Health Checks
```bash
# 1. API Health Endpoint (must return 200 OK)
curl -fsSL https://1handindia.com/api/health

# 2. Storefront Web Home (must return 200 OK)
curl -fsSL -I https://1handindia.com/

# 3. Security Headers Verification
curl -I https://1handindia.com/ | grep -iE 'content-security-policy|x-frame-options|strict-transport-security'

# 4. Robots.txt and Sitemap.xml
curl -fsSL https://1handindia.com/robots.txt
curl -fsSL https://1handindia.com/sitemap.xml
```

### 5.2 Critical Flow Smoke Checklist
- [ ] **Admin Login Gate**: Open `/admin/login`, authenticate with DB-backed admin account.
- [ ] **Seller Hub**: Open `/seller`, verify seller navigation and profile loading.
- [ ] **Customer Storefront**: Open homepage `/`, verify banners and product grid render without errors.
- [ ] **Cart & Checkout**: Add product to cart, view checkout screen with server-priced totals.
- [ ] **Order Tracking**: Open `/track-order`, verify lookup form works.
- [ ] **B2B Procurement**: Open `/b2b`, verify company profile and RFQ list load.

---

## Phase 6: System Seeding & Operational Reference Data

Run only during initial platform provisioning or operational catalog expansion.

### 6.1 Idempotent System & Reference Seeding
```bash
# Seed RBAC system roles, permissions, and tax rate reference tables (Safe & Idempotent)
docker compose -f docker-compose.prod.yml exec api pnpm db:seed:system

# Seed India postal pincodes & location hierarchy (if not loaded)
docker compose -f docker-compose.prod.yml exec api pnpm locations:import:india

# Seed SAC master codes for GST compliance
docker compose -f docker-compose.prod.yml exec api pnpm tax:sac:import
```

> [!IMPORTANT]
> **Never run `pnpm db:seed:bootstrap` in production.** It creates dummy demo sellers, mock orders, and test users intended strictly for local development environments.

---

## Phase 7: Ongoing Maintenance, Backups & Emergency Rollback

Procedures for operating the platform safely over time.

### 7.1 Automated Daily Database Backup Script
Save as `/opt/1handindia/scripts/backup-db.sh` and schedule via cron:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/opt/1handindia/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/1handindia_db_$TIMESTAMP.sql.gz"

echo "Creating database backup: $FILENAME"
docker compose -f /opt/1handindia/docker-compose.prod.yml exec -T db \
  pg_dump -U indihub -d indihub_prod --clean --if-exists | gzip > "$FILENAME"

# Keep last 14 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete
echo "Backup complete."
```

### 7.2 Emergency Rollback Runbook
If a newly deployed release exhibits critical defects:

```bash
cd /opt/1handindia

# 1. Roll back Git commit to previous stable release tag
git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>

# 2. Rebuild and restart containers
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 3. Verify health
curl -fsSL https://1handindia.com/api/health
```

---

## Pre-Flight Sign-Off Sheet

Before opening traffic to public users:

- [x] Code tested: 557 API tests + 222 Web tests passing.
- [x] Architecture verified: 0 growing boundary debt violations.
- [x] Security audited: Impersonation fallback secret fixed; CSV formula injection neutralized.
- [ ] HTTPS Certificate issued and auto-renewal tested via Certbot.
- [ ] High-entropy production secrets configured in `.env.production`.
- [ ] Database automated backup cron verified and test-restored once.
- [ ] Clerk production keys and webhook endpoints linked.
- [ ] Razorpay production API credentials verified in test transaction.
