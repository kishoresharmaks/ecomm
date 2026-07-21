# 1HandIndia Staging Deployment and Complete E2E Handoff

**Prepared:** 21-07-2026  
**Target:** Staging only  
**Branch base at preparation:** `main` at `1faf6f0`  
**Primary feature flag:** `B2B_ORDER_TO_CASH_V2_ENABLED`  
**Required outcome:** Migrations, builds, services, and every mandatory manual test pass before production promotion.

## 1. Release Decision

Use a reviewed Git release branch and deploy one immutable commit to staging.

Do not copy the dirty workspace directly to the server. Do not run `prisma db push` on staging.
Keep B2B V2 disabled while migrations and baseline smoke checks run. Enable it only after the
staging database, API, web, and worker are healthy.

Recommended release order:

```text
Review and commit
-> push release branch
-> back up staging
-> configure staging environment
-> apply migrations
-> build
-> restart with B2B V2 disabled
-> baseline smoke test
-> enable B2B V2
-> restart API and worker
-> complete E2E verification
-> reconcile data
-> sign off
```

## 2. Scope of This Staging Bundle

The current workspace contains a coordinated release across:

- B2B Order-to-Cash V2 and exception handling.
- Multi-line enquiries, quotations, orders, fulfilment, shipment, and finance records.
- B2B amendments, disputes, credit notes, refunds, reconciliation, and ERP integration.
- GST seller registration, product tax classification, tax documents, PDFs, and reports.
- Seller contact-field backfill.
- Schema audit and delivery-assignment history hardening.
- Return policy, reverse pickup, refund, and finance controls.
- Razorpay reservation-expiry handling.
- Seller payout-data encryption.
- Customer, seller, admin, finance, delivery, and B2B web UI changes.
- Customer and seller mobile compatibility changes.
- PostgreSQL-backed workers and no-Redis fallback operation.

The exact file list must be captured from Git immediately before commit:

```powershell
git status --short
git diff --stat
git diff --check
git ls-files --others --exclude-standard
```

At preparation time, the workspace had a large mixed change set. Treat it as one coordinated
staging release unless the team intentionally splits and re-verifies it.

## 3. Local Pre-Push Procedure

### 3.1 Security first

1. Revoke and replace any credential previously visible in the IDE or chat.
2. Confirm `.env` is ignored:

```powershell
git check-ignore -v .env
```

3. Confirm these files are not staged:

```text
.env
.env.production
auth.json
*.pem
*.key
*.jks
*.keystore
google-services.json
service-account JSON files
storage/private/*
```

4. The generated `.tmp-b2b-full-schema.sql` file is ignored by `.gitignore` and must not be
   committed.

### 3.2 Create the release branch

```powershell
git switch -c staging/b2b-gst-hardening-2026-07-21
```

If the branch already exists:

```powershell
git switch staging/b2b-gst-hardening-2026-07-21
```

### 3.3 Run non-writing verification

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:generate
pnpm.cmd db:validate

pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api test
pnpm.cmd --filter @indihub/api build

pnpm.cmd --filter @indihub/worker typecheck
pnpm.cmd --filter @indihub/worker lint
pnpm.cmd --filter @indihub/worker test
pnpm.cmd --filter @indihub/worker build

pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web test
pnpm.cmd --filter @indihub/web build
```

Expected baseline from the latest verification:

- Prisma schema validation passes.
- API tests: `429 passed`, `30 skipped`.
- API production build passes.
- Web tests: `139 passed`.
- Web production build passes.
- Existing lint warnings may remain, but no lint errors are allowed.

Do not run the database-writing backend integration suite against the connected remote database.

### 3.4 Review and stage

```powershell
git diff --check
git add -A
git status --short
git diff --cached --stat
git diff --cached --check
```

Confirm `.env` and private credentials are absent:

```powershell
git diff --cached --name-only | Select-String -Pattern '(^|/)\.env$|auth\.json|\.pem$|\.key$|\.jks$|\.keystore$|google-services\.json'
```

Expected: no output.

### 3.5 Commit and push

```powershell
git commit -m "Complete B2B order-to-cash GST and schema hardening"
git push -u Ecomm staging/b2b-gst-hardening-2026-07-21
git rev-parse HEAD
```

Record the final commit:

| Item | Value |
|---|---|
| Branch | `staging/b2b-gst-hardening-2026-07-21` |
| Commit SHA |  |
| Reviewer |  |
| Push time |  |

## 4. Staging Environment File

Use `/var/www/indihub/.env.production` on the staging server. Never commit it.

Create it from the example:

```bash
cd /var/www/indihub
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
```

Generate independent secrets for staging. Do not reuse production secrets.

Example secret generation:

```bash
openssl rand -base64 48
```

### 4.1 Required staging values

Replace every placeholder:

```env
NODE_ENV="production"
INDIHUB_ENV="staging"
NEXT_PUBLIC_APP_ENV="staging"
LOG_LEVEL="info"

