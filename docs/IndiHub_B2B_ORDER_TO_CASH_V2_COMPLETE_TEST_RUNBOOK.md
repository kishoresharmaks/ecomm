# 1HandIndia B2B Order-to-Cash V2 Complete Test Runbook

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Test scope:** Complete B2B enquiry-to-closure and seller-settlement workflow  
**Last updated:** 21-07-2026  
**Required result:** Every mandatory test must be `PASS` before production activation  
**Feature flag:** `B2B_ORDER_TO_CASH_V2_ENABLED`

## 1. Purpose

Use this document to test the complete B2B Order-to-Cash V2 implementation across:

- Business buyer portal.
- Seller Hub.
- Admin Control Panel.
- Finance workspace.
- Delivery workspace.
- Support workspace.
- PostgreSQL data and migration behavior.
- Razorpay and UPI payments.
- GST invoice and e-way controls.
- ERP exports and webhook delivery.
- Background collection, POD acceptance, overdue, and ERP workers.

This document is both a test procedure and a release acceptance record. Record every order
number, payment reference, document number, shipment number, export number, failure, and
supporting screenshot.

## 2. Non-Negotiable Safety Rules

- Never run this procedure against production.
- Never run it against the currently connected protected or shared database.
- Use a disposable PostgreSQL database whose name includes `test`, `e2e`, or `integration`.
- Confirm the active database name before applying migrations or creating test data.
- Do not use `prisma db push` for this migration test.
- Do not use `--force-reset` against any database containing required data.
- Do not run bootstrap seeds, location imports, or cleanup scripts unless separately approved.
- Use Razorpay test mode only.
- Never write provider secrets, passwords, tokens, or complete webhook payloads into this file.
- Revoke and replace any credential previously displayed in the IDE before testing.

## 3. Test Result Convention

Use these values:

| Result | Meaning |
|---|---|
| `PASS` | Behavior and data match the expected result |
| `FAIL` | Behavior is incorrect or inconsistent |
| `BLOCKED` | Required account, provider, environment, or data is unavailable |
| `NOT_APPLICABLE` | Approved exclusion with a written reason |

For every failed test, record:

- Test ID.
- Date and time.
- Role and account.
- Order/payment/shipment/document reference.
- Steps performed.
- Actual result.
- Expected result.
- Screenshot or log reference.
- Severity.
- Retest result.

## 4. Test Environment Record

| Item | Value |
|---|---|
| Tester |  |
| Test date |  |
| Release/build reference |  |
| Web URL |  |
| API URL |  |
| API documentation URL |  |
| Database host |  |
| Database name |  |
| Razorpay mode | `TEST` |
| Storage provider |  |
| Email provider |  |
| GST provider mode | `MANUAL` / `SANDBOX` |
| ERP test receiver URL |  |
| Feature flag enabled |  |
| Worker running |  |

## 5. Required Test Accounts

Create or identify separate accounts. Do not reuse one identity for all roles.

| Code | Role | Required state | Account reference | Status |
|---|---|---|---|---|
| `BUYER-A` | Business buyer | Approved company, GSTIN, address |  |  |
| `BUYER-B` | Business buyer | Approved company in another state |  |  |
| `SELLER-A` | Seller | Approved, GST-registered, complete address |  |  |
| `SELLER-B` | Seller | Approved, non-GST seller for negative checks |  |  |
| `STAFF-SALES` | Seller staff | `B2B_SALES` only |  |  |
| `STAFF-WH` | Seller staff | `B2B_WAREHOUSE` only |  |  |
| `STAFF-DISPATCH` | Seller staff | `B2B_DISPATCH` only |  |  |
| `ADMIN-A` | Administrator | Active standalone admin login |  |  |
| `FINANCE-A` | Finance | Active finance login |  |  |
| `DELIVERY-A` | Delivery partner | Active and available |  |  |
| `SUPPORT-A` | Support | Support role without finance mutation rights |  |  |
| `UNRELATED-BUYER` | Business buyer | Must not own test order |  |  |
| `UNRELATED-SELLER` | Seller | Must not own test order |  |  |

Interface note:

- Admin users manage the visible B2B case queue at `/admin/b2b-cases`.
- Test support-role authorization directly through `/api/support/b2b-cases` using the API
  documentation or an authenticated API client.
- Do not give `SUPPORT-A` administrator credentials merely to access the admin case page.

## 6. Required Controlled Test Data

Configure one GST seller with three approved product variants:

| Product | Purpose | Required data |
|---|---|---|
| `B2B-STOCK-01` | Available-stock line | Stock at least 20, HSN, GST rate, SKU |
| `B2B-PROCURE-01` | Procurement line | Low or unavailable stock, HSN, GST rate, SKU |
| `B2B-PRODUCE-01` | Production line | Production-required item, HSN, GST rate, SKU |

Use quantities that are easy to reconcile:

| Line | Quantity | Example inclusive unit price |
|---|---:|---:|
| Available stock | 5 | INR 1,180 |
| Procurement | 4 | INR 2,360 |
| Production | 3 | INR 5,900 |

Also prepare:

- Seller and buyer in the same state for CGST/SGST testing.
- Buyer in another state for IGST testing.
- One valid delivery address.
- One invalid or incomplete address for validation.
- One PDF purchase order.
- One POD image or PDF.
- One QC evidence image.
- Razorpay test configuration.
- Private storage configuration.
- An ERP test receiver that records headers, body, response, and duplicate delivery attempts.

## 7. Disposable Database Setup

### 7.1 Confirm the target

