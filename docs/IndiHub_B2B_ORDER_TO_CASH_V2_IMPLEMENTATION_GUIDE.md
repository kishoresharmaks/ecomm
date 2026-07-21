# 1HandIndia B2B Order-to-Cash V2 Implementation Guide

**Last updated:** 21-07-2026  
**Code status:** Implemented and passing safe automated verification  
**Production status:** Disabled until migration, browser QA, and provider validation are complete

## 1. Scope

B2B Order-to-Cash V2 covers:

- Multi-line enquiries, quotations, purchase orders, sales orders, and invoices.
- Structured PO review and buyer credit decisions.
- Prepaid, advance, milestone, and Net-7/15/30/45 payment terms.
- Stock reservation, procurement, production, picking, packing, and QC.
- GST invoice and e-way readiness gates before dispatch.
- Shipment assignment, tracking, POD, buyer acceptance, and disputes.
- Receivables, ageing, collections, payment allocation, and receipt vouchers.
- Derived line progress for mixed stock, procurement, production, and partial shipments.
- Immutable order amendments with admin approval and operational/payment safeguards.
- Structured delivery-dispute outcomes with credit notes, refunds, replacements, and holds.
- Finance reconciliation from immutable allocations, refunds, and receivable adjustments.
- Support cases, reorder, seller staff permissions, and generic ERP integration.

The feature remains behind:

```env
B2B_ORDER_TO_CASH_V2_ENABLED="false"
```

Do not enable it in production before completing the rollout checks in this guide.

## 2. Online B2B Payments

The buyer portal supports:

- Razorpay Checkout for configured online payment methods.
- A UPI-focused Razorpay Checkout.
- Payment against a specific outstanding schedule.
- Idempotent provider-order creation.
- Server-side checkout-signature verification.
- Provider-side payment lookup and amount, currency, and order verification.
- Allocation only after the provider reports a captured payment.
- Receipt-voucher creation and ERP events after allocation.

The implementation uses the existing admin-managed Razorpay configuration from
`/admin/payments`. No provider secret is returned to the browser.

### Buyer endpoints

```text
POST /api/b2b/v2/orders/:orderNumber/payments/online/order
POST /api/b2b/v2/orders/:orderNumber/payments/online/verify
```

Both endpoints require authentication and an `Idempotency-Key` header.

The generic buyer payment-record endpoint rejects unverified Razorpay and UPI records. Buyers
must use the online-payment endpoints.

### Payment integrity

- Provider order IDs and payment IDs are unique.
- Concurrent provider-order creation uses a recoverable database lock.
- Captured payments are allocated to the requested schedule first.
- Any concurrent excess remains in `unallocatedAmountPaise` for finance review.
- Verified payment financial fields are immutable at database level.
- Browser success alone never marks the order paid.

## 3. ERP Export Jobs

Admin ERP operations now persist every B2B order export with:

- Export number.
- CSV or JSON format.
- Applied filters.
- Completion status.
- File name and content type.
- Row count.
- SHA-256 content hash.
- Generating administrator.
- Completion time or failure message.

### Admin endpoints

```text
GET  /api/admin/b2b-integrations/exports
POST /api/admin/b2b-integrations/exports/orders?format=csv
POST /api/admin/b2b-integrations/exports/orders?format=json
GET  /api/admin/b2b-integrations/exports/:jobId/download
```

The legacy authenticated download endpoint remains compatible, but it now creates a persisted
export job before returning the file:

```text
GET /api/admin/b2b-integrations/exports/orders?format=csv|json
```

The admin interface at `/admin/b2b-integrations` provides export generation, history,
pagination, integrity-hash preview, and authenticated downloads.

## 4. Exception-Path Controls