NEXT_PUBLIC_APP_NAME="1HandIndia"
NEXT_PUBLIC_WEB_URL="https://staging.example.com"
NEXT_PUBLIC_API_URL="https://staging-api.example.com"
NEXT_PUBLIC_API_TIMEOUT_MS="12000"

API_PORT="4000"
API_CORS_ORIGINS="https://staging.example.com,https://staging-api.example.com"

DATABASE_URL="postgresql://STAGING_RUNTIME_USER:STRONG_PASSWORD@STAGING_DB_HOST:5432/indihub_staging?schema=public"
DATABASE_DIRECT_URL="postgresql://STAGING_MIGRATION_USER:STRONG_PASSWORD@STAGING_DB_HOST:5432/indihub_staging?schema=public"
DATABASE_READ_URL=""

PG_APP_NAME="indihub-staging"
PG_POOL_MAX="10"
PG_POOL_CONNECTION_TIMEOUT_MS="10000"
PG_POOL_IDLE_TIMEOUT_MS="60000"
PG_POOL_MAX_LIFETIME_SECONDS="900"
PG_POOL_KEEP_ALIVE_INITIAL_DELAY_MS="10000"
PG_POOL_ALLOW_EXIT_ON_IDLE="false"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="STAGING_CLERK_PUBLISHABLE_KEY"
CLERK_SECRET_KEY="STAGING_CLERK_SECRET_KEY"
CLERK_JWT_KEY="STAGING_CLERK_PUBLIC_KEY_PEM"
CLERK_JWT_AUDIENCE=""
CLERK_AUTHORIZED_PARTIES="https://staging.example.com"
CLERK_WEBHOOK_SECRET="STAGING_CLERK_WEBHOOK_SECRET"

INDIHUB_FIRST_ADMIN_EMAIL="staging-admin@example.com"
INDIHUB_FIRST_ADMIN_NAME="1HandIndia Staging Admin"
INDIHUB_FIRST_ADMIN_PASSWORD="STRONG_STAGING_ADMIN_PASSWORD"
ADMIN_SESSION_TTL_HOURS="8"
INDIHUB_BOOTSTRAP_SECRET="GENERATED_SECRET"
INDIHUB_AUTH_SYNC_SECRET="GENERATED_SECRET"

INTERNAL_API_URL="https://staging-api.example.com"
INTERNAL_API_SECRET="GENERATED_SHARED_API_WORKER_SECRET"

INDIHUB_ALLOW_DEV_AUTH="false"
NEXT_PUBLIC_INDIHUB_ENABLE_LOCAL_AUTH="false"
NEXT_PUBLIC_INDIHUB_DEV_ADMIN_USER_ID=""
NEXT_PUBLIC_INDIHUB_DEV_CUSTOMER_USER_ID=""
NEXT_PUBLIC_INDIHUB_DEV_SELLER_USER_ID=""
NEXT_PUBLIC_INDIHUB_DEV_BUSINESS_BUYER_USER_ID=""
NEXT_PUBLIC_INDIHUB_DEV_DELIVERY_PARTNER_USER_ID=""

REDIS_URL=""
WORKER_KEEP_ALIVE="true"
INDIHUB_ALLOW_INTEGRATION_TEST_DB="false"
INDIHUB_ALLOW_PRODUCTION_SEED="false"
INDIHUB_SEED_MODE="schema"
```

`NEXT_PUBLIC_*` values are embedded during the web build. Rebuild after changing them.

### 4.2 B2B V2 values

Start deployment with the feature disabled:

```env
B2B_ORDER_TO_CASH_V2_ENABLED="false"
B2B_POD_ACCEPTANCE_DAYS="3"

B2B_COLLECTION_WORKER_ENABLED="true"
B2B_COLLECTION_POLL_INTERVAL_MS="3600000"
B2B_COLLECTION_BATCH_SIZE="100"
B2B_COLLECTION_REMINDER_INTERVAL_HOURS="24"