In PowerShell:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/indihub_b2b_integration"
$env:DATABASE_DIRECT_URL=$env:DATABASE_URL
$env:INDIHUB_ALLOW_INTEGRATION_TEST_DB="true"
```

Confirm the configured database name without printing the username or password:

```powershell
$targetUrl = [Uri]$env:DATABASE_DIRECT_URL
$targetDatabase = $targetUrl.AbsolutePath.TrimStart("/").Split("?")[0]
$targetDatabase

if ($targetDatabase -notmatch "(test|e2e|integration)") {
  throw "Refusing migration test: database name must contain test, e2e, or integration."
}
```

`prisma.config.ts` reads `DATABASE_DIRECT_URL` first and then `DATABASE_URL`. Set both to
the same disposable database for this test.

**Required:** the printed name contains `test`, `e2e`, or `integration`. Prisma migration
output must show the same database before you continue.

If PostgreSQL `psql` is installed, confirm the connected database as an additional check:

```powershell
psql $env:DATABASE_DIRECT_URL -tAc "SELECT current_database();"
```

| Test ID | Check | Expected result | Result | Evidence |
|---|---|---|---|---|
| `DB-001` | Confirm database name | Disposable test database returned |  |  |
| `DB-002` | Confirm production URL is absent | No production/protected host is active |  |  |

### 7.2 Validate and apply migrations

```powershell
pnpm.cmd db:validate
pnpm.cmd db:generate
pnpm.cmd exec prisma migrate deploy
pnpm.cmd exec prisma migrate status
```

Expected:

- Prisma schema is valid.
- Client generation succeeds.
- All migrations apply once.
- Re-running `migrate deploy` applies no duplicate changes.

| Test ID | Check | Expected result | Result | Evidence |
|---|---|---|---|---|
| `DB-003` | Schema validation | Pass |  |  |
| `DB-004` | Prisma generation | Pass |  |  |
| `DB-005` | Migration deployment | Pass |  |  |
| `DB-006` | Migration status | All migrations applied |  |  |
| `DB-007` | Idempotent deploy | Second deploy reports no pending migration |  |  |

### 7.3 Migration structure checks

Run read-only PostgreSQL queries:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'b2b_%'
ORDER BY tablename;

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'b2b_%'
ORDER BY tablename, indexname;

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table LIKE 'b2b_%'
ORDER BY event_object_table, trigger_name;
```

Verify these areas exist:

- Multi-line enquiry, quotation, and order-line tables.
- PO reviews and credit decisions.
- Payment schedules, records, allocations, and receipts.
- Inventory reservations and fulfilment plans.
- Procurement and production records.
- Warehouse tasks, packages, and QC.
- Shipments, events, and POD.
- Receivables, entries, and collections.
- Support cases.
- Order amendments, dispute resolutions, and finance reconciliations.
- ERP connections, outbox, and export jobs.
- Mutation/idempotency records.

| Test ID | Check | Expected result | Result | Evidence |
|---|---|---|---|---|
| `DB-008` | Foreign-key indexes | Every relation FK has a leading index |  |  |
| `DB-009` | Unique provider IDs | Provider order/payment IDs are unique |  |  |
| `DB-010` | Export indexes | Status, creator, and format indexes exist |  |  |
| `DB-011` | Immutability triggers | Payment, receipt, POD, QC, amendment, dispute, and reconciliation controls exist |  |  |
| `DB-012` | Exception-path tables | Amendment, dispute-resolution, and reconciliation tables exist |  |  |

### 7.4 Legacy backfill checks

If the disposable database contains a copy of legacy data, verify:

```sql
SELECT o.order_number, COUNT(l.id) AS line_count
FROM b2b_orders o
LEFT JOIN b2b_order_lines l ON l.b2b_order_id = o.id
GROUP BY o.id, o.order_number
HAVING COUNT(l.id) = 0;

SELECT e.id, COUNT(l.id) AS line_count
FROM b2b_enquiries e
LEFT JOIN b2b_enquiry_lines l ON l.enquiry_id = e.id
GROUP BY e.id
HAVING COUNT(l.id) = 0;
```

Expected: no migrated order or enquiry has zero lines.

Review legacy `FULFILLED` mappings:

- Stored delivery data maps to `DELIVERED`, `IN_TRANSIT`, or `DISPATCHED`.
- Issued invoices map to `TAX_INVOICE_ISSUED`.
- Ambiguous records map to `FULFILMENT_REVIEW_REQUIRED`.

## 8. Application Startup

Use separate terminals:

```powershell
$env:B2B_ORDER_TO_CASH_V2_ENABLED="true"
pnpm.cmd dev:api
```

```powershell
$env:B2B_ORDER_TO_CASH_V2_ENABLED="true"
pnpm.cmd dev:web
```

```powershell
$env:B2B_ORDER_TO_CASH_V2_ENABLED="true"
pnpm.cmd dev:worker
```

Confirm:

- Web opens normally.
- API health responds.
- API documentation opens.
- Worker starts without requiring Redis.
- No credential value appears in logs.
- No migration or seed runs automatically.

| Test ID | Check | Expected result | Result | Evidence |
|---|---|---|---|---|
| `BOOT-001` | API startup | API starts without runtime errors |  |  |
| `BOOT-002` | Web startup | Web starts and B2B routes load |  |  |
| `BOOT-003` | Worker startup | DB-backed workers start |  |  |
| `BOOT-004` | Redis absent | Application still functions |  |  |
| `BOOT-005` | Feature disabled | V2 APIs return controlled unavailable response |  |  |
| `BOOT-006` | Feature enabled | V2 APIs become available |  |  |

## 9. Automated Verification

Run before browser testing:

