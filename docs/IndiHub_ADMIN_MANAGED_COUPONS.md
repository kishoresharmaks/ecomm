# 1HandIndia Admin-Managed Coupons

**Status:** Implemented  
**Scope:** B2C storefront checkout orders only  
**Redis dependency:** None

## Purpose

Coupons let admins create buyer discounts that customers can apply during cart or checkout. The discount is validated on the API, recalculated inside the order transaction, and stored on the order, order item, seller split, coupon redemption, and finance snapshots.

## Core Rules

- Admins create and manage coupon campaigns from `/admin/coupons`.
- Customers can apply one coupon per B2C order.
- Coupon codes are uppercase-normalized and must match `A-Z`, `0-9`, `_`, or `-`, with length `3-32`.
- Product deals are applied first. Coupons are calculated after deal pricing.
- Minimum and maximum subtotal checks use post-deal eligible merchandise subtotal.
- Platform fee is calculated after the coupon merchandise discount.
- Free-shipping coupons are platform-funded only and do not waive COD surcharge.
- Coupon validation is authenticated and returns generic invalid-code errors.
- The app uses local per-process rate limiting as a secondary guard. Shared rate protection should remain at Nginx/CDN.

## Funding Behavior

### Platform-Funded Coupons

Platform-funded coupons reduce what the customer pays. They do not reduce seller settlement or payout.

Snapshots are stored on:

- `Order`
- `OrderItem`
- `OrderSellerSplit`
- `CouponRedemption`

### Seller-Funded Coupons

Seller-funded coupons reduce the affected seller payout. Sellers must accept participation before their products are eligible.

Seller-funded deductions appear through:

- Seller coupon participation page: `/seller/coupons`
- Seller order detail deduction rows
- Seller settlement calculation
- Seller payout approval ledger entries as `COUPON_DISCOUNT`
- Seller statements and payout calculations through the settlement snapshot

Accepted seller participation is locked once a coupon has any redemption. Admin removal affects future eligibility only; old redemptions and payout deductions stay unchanged.

## Admin Workflow

1. Open `/admin/coupons`.
2. Create a coupon with code, title, discount type, funding source, eligibility, dates, and limits.
3. For seller-funded coupons, select eligible sellers.
4. Wait for seller consent where required.
5. Activate the coupon.
6. Monitor redemptions from the coupon detail panel.
7. Pause or archive when the campaign ends.

## Seller Workflow

1. Open `/seller/coupons`.
2. Review connected seller-funded campaigns.
3. Accept or decline participation.
4. Track accepted campaign redemptions and seller-funded deductions.

Sellers cannot create, edit, activate, pause, archive, or delete coupons.

## Customer Workflow

Customers can apply or remove a coupon from:

- `/cart`
- `/checkout`

Coupon savings are shown as a separate discount row. After the order is placed, the locked coupon amount is visible in:

- Order success page
- Customer order detail page
- Public order tracking page

## Cancellation Rules

- Full unpaid and unfulfilled cancellation reverses the redemption and releases coupon usage.
- Paid/refund scenarios create `CouponRedemptionAdjustment` rows.
- Coupon eligibility is not recalculated after cancellation. Only original allocations are adjusted.
- Free-shipping reversal follows the existing shipping refund policy. Non-refundable shipping adjustments record `SHIPPING_NON_REFUNDABLE`.

## Scale Hardening

Coupon validation and redemption remain PostgreSQL-only. Redis is not required for coupons.

- Order placement no longer increments or locks the wide `Coupon` campaign row on every redemption.
- Hot campaign usage is stored in `CouponUsageCounter`, a narrow row keyed by `couponId`.
- Total usage limits lock only the counter row with `FOR UPDATE SKIP LOCKED`; if the counter is busy, the customer is asked to retry instead of blocking the order worker queue.
- Coupons without a total usage limit use atomic counter increments without a pre-lock.
- Customer rows are locked only when the coupon uses per-customer limits or first-order-only logic.
- Checkout preview uses a 30-second process-local metadata cache for read-only coupon configuration. Usage-limit checks still read the current counter, and final order placement always revalidates inside the order transaction.
- `isMarketplaceWide` short-circuits eligibility table checks for unrestricted platform-funded coupons.
- Redemption history supports cursor pagination through `nextCursor`, backed by an index on `(couponId, createdAt DESC, id DESC)`.
- `CouponRedemption` remains the audit ledger. Hot-path counts and discount totals use `CouponUsageCounter`.

## API Surface

Admin endpoints:

- `GET /api/admin/coupons`
- `POST /api/admin/coupons`
- `GET /api/admin/coupons/:id`
- `PATCH /api/admin/coupons/:id`
- `POST /api/admin/coupons/:id/activate`
- `POST /api/admin/coupons/:id/pause`
- `POST /api/admin/coupons/:id/archive`
- `GET /api/admin/coupons/:id/redemptions`

Seller endpoints:

- `GET /api/seller/coupons`
- `POST /api/seller/coupons/:id/accept`
- `POST /api/seller/coupons/:id/decline`

Checkout integration:

- `GET /api/cart/checkout-summary?couponCode=CODE`
- `POST /api/orders/checkout` with `couponCode`

## Deployment Notes

Apply the Prisma migration before enabling coupons in production:

```powershell
npx.cmd prisma migrate deploy
pnpm.cmd run db:generate
```

Then verify:

```powershell
pnpm.cmd db:validate
pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api test
pnpm.cmd --filter @indihub/api build
pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web test
pnpm.cmd --filter @indihub/web build
```

Do not run DB-writing migration commands against staging or production unless the target database is confirmed.