B2B_POD_AUTO_ACCEPT_WORKER_ENABLED="true"
B2B_POD_AUTO_ACCEPT_POLL_INTERVAL_MS="900000"
B2B_POD_AUTO_ACCEPT_BATCH_SIZE="100"

B2B_ERP_OUTBOX_WORKER_ENABLED="true"
B2B_ERP_OUTBOX_POLL_INTERVAL_MS="30000"
B2B_ERP_OUTBOX_BATCH_SIZE="50"
B2B_ERP_MAX_RETRY_ATTEMPTS="8"
B2B_ERP_RETRY_BASE_DELAY_MS="30000"
B2B_ERP_CREDENTIAL_ENCRYPTION_KEY="GENERATED_SECRET_AT_LEAST_32_CHARACTERS"

B2B_OVERDUE_WORKER_ENABLED="false"
B2B_OVERDUE_POLL_INTERVAL_MS="3600000"
B2B_OVERDUE_BATCH_SIZE="100"
```

When V2 is enabled, the V2 collection worker replaces the legacy overdue worker.

### 4.3 GST values

```env
GST_B2CL_THRESHOLD_PAISE="10000000"
GST_PROVIDER_CREDENTIAL_ENCRYPTION_KEY="GENERATED_SECRET_AT_LEAST_32_CHARACTERS"

GST_EINVOICE_CLIENT_ID=""
GST_EINVOICE_CLIENT_SECRET=""
GST_EWAY_CLIENT_ID=""
GST_EWAY_CLIENT_SECRET=""
```

Leave provider IDs empty when staging uses audited manual compliance. Filling them only indicates
readiness; live IRN or e-way submission still requires an approved provider adapter and seller
authorization.

### 4.4 Seller payout encryption

```env
SELLER_PAYOUT_DATA_ENCRYPTION_KEY="GENERATED_SECRET_AT_LEAST_32_CHARACTERS"
INDIHUB_ALLOW_SELLER_PAYOUT_BACKFILL="false"
```

Run the dry check before any payout backfill:

```bash
pnpm finance:payout-encryption:dry
```

Only after reviewing the dry output on staging:

```bash
INDIHUB_ALLOW_SELLER_PAYOUT_BACKFILL=true pnpm finance:payout-encryption:apply
```

Never rotate this key without a planned decrypt-and-reencrypt migration.

### 4.5 Private storage

Preferred staging S3-compatible configuration:

```env
INDIHUB_PRIVATE_STORAGE_PROVIDER="S3"
INDIHUB_PRIVATE_UPLOAD_ROOT="storage/private"
S3_ENDPOINT="STAGING_S3_ENDPOINT"
S3_REGION="STAGING_S3_REGION"
S3_BUCKET="STAGING_PRIVATE_BUCKET"
S3_ACCESS_KEY_ID="STAGING_ACCESS_KEY"
S3_SECRET_ACCESS_KEY="STAGING_SECRET_KEY"

PRIVATE_UPLOAD_CLEANUP_WORKER_ENABLED="true"
PRIVATE_UPLOAD_ORPHAN_RETENTION_HOURS="24"
PRIVATE_UPLOAD_CLEANUP_INTERVAL_MS="3600000"
PRIVATE_UPLOAD_CLEANUP_BATCH_SIZE="50"
```

For filesystem staging, use `LOCAL` and include `/var/www/indihub/storage/private` in backups.

### 4.6 Payment values

Prefer configuring Razorpay through `/admin/payments`. Environment values are fallback:

```env
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

RAZORPAY_RESERVATION_EXPIRY_WORKER_ENABLED="true"
RAZORPAY_RESERVATION_TIMEOUT_MINUTES="15"
RAZORPAY_RESERVATION_EXPIRY_POLL_INTERVAL_MS="60000"
RAZORPAY_RESERVATION_EXPIRY_BATCH_SIZE="50"
```

Use Razorpay test mode only on staging.

### 4.7 Return and worker values

```env
RETURN_PICKUP_TIMEOUT_WORKER_ENABLED="true"
RETURN_PICKUP_TIMEOUT_POLL_INTERVAL_MS="60000"
RETURN_PICKUP_TIMEOUT_BATCH_SIZE="50"