```powershell
pnpm.cmd db:validate
pnpm.cmd db:generate

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

Baseline recorded on 21-07-2026:

- API: 419 passed, 30 skipped.
- Worker: 11 passed.
- Web: 139 passed.

Do not accept a lower count without reviewing the reason.

## 10. Golden-Path Test

Use one order to exercise the complete workflow. Record all generated references.

### Golden-path record

| Item | Value |
|---|---|
| Enquiry ID |  |
| Order number |  |
| Proforma number |  |
| PO number |  |
| Payment record |  |
| Razorpay order ID |  |
| Razorpay payment ID |  |
| Tax invoice number |  |
| IRN or not-required reference |  |
| E-way bill or not-required reason |  |
| Shipment number |  |
| POD reference |  |
| Receipt voucher |  |
| ERP export number |  |

### 10.1 Buyer enquiry

1. Sign in as `BUYER-A`.
2. Open `/b2b/enquiries/new`.
3. Add all three controlled product lines.
4. Enter quantities, delivery location, target price, and notes.
5. Submit once.
6. Retry the same submission if the UI supports retry simulation.

Expected:

- One enquiry is created.
- All three lines are preserved.
- Products and variants belong to the intended seller.
- Buyer sees only their enquiry.
- Repeated idempotent submission does not create a duplicate.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-001` | Enquiry created with three lines |  |  |

### 10.2 Seller quotation

1. Sign in to **1HandIndia Seller Hub** as `SELLER-A`.
2. Open the B2B enquiry.
3. Quote every line.
4. Add transport charge, ETA, and seller notes.
5. Submit the quotation.
6. Send one revised quotation.

Expected:

- Buyer sees the latest quotation and previous audit history.
- Totals equal line totals plus transport.
- Seller cannot see enquiries owned by another seller.
- Enquiry moves to `RESPONDED` or negotiation state.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-002` | Seller quotation and revision saved |  |  |

### 10.3 Negotiation and confirmation

1. Exchange buyer/seller messages.
2. Confirm the latest quotation as `BUYER-A`.
3. Attempt to confirm an older quotation.
4. Attempt seller quotation changes after confirmation.

Expected:

- Messages persist and remain role-scoped.
- Enquiry moves to `BUYER_CONFIRMED`.
- Older quotation confirmation is blocked.
- Seller quotation mutation is locked after confirmation.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-003` | Buyer confirms only the active quotation |  |  |

### 10.4 Admin approval and finalisation

1. Sign in as `ADMIN-A`.
2. Open `/admin/b2b-enquiries`.
3. Approve the buyer-confirmed enquiry.
4. Finalise it.
5. Open the generated B2B order.
6. Download the proforma through authenticated access.

Expected:

- Status progresses through `ADMIN_APPROVED` and `FINALISED`.
- One B2B order is created.
- Three immutable order lines are created.
- Proforma totals match the quotation.
- Buyer and seller snapshots are present.
- Direct unauthenticated proforma access fails.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-004` | `PROFORMA_ISSUED` |  |  |

### 10.5 Purchase order

1. Sign in as `BUYER-A`.
2. Open `/b2b/orders/[orderNumber]`.
3. Upload the controlled PO.
4. Enter the PO number and notes.
5. Submit.

Expected:

- File type and size are validated.
- PO file is private.
- PO number is stored.
- Status becomes `PO_SUBMITTED`.
- Buyer, owning seller, and admin can access the PO.
- Unrelated buyer and seller receive `403`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-005` | `PO_SUBMITTED` |  |  |

### 10.6 Structured PO review

1. Open `/admin/b2b-orders/[orderNumber]`.
2. Mark the order under review.
3. Complete each PO check:
   - Document match.
   - Price.
   - Quantity.
   - Delivery terms.
   - Stock.
   - Tax data.
   - Credit.
4. Save an approved review.

Expected:

- Status becomes `PO_UNDER_REVIEW`, then `PO_ACCEPTED`.
- Review actor, date, checks, notes, and exceptions persist.
- Missing checks can produce `CHANGES_REQUIRED`.
- Version mismatch returns `409`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-006` | `PO_ACCEPTED` |  |  |

### 10.7 Credit and payment terms

For the golden path, select `PREPAID_FULL`.

Expected:

- Credit decision is recorded.
- One payment schedule is created.
- Schedule amount equals buyer payable.
- Fulfilment remains gated until payment clearance.
- Status becomes `CREDIT_CLEARANCE_PENDING`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-007` | `CREDIT_CLEARANCE_PENDING` |  |  |

### 10.8 Razorpay or UPI payment

1. Sign in as `BUYER-A`.
2. Open the order payment schedule.
3. Click **Pay online** or **Pay by UPI**.
4. Complete a Razorpay test-mode captured payment.
5. Wait for server verification and refresh.

Expected:

- Provider order is created once.
- Browser receives only the public key and provider order data.
- Signature is verified on the backend.
- Provider payment amount, currency, order, and captured status are checked.
- Payment record becomes `CLEARED`.
- Payment schedule becomes `PAID`.
- Order paid amount updates exactly once.
- Receipt voucher is generated.
- Fulfilment unlocks to `IN_FULFILMENT`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-008` | `IN_FULFILMENT` |  |  |

### 10.9 Seller fulfilment plan

As `SELLER-A`, assign:

- Stock line: `AVAILABLE_STOCK`.
- Procurement line: `PROCURE`.
- Production line: `PRODUCE`.

Expected:

- Each line has one fulfilment plan.
- Available stock is reserved.
- Plan quantities match order quantities.
- Wrong seller cannot modify the plans.
- Duplicate request with the same idempotency key is safe.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-009` | Branches into procurement/production |  |  |

### 10.10 Procurement

1. Create the procurement order.
2. Record a partial receipt.
3. Confirm status `PARTIALLY_RECEIVED`.
4. Record the remaining receipt.
5. Close as received.

