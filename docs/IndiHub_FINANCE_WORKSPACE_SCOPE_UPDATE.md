# 1HandIndia Finance Workspace Scope Update

Last updated: 2026-05-26

> Historical scope update note. As of 08-06-2026, active work follows `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`; selected finance/payment/payout features must be implemented completely rather than treated as Phase 1-only.

## Decision

The product includes a separate finance workspace at `/finance`.

This is a finance operations workspace. RazorpayX payout automation, automated bank reconciliation, and delivery partner payout automation are selectable expansion areas; if selected, they must be implemented as complete provider-backed workflows.

## Access Model

- `ADMIN` users can access both `/admin` and `/finance`.
- `FINANCE` / Finance Manager users can access `/finance` only.
- Finance Manager users cannot access customer management, seller approval, product approval, CMS, categories, general platform settings, user/role management, or other full-admin routes.
- Finance Manager sign-in uses the standalone back-office email/password session, not Clerk customer/seller/B2B auth.

## Included Modules

- Finance dashboard for COD pending, COD collected, bank transfer pending, manual pending, online paid, settlement due, payout pending, payout paid, and recent payment activity.
- COD collections queue with delivery-partner collected amount/date/note and finance verification.
- Bank transfer verification queue with customer UTR/reference, configured platform bank/UPI details, approve/reject actions, and payment status update.
- Payment status control for COD, bank transfer, manual, and Razorpay payment records.
- Seller settlements, payouts, ledger, statements, and commission rules through finance-only navigation.
- Payment reports grouped by payment provider, payment status, COD collection status, settlement status, and payout status.
- Payment settings for Razorpay readiness, COD, manual payment, bank transfer bank/UPI details, bank transfer instructions, and checkout platform fee.

## Payment Flow

- Razorpay: checkout/payment verification or webhook marks successful online payments as paid.
- COD: order starts pending; delivery partner marks amount collected; finance/admin verifies collected cash; order/payment become paid.
- Bank transfer: order starts pending; customer enters UTR/reference; finance/admin verifies receipt; order/payment become paid.
- Manual payment: order starts pending; finance/admin verifies manual payment reference; order/payment become paid.
- Seller settlement/payout eligibility continues to use delivered orders with verified paid/not-required payment state.

## Audit And Concurrency Rules

- Finance verification uses status-checked updates so stale concurrent verification cannot double-apply payment changes.
- All finance verification, configuration, payout, settlement, ledger, and sensitive role/password actions create audit logs.
- Back-office password setting is available only from Admin Users & Roles and only for users assigned `ADMIN` or `FINANCE`.

## Verification Targets

- Finance Manager login succeeds.
- Finance Manager can access `/api/admin/finance/*`, `/api/admin/payments/*`, and `/api/admin/settings/checkout/platform-fee`.
- Finance Manager receives `403` on normal admin-only APIs such as users, products, and general settings.
- Bank transfer settings appear in checkout, customer reference is stored on the payment record, finance queue shows it, and finance verification marks the payment/order paid.
- COD remains pending until delivery collection is verified from finance/admin.

## Implementation Verification

- 2026-05-26: Finance Manager login/access, finance-only route/API restrictions, bank-transfer checkout reference capture, offline finance verification, payment reports, and guarded finance UI were implemented.
- Verification passed: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, API typecheck/lint/test/build, web typecheck/lint/test/build, and source scan for native `confirm`/`alert`/`prompt` calls.
- API tests passed with 18 test files and 69 tests. Web tests passed with 1 test file and 2 tests.