SEARCH_INDEX_WORKER_ENABLED="true"
SEARCH_INDEX_POLL_INTERVAL_MS="5000"
SEARCH_INDEX_BATCH_SIZE="25"
```

### 4.8 Email values

Prefer `/admin/email`. Environment fallback:

```env
EMAIL_PROVIDER="brevo"
EMAIL_FROM_NAME="1HandIndia Staging"
EMAIL_FROM_ADDRESS="staging-no-reply@example.com"
EMAIL_ADMIN_RECIPIENTS="staging-ops@example.com"
BREVO_API_KEY=""
RESEND_API_KEY=""
SENDGRID_API_KEY=""
SMTP_BRIDGE_URL=""
```

Use a staging sender and recipients. Do not email real customers.

### 4.9 Current local `.env` audit

The local `.env` is ignored and was checked by key name only. Before staging deployment, explicitly
add or verify:

- `DATABASE_DIRECT_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_API_URL`
- `INTERNAL_API_SECRET`
- `INTERNAL_API_URL`
- `GST_PROVIDER_CREDENTIAL_ENCRYPTION_KEY`
- `INDIHUB_PRIVATE_STORAGE_PROVIDER`
- `RAZORPAY_RESERVATION_EXPIRY_WORKER_ENABLED`
- All B2B V2 worker and encryption values above

Do not copy the local `.env` to staging.

## 5. Staging Server Deployment

### 5.1 Back up before changing code

Create a timestamp:

```bash
export RELEASE_TS=$(date +%F_%H%M%S)
```

Database backup:

```bash
sudo -u postgres pg_dump -Fc indihub_staging \
  > /var/backups/indihub/postgres/indihub_staging_${RELEASE_TS}.dump
```

Local private-file backup when applicable:

```bash
sudo -u indihub mkdir -p /var/backups/indihub/private-files/${RELEASE_TS}
sudo -u indihub rsync -a /var/www/indihub/storage/private/ \
  /var/backups/indihub/private-files/${RELEASE_TS}/
```

Record backup paths and verify both files/directories exist.

### 5.2 Pull the exact release

```bash
cd /var/www/indihub
git fetch origin
git checkout staging/b2b-gst-hardening-2026-07-21
git pull --ff-only origin staging/b2b-gst-hardening-2026-07-21
git rev-parse HEAD
git status --short
```

Expected: the commit matches the approved release and the server worktree is clean.

### 5.3 Install and validate

```bash
set -a
source .env.production
set +a

pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:validate
npx prisma migrate status
```

### 5.4 Expected migration order

Verify these migrations are present:

```text
20260719120000_return_policy_reverse_pickup_finance
20260720130000_gst_tax_documents
20260720190000_advanced_gst_compliance
20260720203000_separate_seller_registration_and_supply_tax
20260720213000_backfill_seller_profile_contacts
20260721120000_complete_b2b_order_to_cash
20260721160000_schema_audit_hardening
20260721190000_b2b_exception_path_hardening
20260721203000_service_sac_tax_integration
```

Important migration effects:

- Seller profile contact fields are added, backfilled, then made required.
- Historical `MANUAL_COURIER` is renamed to `THIRD_PARTY_COURIER`.
- Seller commission values are split by unit.
- Razorpay webhook storage is normalized.
- Seller payout encrypted columns are added.
- GST, B2B V2, assignment history, amendment, dispute, and reconciliation tables are added.
- Immutable tax, payment, receipt, POD, QC, assignment, amendment, dispute, and reconciliation
  controls are installed.

### 5.5 Apply migrations

Confirm the database name first:

```bash
psql "$DATABASE_DIRECT_URL" -tAc "SELECT current_database();"
```

It must return the approved staging database.

Apply:

```bash
npx prisma migrate deploy
npx prisma migrate status
```

### 5.6 Recover `20260721160000_schema_audit_hardening` P3018

Use this only when the failed migration reports that
`manual_transport_charge_per_km_paise` does not exist.

First deploy the corrected migration file. It conditionally copies the legacy value only when the
legacy column exists, then uses `DROP COLUMN IF EXISTS`.

The corrected migration is convergent and safely handles schema changes that may already have been
applied before the failure. Mark the failed attempt as rolled back, then let Prisma rerun it:

```bash
cd /var/www/indihub/ecomm
npx prisma migrate resolve --rolled-back 20260721160000_schema_audit_hardening
npx prisma migrate deploy
npx prisma migrate status
```

Do not use `--applied` for this failure. Doing so would skip the remaining schema-hardening
constraints, triggers, indexes, and backfills.

Do not use:

```text
prisma db push
prisma db push --force-reset
prisma migrate dev
```

### 5.7 Build and restart with V2 disabled

```bash
pnpm build
sudo systemctl restart indihub-api indihub-web indihub-worker
sudo systemctl status indihub-api indihub-web indihub-worker
```

Health checks:

```bash
curl -fsS https://staging-api.example.com/api/health
curl -I https://staging.example.com
```

Logs:

```bash
journalctl -u indihub-api -n 150 --no-pager
journalctl -u indihub-web -n 150 --no-pager
journalctl -u indihub-worker -n 150 --no-pager
```

Expected:

- No Prisma missing-table or missing-column errors.
- No environment-validation errors.
- No continuous worker failures.
- B2B V2 actions return disabled/unavailable while the flag is false.
- Existing storefront, admin login, seller center, checkout, and finance pages still load.

### 5.8 Enable B2B V2

Edit:

```env
B2B_ORDER_TO_CASH_V2_ENABLED="true"
```

Restart runtime processes:

```bash
sudo systemctl restart indihub-api indihub-worker
sudo systemctl status indihub-api indihub-worker
```

Confirm worker logs show:

- B2B collection polling started.
- B2B POD auto-accept polling started.
- B2B ERP outbox polling started.
- Legacy B2B overdue worker replaced by V2 collection worker.

## 6. Staging Test Accounts and Data

Use separate accounts:

| Code | Role | Required state |
|---|---|---|
| `BUYER-A` | Business buyer | Approved, same state as seller |
| `BUYER-B` | Business buyer | Approved, different state |
| `SELLER-GST` | Seller | Approved, GST registered, valid GSTIN and certificate |
| `SELLER-NON-GST` | Seller | Approved, not registered, no GSTIN |
| `STAFF-SALES` | Seller staff | B2B sales permission only |
| `STAFF-WAREHOUSE` | Seller staff | Warehouse permission only |
| `STAFF-DISPATCH` | Seller staff | Dispatch permission only |
| `ADMIN` | Standalone admin | Active |
| `FINANCE` | Finance | Active |
| `DELIVERY` | Delivery partner | Approved and available |
| `SUPPORT` | Support | No finance/tax mutation rights |
| `UNRELATED-BUYER` | Buyer | Does not own test order |
| `UNRELATED-SELLER` | Seller | Does not own test order |

Create three approved GST products:

| Product | Purpose |
|---|---|
| `B2B-STOCK-01` | Available stock |
| `B2B-PROCURE-01` | Procurement |
| `B2B-PRODUCE-01` | Production |

Every taxable GST-seller product needs:

- HSN/SAC.
- Approved GST rate.
- Tax classification.
- SKU/variant.
- Stock or an intentional procure/produce path.

Prepare:

- Purchase-order PDF.
- QC evidence image.
- POD image/PDF.
- Test transport details.
- Razorpay test account.
- ERP test receiver.

## 7. Complete B2B Golden-Path E2E

Record every generated reference and screenshot.

### 7.1 Enquiry to order

1. Buyer opens `/b2b/enquiries/new`.
2. Create one enquiry with all three product lines.
3. Seller opens `/seller/b2b-enquiries/[id]`.
4. Send quotation with price, transport, ETA, and notes.
5. Buyer negotiates and confirms the final quotation.
6. Admin opens `/admin/b2b-enquiries/[id]`.
7. Approve and finalise.
8. Confirm a B2B order and proforma exist.

Expected:

- All lines retain product, variant, quantity, price, tax, and seller snapshots.
- Buyer, seller, and unrelated-account isolation works.
- Duplicate confirmation does not create another order.

### 7.2 PO and commercial controls

1. Buyer uploads the PO and enters PO number.
2. Admin opens `/admin/b2b-orders/[orderNumber]`.
3. Complete structured PO review:
   - document match
   - price
   - quantity
   - delivery terms
   - stock
   - tax data
   - credit
4. Record credit decision or prepaid terms.

Expected:

- Failed checks prevent approval.
- Approved PO enters credit/payment clearance.
- Stale `version` actions return `409`.

### 7.3 Payment

Use Razorpay test mode or finance-verified bank transfer.

Expected:

- Browser success alone does not mark paid.
- Captured provider payment is verified server-side.
- Allocation updates payment schedule and receivable once.
- Duplicate verification creates no duplicate receipt or allocation.
- Excess payment remains unallocated for finance review.

### 7.4 Fulfilment

Seller opens `/seller/b2b-orders/[orderNumber]`.

1. `B2B-STOCK-01` -> `AVAILABLE_STOCK`.
2. `B2B-PROCURE-01` -> `PROCURE`.
3. `B2B-PRODUCE-01` -> `PRODUCE`.
4. Record partial and final procurement receipt.
5. Record production progress and completion.
6. Confirm each line reaches stock ready independently.

Expected:

- Order summary remains broadly `IN_FULFILMENT` while lines differ.
- Available stock is reserved once.
- Procurement and production cannot both attach to the same plan.
- Rejected/short quantities do not become ready stock.

### 7.5 Pick, pack, and QC

1. Create and complete pick task.
2. Confirm reserved stock is consumed once.
3. Create and complete pack task.
4. Create package dimensions, weight, and line allocations.
5. Record QC evidence and pass.

Expected:

- Simultaneous/retried picking cannot consume twice.
- Failed or held QC blocks invoice and dispatch.
- Closed QC evidence cannot be edited.

### 7.6 Invoice and compliance

1. Issue the final document after QC.
2. For the GST seller, verify tax invoice details.
3. Record e-invoice result or explicit `NOT_REQUIRED`.
4. Record e-way result or explicit `NOT_REQUIRED`.

Expected:

- Invoice is blocked before QC.
- Taxable interstate supply uses IGST.
- Taxable intrastate supply uses CGST and SGST.
- Invoice includes seller, buyer, GSTIN, address, HSN, quantity, value, and tax snapshots.
- Issued invoice and lines are immutable.
- Dispatch remains blocked without required compliance.

### 7.7 Shipment and delivery

1. Prepare package-backed shipment.
2. Assign the delivery partner.
3. Enter transporter, vehicle, LR/AWB, and ETA.
4. Dispatch.
5. Delivery user opens `/delivery/b2b-shipments/[shipmentId]`.
6. Record transit events.
7. Upload authenticated POD and receiver identity.
8. Mark delivered.
9. Buyer accepts delivery.

Expected:

- Only the assigned delivery user can mutate the shipment.
- POD is required before delivery acceptance.
- POD cannot be edited.
- All shipments must be accepted before order acceptance.

### 7.8 Closure and payout

Finance opens `/finance/b2b-orders/[orderNumber]`.

Expected:

- Paid plus accepted order becomes `CLOSED`.
- Receivable outstanding is zero.
- Seller settlement becomes eligible only after required payment and acceptance.
- ERP outbox contains invoice, dispatch, delivery, payment, and receipt events.

## 8. Mandatory Exception Tests

### 8.1 Amendments

- Request quantity/address change before funds and operations: approval succeeds.
- Verify before/after snapshots and actor.
- Verify PO returns to review.
- Verify reservations release once and schedules rebuild.
- Request commercial amendment after cleared funds: blocked.
- Request line amendment after procurement/picking: blocked.
- Request amendment after issued invoice: blocked.
- Directly edit/delete a final amendment in staging DB transaction: database rejects it.

### 8.2 Cancellation

- Cancel before picking: reservations release once.
- Cancel with procurement/production: operational records cancel.
- Retry cancellation: no duplicate inventory movement.
- Cancel after picking or issued invoice: blocked.
- Cancel with cleared funds: blocked pending refund handling.

### 8.3 Delivery dispute

1. Buyer disputes delivered shipment with reason.
2. Confirm linked support case is created.
3. Confirm receivable becomes disputed and settlement is not eligible.
4. Attempt generic support closure: blocked.
5. Resolve using each required staging scenario:
   - partial acceptance
   - replacement
   - return and refund
   - credit note
   - claim rejected

For full return/refund:

```text
Revised payable = 0
Revised paid = 0
Outstanding = 0
Settlement eligible = false unless the final resolved state allows it
```

Confirm the credit note links to the original invoice and cannot exceed remaining invoice value.

### 8.4 Financial reconciliation

1. Open finance reconciliation controls.
2. Run detect-only mode.
3. Confirm matching data records `MATCHED`.
4. On controlled staging data, create a cached mismatch.
5. Confirm detect-only records `EXCEPTION` without correction.
6. Run approved correction.
7. Confirm order, schedules, and receivable match immutable allocations/refunds/adjustments.
8. Confirm reconciliation history cannot be edited or deleted.

### 8.5 Concurrency and idempotency

- Double-click payment verify.
- Retry invoice issuance.
- Retry shipment creation.
- Retry cancellation.
- Submit stale lifecycle version.
- Replay duplicate provider callback.

Expected: one committed result, no duplicated financial/inventory/tax records, and stale actions return
`409`.

## 9. GST and Seller Registration Verification

### 9.1 GST seller

Register or edit `SELLER-GST`:

- `taxRegistrationStatus = GST_REGISTERED`
- valid GSTIN
- matching state code
- GST certificate
- legal name and registered address

Verify:

- Missing GSTIN/document blocks approval where required.
- Taxable products require HSN and GST rate.
- GST calculations and reports include only that seller's transactions.
- Seller can download authenticated invoice PDFs.
- Buyer invoice PDF contains immutable recipient details.

### 9.2 Non-GST seller

Register `SELLER-NON-GST`:

- `taxRegistrationStatus = NOT_REGISTERED`
- no GSTIN
- no GST certificate requirement

Verify:

- Seller cannot collect GST by entering a product rate.
- Taxable commercial products remain zero-GST for that seller.
- Document is commercial/non-GST treatment, not a regular GST tax invoice.
- Seller does not enter the regular GSTR filing workflow.

### 9.3 GST reports

Check:

```text
/seller/reports/tax
/admin/finance/gst-reports
```

Verify:

- Pagination uses numeric limits.
- Seller isolation.
- Buyer name, GSTIN, and address.
- HSN and tax components.
- Credit-note linkage.
- Authenticated PDF download.
- CSV/JSON totals equal UI and database.
- Mobile viewport has no page-level horizontal overflow.

Optional automated browser QA must use a disposable local database:

```powershell
pnpm.cmd test:e2e:gst
```

Never point `GST_E2E_DATABASE_URL` at staging or production.

## 10. Returns, Payments, and Payout Security

### 10.1 Returns

- Product return policy displays correctly on customer web/mobile.
- Eligible delivered item can request return.
- Ineligible item is blocked with clear reason.
- Reverse pickup assignment and timeout work.
- Damage/shortage evidence remains private.
- Refund and tax credit-note values reconcile.

### 10.2 Razorpay reservation expiry

- Create unpaid Razorpay order.
- Wait past staging timeout or use a controlled short timeout.
- Worker asks API to verify provider state.
- Captured payment recovers as paid.
- Authorized payment keeps reservation.
- Truly unpaid order cancels and restores stock once.
- Worker and API use the same `INTERNAL_API_SECRET`.

### 10.3 Seller payout profile

- Seller saves bank/UPI data.
- Database stores encrypted values and display hints/last-four only.
- API responses do not expose plaintext account data.
- Existing payout profile dry backfill reports expected rows.
- Payout request, approval, rejection, and mark-paid still work.

## 11. Read-Only Database Verification

Run after deployment:

```sql
SELECT current_database();

SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC NULLS LAST;

SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tax_documents',
    'tax_document_lines',
    'gst_filing_periods',
    'b2b_order_lines',
    'b2b_payment_schedules',
    'b2b_shipments',
    'b2b_receivables',
    'b2b_order_amendments',
    'b2b_dispute_resolutions',
    'b2b_financial_reconciliations',
    'order_shipment_assignment_events'
  )
ORDER BY tablename;

SELECT COUNT(*) AS missing_contact_rows
FROM seller_profiles
WHERE "contactName" IS NULL
   OR "contactPhone" IS NULL
   OR "contactEmail" IS NULL;
```

Expected:

- All migrations show successful completion.
- Every listed table exists.
- `missing_contact_rows = 0`.

Verify the delivery enum:

```sql
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
WHERE pg_type.typname = 'DeliveryMode'
ORDER BY enumsortorder;
```

Expected: `THIRD_PARTY_COURIER` exists and `MANUAL_COURIER` does not.

## 12. Portal and Access Smoke Matrix

| Portal | Route | Required result |
|---|---|---|
| Storefront | `/` | Loads |
| Customer | `/account/orders` | Customer isolation |
| Seller Hub | `/seller` | Seller-specific navigation |
| Seller tax | `/seller/reports/tax` | Seller-scoped reports |
| B2B buyer | `/b2b/orders` | Buyer-owned orders |
| Admin | `/admin` | Standalone login |
| Admin B2B | `/admin/b2b-orders` | Full oversight |
| Admin cases | `/admin/b2b-cases` | Dispute queue |
| Admin exceptions | `/admin/b2b-exceptions` | Operational blockers |
| Admin ERP | `/admin/b2b-integrations` | Outbox/export history |
| Admin GST | `/admin/finance/gst-reports` | Marketplace GST reports |
| Finance | `/finance/b2b-receivables` | AR and ageing |
| Delivery | `/delivery/b2b-shipments` | Assigned shipments only |

Test desktop and mobile widths. Confirm loading, empty, error, disabled, and long-text states.

## 13. Worker Verification

```bash
sudo systemctl status indihub-worker
journalctl -u indihub-worker -f
```

Confirm:

- Search index polling.
- B2B collection polling.
- POD auto-accept polling.
- ERP outbox polling.
- Return pickup timeout polling.
- Razorpay reservation expiry polling.
- Private upload cleanup polling.
- Worker continues operating with `REDIS_URL=""`.

For ERP:

- Configure one staging ERP receiver.
- Verify signed request.
- Return a controlled failure.
- Confirm retry delay and attempt count.
- Confirm dead-letter after maximum attempts.
- Replay and acknowledge successfully.

## 14. Evidence Record

For every workflow, record:

- Release commit.
- Date/time.
- Tester and role.
- Order/enquiry/shipment/payment/invoice/case reference.
- Expected result.
- Actual result.
- Screenshot or log reference.
- Database query reference.
- Final status.

Use:

| Test area | Result | Evidence | Owner |
|---|---|---|---|
| Migration |  |  |  |
| Baseline smoke |  |  |  |
| B2B golden path |  |  |  |
| Amendments |  |  |  |
| Cancellation |  |  |  |
| Delivery dispute |  |  |  |
| Finance reconciliation |  |  |  |
| GST seller |  |  |  |
| Non-GST seller |  |  |  |
| GST reports/PDF/CSV |  |  |  |
| Returns/refunds |  |  |  |
| Razorpay expiry |  |  |  |
| Seller payout encryption |  |  |  |
| ERP retry/replay |  |  |  |
| Role isolation |  |  |  |
| Mobile/responsive |  |  |  |

## 15. Rollback

### 15.1 Fast containment

Set:

```env
B2B_ORDER_TO_CASH_V2_ENABLED="false"
```

Restart:

```bash
sudo systemctl restart indihub-api indihub-worker
```

This disables V2 mutations but does not reverse migrations.

### 15.2 Code rollback

```bash
cd /var/www/indihub
git checkout PREVIOUS_APPROVED_COMMIT
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
sudo systemctl restart indihub-api indihub-web indihub-worker
```

Only use an older code version if it is compatible with the migrated schema.

### 15.3 Database rollback

The schema-audit migration contains renames and dropped legacy columns. Do not manually reverse it
during an incident.

For a full database rollback:

1. Stop API, web, and worker.
2. Restore the pre-release database backup.
3. Restore the matching private-file backup when local storage is used.
4. Deploy the matching previous code commit.
5. Rebuild and restart.
6. Reconcile payments received during the maintenance window before reopening staging.

Do not mark migrations rolled back unless the database was actually restored or manually reverted.

## 16. Final Staging Sign-Off

Production promotion is blocked until:

- [ ] Release commit is reviewed and immutable.
- [ ] No secret or `.env` file is committed.
- [ ] Backup and restore references are recorded.
- [ ] All migrations apply successfully.
- [ ] API, web, and worker builds pass.
- [ ] Baseline portals work before V2 activation.
- [ ] B2B golden path passes.
- [ ] Amendment, cancellation, dispute, and reconciliation tests pass.
- [ ] GST and non-GST seller behavior passes.
- [ ] Tax PDFs and exports reconcile.
- [ ] Returns, payment expiry, and payout encryption pass.
- [ ] Role and seller/buyer isolation pass.
- [ ] Worker retries and no-Redis fallback pass.
- [ ] Finance signs off AR and settlement values.
- [ ] GST practitioner signs off tax behavior.
- [ ] Product owner approves production promotion.

Related detailed references:

- `docs/IndiHub_B2B_ORDER_TO_CASH_V2_COMPLETE_TEST_RUNBOOK.md`
- `docs/IndiHub_B2B_ORDER_TO_CASH_V2_IMPLEMENTATION_GUIDE.md`
- `docs/IndiHub_GST_COMPLIANCE_IMPLEMENTATION_AND_SETUP_GUIDE.md`
- `docs/IndiHub_GST_BROWSER_QA_CHECKLIST.md`
- `docs/IndiHub_SCHEMA_AUDIT_HARDENING.md`
- `docs/IndiHub_VPS_PRODUCTION_SETUP_RUNBOOK.md`