Expected:

- Ordered, received, and rejected quantities remain consistent.
- Received quantity cannot exceed ordered quantity.
- Expected date and supplier reference persist.
- Plan becomes ready only after required quantity is available.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-010` | Procurement completes |  |  |

### 10.11 Production

1. Create the production job.
2. Start production.
3. Record partial completion.
4. Record final completion.
5. Add material notes.

Expected:

- Planned, completed, and rejected quantities remain consistent.
- Completed quantity cannot exceed planned quantity.
- Production history remains visible.
- Plan becomes ready only after completion.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-011` | Production completes |  |  |

When all three lines are ready, expected order status:

```text
STOCK_READY
```

### 10.12 Picking

1. Create a pick task.
2. Start and complete it.
3. Confirm all requested quantities.
4. Review inventory movements.

Expected:

- Status progresses to `PICKING`.
- Reserved inventory is consumed once.
- Available stock decreases by the picked quantity.
- Concurrent second picking cannot consume the same reservation.
- Inventory movement references the B2B order line.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-012` | Picking completed |  |  |

### 10.13 Packing

1. Create and complete a pack task.
2. Create packages.
3. Record dimensions, weight, declared value, and line allocations.

Expected:

- Status progresses through `PACKING` to `QC_PENDING`.
- Package allocations do not exceed line quantities.
- Package numbers are unique.
- Package layout does not shift or overflow on mobile.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-013` | `QC_PENDING` |  |  |

### 10.14 Quality control

1. Create a QC inspection for each required package.
2. Complete the checklist.
3. Attach evidence where configured.
4. Mark inspections passed.

Expected:

- Inspector and timestamps persist.
- Closed inspection cannot be edited directly.
- All required QC inspections must pass.
- Status becomes `PACKED_AND_QC_PASSED`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-014` | `PACKED_AND_QC_PASSED` |  |  |

### 10.15 Final GST invoice

1. Issue the final invoice from Seller Hub.
2. Download it as buyer, seller, and admin.
3. Compare it with the order snapshots.

Expected:

- Invoice is not available before QC passes.
- Invoice number is seller-scoped.
- Buyer name, GSTIN, address, place of supply, HSN, quantities, values, and taxes are correct.
- Intrastate order contains CGST and SGST.
- Interstate variant contains IGST.
- Invoice is immutable after issue.
- Order becomes `TAX_INVOICE_ISSUED`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-015` | `TAX_INVOICE_ISSUED` |  |  |

### 10.16 E-invoice and e-way decision

Using manual or sandbox mode:

1. Record e-invoice result or explicit `NOT_REQUIRED`.
2. Record e-way result or explicit `NOT_REQUIRED`.
3. Include transport details.

Expected:

- Applicable documents require successful compliance status.
- Non-applicable documents require an explicit not-required decision.
- Provider error blocks dispatch.
- Duplicate IRN/e-way number is rejected.
- Status becomes `E_WAY_READY` or `E_WAY_NOT_REQUIRED`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-016` | E-way gate cleared |  |  |

### 10.17 Shipment preparation and assignment

1. Seller creates a shipment and assigns packages.
2. Enter transporter, LR/AWB, and vehicle data.
3. Admin assigns `DELIVERY-A`.

Expected:

- Shipment number is unique.
- Every assigned package belongs to the order and seller.
- Delivery user sees only assigned shipments.
- Assignment is visible in admin and delivery workspaces.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-017` | Shipment ready and assigned |  |  |

### 10.18 Dispatch and transit

1. Attempt dispatch with one required gate missing.
2. Confirm `422` blocker.
3. Correct the missing gate.
4. Dispatch.
5. Record in-transit events.

Expected:

- Dispatch requires invoice, compliance, package, transport, and payment gates.
- Status becomes `DISPATCHED`, then `IN_TRANSIT`.
- Shipment events are append-only and ordered.
- Buyer, seller, admin, and finance see the current status.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-018` | `IN_TRANSIT` |  |  |

### 10.19 Delivery and POD

1. Sign in as `DELIVERY-A`.
2. Record delivery attempt and delivered event.
3. Upload POD.
4. Record receiver name, phone, and delivery time.

Expected:

- POD is required before final delivery confirmation.
- POD is private and immutable.
- Status becomes `DELIVERED`.
- Acceptance deadline is calculated.
- Assigned delivery user can access the POD.
- Unassigned delivery user receives `403`.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-019` | `DELIVERED` |  |  |

### 10.20 Buyer acceptance and closure

1. Sign in as `BUYER-A`.
2. Download POD through authenticated access.
3. Accept delivery.

Expected:

