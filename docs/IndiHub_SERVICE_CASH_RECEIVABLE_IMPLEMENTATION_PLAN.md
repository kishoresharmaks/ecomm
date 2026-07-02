# 1HandIndia Service Cash Receivable Implementation Plan

**Area:** Service marketplace payments, seller finance, admin finance, reports  
**Status:** Stage 1 schema foundation started  
**Last updated:** 2026-07-01

## Purpose

Service bookings can be paid partly online and partly at visit. Online money is collected by the platform and can enter seller payout calculation. Cash collected directly by the service provider is different: the seller already has that money, so it must not be credited to seller wallet or payout. Instead, the platform commission, GST on commission, TDS/TCS, and platform fee become a seller receivable owed back to the platform.

## Accounting Rules

1. Platform-collected payments use `collectionType = PLATFORM_ONLINE` or `PLATFORM_OFFLINE` and `settlementTreatment = PAYOUT_ELIGIBLE`.
2. Provider-collected cash uses `collectionType = PROVIDER_CASH` and `settlementTreatment = PLATFORM_RECEIVABLE`.
3. Provider cash reduces the customer's due amount only after customer confirmation or admin verification.
4. Provider cash does not increase seller wallet balance and does not create seller payout eligibility.
5. Receivable tax and fee amounts are provisional while cash is only recorded. They become accrued after admin verification. Rejected or reduced cash entries must create reversal events.
6. Waivers require approval status, approval actor, amount limit, and event history.
7. Payout offset is configurable per receivable: manual-only, auto-offset from next payout, or hold payout until receivable is settled.

## Gap Closure

| Gap | Solution |
|---|---|
| Duplicate cash records after retry | Use `ServicePayment.idempotencyKey`, `cashCollectionEventId`, and `attemptNumber`; unique indexes are scoped to booking and seller. |
| Thin dispute resolution | Use explicit `ServiceCashDisputeResolution` values and append-only `ServiceSellerReceivableEvent` rows for partial accept, reject, force confirm, and reopen actions. |
| Partial cash plus partial online | Keep many `ServicePayment` rows per booking and many `ServiceSellerReceivable` rows per booking/payment. Do not make receivable one-to-one with booking. |
| Tax timing ambiguity | Keep `taxAccrualStatus`, `taxAccruedAt`, and `taxReversedAt`; reports must separate provisional from accrued receivables. |
| Waiver control gaps | Store `waiverApprovalStatus`, requested/approved actor timestamps, `waiverLimitPaise`, `waivedPaise`, and waiver events. |
| Seller wallet negative balance or offset | Store `offsetPolicy`, `payoutOffsetId`, `offsetScheduledAt`, `offsetAppliedAt`, and `offsetPaise`. Stage 3 will decide auto-offset behavior per seller cohort. |

## Shippable Stages

### Stage 1 - Data Model Foundation

Done in this pass:

- Add collection and settlement classification to `ServicePayment`.
- Add cash collection status, idempotency, event id, actor, verification, and dispute fields to `ServicePayment`.
- Add `ServiceSellerReceivable` for platform receivables owed by service sellers.
- Add `ServiceSellerReceivableEvent` for audit and reconciliation.
- Generate Prisma client and validate type safety.

No behavior change is introduced in Stage 1. Existing rows default to platform-collected and payout-eligible.

### Stage 2 - Cash Recording and Visibility

Implement these APIs:

- `POST /api/seller/service-bookings/:bookingNumber/cash-collections`
- `POST /api/account/service-bookings/:bookingNumber/cash-collections/:paymentId/confirm`
- `POST /api/account/service-bookings/:bookingNumber/cash-collections/:paymentId/dispute`
- `GET /api/admin/service-receivables`
- `GET /api/admin/service-receivables/:receivableNumber`
- `POST /api/admin/service-receivables/:receivableNumber/resolve`

UI surfaces:

- Seller booking detail: record cash collected, show event id, pending customer/admin confirmation, and receivable warning.
- Customer booking detail: show remaining due, online pay button for due amount, confirm cash paid, dispute cash amount.
- Admin service booking detail: show payment split, cash collection timeline, receivable status, dispute controls.
- Finance workspace: list provisional/open/disputed/waived receivables without changing payout math yet.

### Stage 3 - Settlement, Payout, Reports

Implement behind a seller cohort feature flag and run shadow calculations before cutover:

- Exclude `PROVIDER_CASH` from seller payout gross sales.
- Create/open receivables for platform deductions owed on provider cash.
- Auto-offset eligible open receivables from next payout only if the seller policy allows it.
- Show cash receivables separately in seller wallet, admin finance, finance reports, and seller statements.
- Generate ledger entries for receivable open, reversal, settlement, waiver, and offset events.

## Report Mapping

Seller reports:

- Online earnings: platform-collected, payout-eligible.
- Cash collected by provider: tracked separately, not wallet credit.
- Platform receivable due: open/accrued amount owed to platform.
- Waived/reversed/settled receivables: separate lines.

Admin and finance reports:

- Provisional receivables.
- Accrued open receivables.
- Disputed receivables.
- Waivers by actor and amount.
- Offsets scheduled/applied.
- Aging report by seller and booking.

## Implementation Guardrails

- Do not mark provider cash as seller payout money.
- Do not accrue tax finally until admin verification or an accepted customer confirmation policy is chosen.
- Do not waive receivables without approval actor, note, and amount limit snapshot.
- Do not auto-offset payouts until Stage 3 shadow mode shows acceptable differences against current settlement math.
- All sensitive actions must write audit logs and receivable events.