- Buyer and seller amendments preserve before/after snapshots and require order `version`.
- Commercial amendments are blocked after cleared funds, issued invoices, or downstream work.
- Approved amendments release reservations, rebuild schedules, and return the PO to review.
- Delivery disputes automatically hold receivables and seller settlement.
- Delivery cases cannot be closed through the generic case action before structured resolution.
- Resolution supports full/partial acceptance, replacement, return/refund, credit note, or rejection.
- Credit notes remain linked to the issued B2B invoice and cannot exceed its remaining value.
- Refund and adjustment balances are derived from revised payable minus revised cleared funds.
- Finance can detect or correct cached order, schedule, and receivable balance drift.
- Amendment, dispute-resolution, and reconciliation history is immutable at database level.

## 5. Main Code Locations

| Area | File |
|---|---|
| B2B lifecycle and payment allocation | `apps/api/src/b2b/b2b-operations.service.ts` |
| B2B V2 API routes | `apps/api/src/b2b/b2b-operations.controller.ts` |
| B2B DTO validation | `apps/api/src/b2b/dto/b2b-operations.dto.ts` |
| Razorpay provider adapter | `apps/api/src/payments/payments.service.ts` |
| Buyer operations UI | `apps/web/src/components/b2b/b2b-v2-operations-panel.tsx` |
| Admin ERP UI | `apps/web/src/components/admin/admin-b2b-integrations-client.tsx` |
| B2B web API client | `apps/web/src/lib/b2b-operations-api.ts` |
| Razorpay Checkout helper | `apps/web/src/lib/razorpay-checkout.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Additive V2 migration | `prisma/migrations/20260721120000_complete_b2b_order_to_cash/migration.sql` |
| Exception hardening migration | `prisma/migrations/20260721190000_b2b_exception_path_hardening/migration.sql` |

## 6. Safe Verification Completed

No database writes were performed during this verification.

- Prisma schema validation passed.
- API typecheck and production bundle passed.
- API tests: 429 passed and 30 skipped.
- Worker typecheck, lint, tests, and build passed.
- Worker tests: 11 passed.
- Web typecheck, lint, tests, and production build passed.
- Web tests: 139 passed.
- Focused B2B operations tests: 10 passed.
- Focused tax-document tests: 21 passed.

Linters report no new errors. Existing unrelated warnings remain in older files.

## 7. Required Migration Procedure

Use only a disposable PostgreSQL database whose name contains `test`, `e2e`, or
`integration`.

Do not run migration testing against the currently connected protected database.

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/indihub_b2b_integration"
$env:DIRECT_URL=$env:DATABASE_URL
$env:INDIHUB_ALLOW_INTEGRATION_TEST_DB="true"

pnpm.cmd db:validate
pnpm.cmd db:generate
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate status --schema prisma/schema.prisma
```

Validate:

- Legacy single-line records backfill into one V2 line.
- Legacy payment proofs backfill into payment records.
- Required indexes and foreign keys exist.
- Verified payment fields reject direct edits.
- Receipt, POD, and QC immutability triggers work.
- Amendment, dispute-resolution, and reconciliation immutability triggers work.
- Provider order/payment uniqueness works.
- ERP export content and hashes persist correctly.

## 8. Production Activation

1. Revoke and replace any credential previously displayed in the IDE.
2. Test the migration on an approved disposable database.
3. Configure Razorpay test credentials through `/admin/payments`.
4. Run a captured test-mode B2B Razorpay payment.
5. Run a captured UPI test-mode B2B payment.
6. Confirm schedule allocation, receipt generation, receivable balance, and ERP events.
7. Complete browser QA across buyer, seller, admin, finance, delivery, and support roles.
8. Validate GST/e-invoice, e-way, storage, email, and ERP provider contracts.
9. Pilot one approved seller and reconcile stock, tax, AR, payments, and settlement totals.
10. Enable `B2B_ORDER_TO_CASH_V2_ENABLED` only after sign-off.

## 9. Remaining External Validation

Code implementation is complete for the selected internal workflow. These production gates
remain external or environment-dependent:

- Disposable-database migration execution.
- Browser-level end-to-end QA.
- Real Razorpay test-mode transaction and webhook validation.
- GST/e-invoice and e-way provider sandbox validation.
- Private storage and email provider validation.
- ERP receiver acknowledgement, retry, and replay validation.
- GST practitioner and finance-team sign-off.