- Shipment acceptance becomes `ACCEPTED`.
- All shipments must be accepted before order acceptance.
- Because the golden path is already paid, order becomes `CLOSED`.
- Settlement becomes `ELIGIBLE`.
- Settlement eligibility timestamp is recorded.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-020` | `CLOSED` and settlement eligible |  |  |

### 10.21 ERP and reconciliation

1. Open `/admin/b2b-integrations`.
2. Review queued lifecycle events.
3. Confirm delivery or replay failed events.
4. Generate CSV and JSON order exports.
5. Download both files.

Expected:

- Relevant events are delivered to active subscribed connections.
- Signatures validate at the receiver.
- Retries increase attempt count without duplicating the event ID.
- Dead-letter events can be replayed.
- Export jobs persist creator, filters, rows, hash, and completion status.
- Authenticated download works.
- CSV and JSON totals match the B2B order.

| Test ID | Expected status | Result | Evidence |
|---|---|---|---|
| `FLOW-021` | ERP delivery and exports verified |  |  |

## 11. Payment-Term Variants

Create separate orders for each term.

| Test ID | Term | Expected schedule behavior | Result |
|---|---|---|---|
| `PAY-001` | `PREPAID_FULL` | Full payment gates fulfilment |  |
| `PAY-002` | `ADVANCE_PERCENT` | Advance gates fulfilment; balance remains due |  |
| `PAY-003` | `MILESTONE` | Multiple schedules allocate in order |  |
| `PAY-004` | `NET_7` | Approved credit creates seven-day due date |  |
| `PAY-005` | `NET_15` | Approved credit creates fifteen-day due date |  |
| `PAY-006` | `NET_30` | Approved credit creates thirty-day due date |  |
| `PAY-007` | `NET_45` | Approved credit creates forty-five-day due date |  |
| `PAY-008` | Held credit | Fulfilment remains blocked |  |
| `PAY-009` | Expired override | Override no longer unlocks the order |  |
| `PAY-010` | Exposure exceeded | New credit approval returns `422` |  |

## 12. Payment Method Tests

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `PM-001` | Razorpay captured payment | Verified and allocated once |  |
| `PM-002` | UPI captured payment | Verified and allocated once |  |
| `PM-003` | Checkout dismissed | Order remains unpaid |  |
| `PM-004` | Provider payment failed | Payment is not allocated |  |
| `PM-005` | Authorized but not captured | Payment remains unallocated |  |
| `PM-006` | Invalid checkout signature | Request rejected |  |
| `PM-007` | Wrong amount | Request rejected |  |
| `PM-008` | Wrong currency | Request rejected |  |
| `PM-009` | Wrong provider order | Request rejected |  |
| `PM-010` | Duplicate verification callback | No duplicate allocation or receipt |  |
| `PM-011` | Same idempotency key and payload | Existing provider order reused |  |
| `PM-012` | Same idempotency key, different payload | `409` conflict |  |
| `PM-013` | Concurrent payments exceeding balance | Excess stored as unallocated |  |
| `PM-014` | Bank transfer proof | Finance verification required |  |
| `PM-015` | Cheque submitted | Remains uncleared until clearance |  |
| `PM-016` | Cheque bounced | Payment marked bounced; balance remains due |  |
| `PM-017` | Finance manual payment | Actor and audit history recorded |  |
| `PM-018` | Partial payment | Schedule and receivable become partial |  |
| `PM-019` | Payment after delivery acceptance | Order closes and settlement becomes eligible |  |

## 13. Multiple Shipment Tests

Create one order with at least two shipments.

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `SHIP-001` | Accept first shipment only | Entire order remains unaccepted |  |
| `SHIP-002` | Dispute second shipment | Order becomes delivery disputed |  |
| `SHIP-003` | Resolve and accept all shipments | Order becomes delivery accepted |  |
| `SHIP-004` | Paid order, all accepted | Order closes |  |
| `SHIP-005` | Unpaid Net order, all accepted | Remains delivery accepted until payment |  |
| `SHIP-006` | Package assigned to two shipments | Blocked |  |
| `SHIP-007` | Unassigned delivery user access | `403` |  |
| `SHIP-008` | Failed delivery event | Shipment remains operationally open |  |

## 14. Hold, Resume And Cancellation

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `CTRL-001` | Hold without reason | Validation error |  |
| `CTRL-002` | Hold allowed order | Status `ON_HOLD`; prior status preserved |  |
| `CTRL-003` | Resume held order | Prior valid status restored |  |
| `CTRL-004` | Stale version hold/resume | `409` |  |
| `CTRL-005` | Cancel before picking | Reservations released |  |
| `CTRL-006` | Cancel with procurement | Procurement records cancelled |  |
| `CTRL-007` | Cancel with production | Production records cancelled |  |
| `CTRL-008` | Cancel after picking/invoice | Blocked |  |
| `CTRL-009` | Cancel where buyer funds need refund | Blocked pending refund handling |  |
| `CTRL-010` | Cancellation ERP event | `order.cancelled` queued |  |

### 14.1 Order Amendments

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `AMD-001` | Buyer requests quantity change | Pending immutable amendment with before snapshot |  |
| `AMD-002` | Seller requests address change | Seller ownership and permission enforced |  |
| `AMD-003` | Duplicate pending amendment | `409` |  |
| `AMD-004` | Stale order version | `409` |  |
| `AMD-005` | Admin rejects amendment | Rejection reason and actor preserved |  |
| `AMD-006` | Admin approves pre-operation change | Lines/totals update and PO returns to review |  |
| `AMD-007` | Amendment after cleared funds | Commercial change blocked |  |
| `AMD-008` | Amendment after issued invoice | Blocked; use credit/debit note path |  |
| `AMD-009` | Line change after procurement/production/picking | Blocked |  |
| `AMD-010` | Reservation exists before approval | Reservation released exactly once |  |
| `AMD-011` | Payment terms changed | Schedules rebuilt from revised payable |  |
| `AMD-012` | Final amendment direct edit/delete | Database rejects mutation |  |

## 15. Inventory And Concurrency

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `INV-001` | Reserve available stock | Active reservation created |  |
| `INV-002` | B2C purchase consumes same stock concurrently | No overselling |  |
| `INV-003` | Two B2B orders reserve same final units | Only valid quantity succeeds |  |
| `INV-004` | Simultaneous pick completion | Reservation consumed once |  |
| `INV-005` | Cancel before picking | Stock released once |  |
| `INV-006` | Retry cancellation | No duplicate stock movement |  |
| `INV-007` | Procurement shortage | Line remains not ready |  |
| `INV-008` | Production rejection | Rejected quantity does not become ready stock |  |

## 16. QC And Dispatch Blockers

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `QC-001` | QC pass without package | Blocked where package is required |  |
| `QC-002` | QC failed | Order held; reason required |  |
| `QC-003` | QC held | Invoice unavailable |  |
| `QC-004` | Edit closed inspection | Database rejects edit |  |
| `QC-005` | Dispatch without invoice | `422` |  |
| `QC-006` | Dispatch without e-invoice result when applicable | `422` |  |
| `QC-007` | Dispatch without e-way result when applicable | `422` |  |
| `QC-008` | Dispatch without LR/AWB/transport details | `422` |  |
| `QC-009` | Dispatch with unpaid dispatch-gated schedule | `422` |  |

## 17. GST And Document Validation

Test at least:

- Intrastate registered buyer.
- Interstate registered buyer.
- Unregistered buyer.
- GST seller.
- Non-GST seller negative behavior.
- Credit/debit note linkage where an adjustment is required.

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `GST-001` | Intrastate supply | CGST and SGST; IGST zero |  |
| `GST-002` | Interstate supply | IGST; CGST and SGST zero |  |
| `GST-003` | Buyer GSTIN | B2B classification and recipient snapshot |  |
| `GST-004` | Missing seller GST data | Taxable fulfilment/invoice blocked |  |
| `GST-005` | Missing HSN/rate | Invoice blocked |  |
| `GST-006` | Non-GST seller | No GST charged; non-GST document treatment |  |
| `GST-007` | Invoice after QC only | Pre-QC issuance blocked |  |
| `GST-008` | Issued invoice mutation | Database rejects edit |  |
| `GST-009` | Duplicate IRN/e-way | Rejected |  |
| `GST-010` | Invoice PDF access | Only authorized roles can download |  |

## 18. POD Acceptance And Dispute

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `POD-001` | Delivery without POD | Blocked |  |
| `POD-002` | POD upload | Receiver and evidence stored |  |
| `POD-003` | Edit POD evidence | Database rejects edit |  |
| `POD-004` | Buyer accepts | Shipment accepted |  |
| `POD-005` | Buyer disputes with reason | Shipment and order disputed |  |
| `POD-006` | Buyer disputes without reason | Validation error |  |
| `POD-007` | Wrong buyer accesses POD | `403` |  |
| `POD-008` | Auto-accept after configured period | Undisputed shipment auto-accepted |  |
| `POD-009` | Disputed shipment reaches deadline | Not auto-accepted |  |
| `POD-010` | Buyer disputes delivery | Linked case created; receivable and settlement held |  |
| `POD-011` | Generic case closure before resolution | Blocked |  |
| `POD-012` | Partial acceptance | Accepted/rejected quantities equal disputed line quantity |  |
| `POD-013` | Full return, credit note, and refund | Revised payable, paid, and outstanding all reconcile to zero |  |
| `POD-014` | Credit-note-only resolution | Credit note linked to original invoice; receivable reduced |  |
| `POD-015` | Replacement resolution | New enquiry created and commercial checks rerun |  |
| `POD-016` | Edit final dispute resolution | Database rejects mutation |  |

## 19. Receivables And Collections

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `AR-001` | Invoice creates receivable | Original and outstanding amounts match |  |
| `AR-002` | Partial payment | Outstanding and entry balance reduce correctly |  |
| `AR-003` | Full payment | Receivable becomes paid and closes |  |
| `AR-004` | Current ageing | `CURRENT` |  |
| `AR-005` | 1-30 days overdue | `DAYS_1_30` |  |
| `AR-006` | 31-60 days overdue | `DAYS_31_60` |  |
| `AR-007` | 61-90 days overdue | `DAYS_61_90` |  |
| `AR-008` | More than 90 days | `DAYS_90_PLUS` |  |
| `AR-009` | Promise to pay | Date, note, actor persist |  |
| `AR-010` | Reminder worker | Reminder count and next time update |  |
| `AR-011` | Overdue state | Order/receivable become overdue without data loss |  |
| `AR-012` | Receipt download | Buyer and finance access; unrelated role blocked |  |

## 20. Support And Reorder

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `SUP-001` | Create shortage case | Links order and line |  |
| `SUP-002` | Create damage case | Links shipment and evidence |  |
| `SUP-003` | Create billing case | Links invoice/receivable/payment |  |
| `SUP-004` | Support updates case | Status and resolution persist |  |
| `SUP-005` | Support attempts finance mutation | `403` |  |
| `SUP-006` | Reorder closed order | New draft enquiry created |  |
| `SUP-007` | Reorder contents | Product references and quantities copied |  |
| `SUP-008` | Reorder validation | Price, stock, GST, credit, seller rechecked |  |

## 21. Seller Staff Permissions

| Test ID | Account | Allowed | Must be blocked | Result |
|---|---|---|---|---|
| `PERM-001` | `STAFF-SALES` | B2B sales/enquiry operations | Warehouse, procurement, finance mutation |  |
| `PERM-002` | `STAFF-WH` | Picking, packing, QC as configured | Credit and ERP settings |  |
| `PERM-003` | `STAFF-DISPATCH` | Shipment and dispatch actions | PO and credit decisions |  |
| `PERM-004` | Finance | Credit, AR, payment verification | Seller warehouse mutation |  |
| `PERM-005` | Delivery | Assigned shipment events and POD | Other shipments and finance |  |
| `PERM-006` | Support | B2B-linked cases | Payment, tax, credit mutation |  |

## 22. Ownership And Security

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `SEC-001` | Unrelated buyer reads order | `403` or not found |  |
| `SEC-002` | Unrelated seller reads order | `403` or not found |  |
| `SEC-003` | Seller sees buyer's unrelated profile data | Not exposed |  |
| `SEC-004` | Buyer sees seller credentials/settings | Not exposed |  |
| `SEC-005` | Normal anchor used for private download | Not present |  |
| `SEC-006` | Authenticated Blob download | Works with authorization header |  |
| `SEC-007` | ERP credentials readback | Secrets masked/not returned |  |
| `SEC-008` | Provider secret in logs | Never present |  |
| `SEC-009` | Invalid payload | Structured validation error |  |
| `SEC-010` | Stale version mutation | `409` |  |
| `SEC-011` | Duplicate transition | `409` or idempotent existing result |  |
| `SEC-012` | Native browser dialogs | None used |  |

## 23. API Contract Checks

For list endpoints, verify:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 25,
  "totalPages": 0
}
```

Verify:

- Default limit is 25.
- Maximum limit is 100.
- `page` and `limit` are numeric.
- Sorting is deterministic by `createdAt DESC, id DESC`.
- Search, status, seller, buyer, due-date, ageing, and exception filters work where applicable.

| Test ID | Scenario | Expected result | Result |
|---|---|---|---|
| `API-001` | String query `limit=25` | Parsed as integer; no Prisma string error |  |
| `API-002` | Limit over 100 | Clamped or rejected according to DTO |  |
| `API-003` | Invalid UUID | Validation error |  |
| `API-004` | Missing idempotency key | `400` |  |
| `API-005` | Stale version | `409` |  |
| `API-006` | Business blocker | `422` |  |
| `API-007` | Ownership failure | `403` |  |
| `API-008` | Creation response | `201` where configured |  |
| `API-009` | Action response | `200` |  |
| `API-010` | Error envelope | Contains status, code/message, and request trace where configured |  |

## 24. Worker Tests

### Collection worker

- Force a receivable due date into the past.
- Run or wait for the collection poll.
- Confirm ageing, overdue status, tasks, and reminder scheduling.
- Confirm the same task is not claimed twice.

### POD auto-accept worker

- Create one delivered, undisputed shipment past its acceptance deadline.
- Confirm auto-accept.
- Confirm the entire order accepts only when every shipment is accepted.
- Confirm settlement eligibility still requires cleared payment.

### ERP outbox worker

- Return HTTP 500 from the test ERP receiver.
- Confirm retry scheduling and attempt count.
- Restore HTTP 200.
- Confirm delivery and acknowledgement.
- Force maximum failures.
- Confirm dead-letter state and admin replay.

### Overdue worker

- Force payment due date into the past.
- Confirm overdue state.
- Submit a valid payment.
- Confirm payment can still clear and close the order.

| Test ID | Worker | Expected result | Result |
|---|---|---|---|
| `WORK-001` | Collection | Claim, reminder, and ageing correct |  |
| `WORK-002` | POD auto-accept | Correct shipment/order acceptance |  |
| `WORK-003` | ERP outbox | Retry, dead-letter, and replay correct |  |
| `WORK-004` | Overdue | Overdue and later payment recovery correct |  |
| `WORK-005` | Redis unavailable | DB/synchronous fallback remains operational |  |

## 25. UI And Responsive QA

Test these routes at desktop and mobile widths:

```text
/b2b/orders
/b2b/orders/[orderNumber]
/seller/b2b-orders
/seller/b2b-orders/[orderNumber]
/admin/b2b-orders
/admin/b2b-orders/[orderNumber]
/admin/b2b-exceptions
/admin/b2b-cases
/admin/b2b-integrations
/finance/b2b-receivables
/finance/b2b-orders/[orderNumber]
/delivery/b2b-shipments
/delivery/b2b-shipments/[shipmentId]
```

Verify:

- Loading skeletons.
- Empty states.
- API error states.
- Disabled states during mutations.
- Pagination.
- Long order numbers and company names.
- Long GSTIN/address values.
- Tables remain usable on small screens.
- Buttons do not overlap.
- Text does not overflow.
- Tooltips and labels are understandable.
- Keyboard focus is visible.
- Confirmation dialogs are branded.
- No native `confirm`, `alert`, or `prompt`.
- Brand colors remain `#ED3500` and `#FFFCFB`.

## 26. Financial Reconciliation

For each test order, calculate independently:

```text
Buyer payable
= product line totals
+ transport
+ applicable platform/buyer charges

Paid amount
= cleared payment allocations - verified refunds

Outstanding
= revised buyer payable - revised cleared funds

Revised buyer payable
= original buyer payable - approved credit-note/receivable adjustments

Seller payout eligibility
= delivery accepted AND required buyer payment cleared
```

Confirm:

- Sum of payment allocations never exceeds cleared payment amount.
- `unallocatedAmountPaise` explains any excess.
- Sum of schedule paid amounts equals allocated schedule payments.
- Receivable balance equals invoice balance minus allocated payments.
- Receipt amount equals the payment record amount.
- Seller settlement is not eligible early.
- Tax values match the immutable invoice.
- ERP CSV and JSON totals match the database and UI.

| Test ID | Reconciliation | Expected result | Result |
|---|---|---|---|
| `REC-001` | Order totals | Exact match |  |
| `REC-002` | Payment allocations | Exact match |  |
| `REC-003` | Receivable | Exact match |  |
| `REC-004` | GST components | Exact match |  |
| `REC-005` | Seller settlement | Correct eligibility and amount |  |
| `REC-006` | ERP exports | CSV/JSON match source records |  |
| `REC-007` | Detect cached balance drift | Reconciliation records `EXCEPTION` without mutation |  |
| `REC-008` | Correct cached balance drift | Order, schedules, and receivable match immutable records |  |
| `REC-009` | Full refund after full payment | Outstanding remains zero |  |
| `REC-010` | Reconciliation history edit/delete | Database rejects mutation |  |

## 27. Database Immutability Tests

Run only against the disposable database.

For one verified payment, issued invoice, closed QC inspection, POD, and receipt:

```sql
BEGIN;
-- Replace the placeholder with a disposable test record.
UPDATE b2b_payment_records
SET amount_paise = amount_paise + 1
WHERE id = 'PAYMENT_RECORD_UUID';
ROLLBACK;
```

Expected: the database rejects the update.

Repeat for:

- Provider order/payment identifiers.
- Issued tax document fields.
- Issued tax document lines.
- Closed QC evidence.
- POD evidence.
- Receipt voucher core fields.
- Final order amendments.
- Dispute resolutions.
- Financial reconciliation history.

The receipt file key may transition once from null to the generated file key. Later changes
must fail.

## 28. Failure Recovery

| Test ID | Failure | Expected recovery | Result |
|---|---|---|---|
| `FAIL-001` | API restarts during provider-order creation | Stale lock permits safe retry |  |
| `FAIL-002` | Browser closes after captured payment | Retry verification/webhook reconciles once |  |
| `FAIL-003` | Worker stops | Pending DB jobs remain recoverable |  |
| `FAIL-004` | ERP endpoint unavailable | Retry then dead-letter |  |
| `FAIL-005` | Private storage unavailable | Controlled error; no false document success |  |
| `FAIL-006` | Email unavailable | Core transaction remains valid; notification failure logged |  |
| `FAIL-007` | GST provider unavailable | Dispatch remains blocked; manual official result can be audited |  |
| `FAIL-008` | Concurrent lifecycle update | One succeeds; stale request gets `409` |  |

## 29. Performance Smoke Checks

Use controlled non-production data.

Verify:

- Order list with at least 100 records remains paginated.
- Receivables list with at least 100 records remains paginated.
- ERP outbox and export history remain paginated.
- One order with at least 25 lines loads without unbounded duplicate queries.
- CSV/JSON export completes within the approved operational timeout.
- API memory remains stable during repeated order-detail refreshes.
- No list endpoint loads every record into the browser.

Record response times:

| Operation | Records | Time | Result |
|---|---:|---:|---|
| Buyer order list |  |  |  |
| Seller order list |  |  |  |
| Admin exception queue |  |  |  |
| Finance receivables |  |  |  |
| ERP export |  |  |  |

## 30. Final Acceptance Checklist

### Database and migration

- [ ] Disposable database confirmed.
- [ ] Migration applies successfully.
- [ ] Migration is idempotent.
- [ ] Legacy lines and statuses backfill correctly.
- [ ] Foreign keys and indexes verified.
- [ ] Immutability triggers verified.

### Commercial workflow

- [ ] Multi-line enquiry tested.
- [ ] Revised quotation and negotiation tested.
- [ ] Buyer confirmation tested.
- [ ] Admin approval and finalisation tested.
- [ ] Proforma tested.
- [ ] PO upload and structured review tested.
- [ ] Credit and every payment-term type tested.
- [ ] Order amendment request, approval, rejection, and blockers tested.

### Fulfilment

- [ ] Inventory reservation tested.
- [ ] Procurement tested.
- [ ] Production tested.
- [ ] Picking and inventory consumption tested.
- [ ] Packing and packages tested.
- [ ] QC pass/fail/hold tested.

### Tax and dispatch

- [ ] Intrastate GST tested.
- [ ] Interstate GST tested.
- [ ] Final invoice gate tested.
- [ ] E-invoice decision tested.
- [ ] E-way decision tested.
- [ ] Dispatch blockers tested.

### Delivery and payment

- [ ] Shipment assignment tested.
- [ ] Transit events tested.
- [ ] POD and private access tested.
- [ ] Buyer acceptance and dispute tested.
- [ ] Partial acceptance, return/refund, credit note, replacement, and claim rejection tested.
- [ ] Multi-shipment acceptance tested.
- [ ] Razorpay tested.
- [ ] UPI tested.
- [ ] Bank transfer tested.
- [ ] Cheque clearance and bounce tested.
- [ ] Receipt voucher tested.

### Finance, support, ERP

- [ ] Receivable and ageing tested.
- [ ] Collection tasks and reminders tested.
- [ ] Payment allocations reconciled.
- [ ] Reconciliation exception detection and correction tested.
- [ ] Seller settlement gate tested.
- [ ] Support cases tested.
- [ ] Reorder tested.
- [ ] ERP signed webhook tested.
- [ ] ERP retry/dead-letter/replay tested.
- [ ] CSV and JSON export jobs tested.

### Security and UX

- [ ] Buyer isolation tested.
- [ ] Seller isolation tested.
- [ ] Staff permissions tested.
- [ ] Delivery assignment isolation tested.
- [ ] Private documents tested.
- [ ] Secrets absent from logs and responses.
- [ ] Mobile and desktop UI tested.
- [ ] Pagination and errors tested.
- [ ] No native browser dialogs found.

## 31. Sign-Off

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| QA lead |  |  |  |  |
| Engineering |  |  |  |  |
| Finance |  |  |  |  |
| GST practitioner |  |  |  |  |
| Operations |  |  |  |  |
| Product owner |  |  |  |  |

Production activation is approved only when:

- Every mandatory test is `PASS`.
- Every `BLOCKED` item has an approved owner and resolution.
- No critical or high-severity defect remains open.
- Database backup and rollback rehearsal is complete.
- Razorpay, GST/e-way, storage, email, and ERP provider checks pass.
- `B2B_ORDER_TO_CASH_V2_ENABLED` activation is approved for the pilot seller.
