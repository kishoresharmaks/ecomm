# Seller Product Delivery Modes Implementation Progress

Last updated: 2026-07-13

## Progress

- [x] Database model and migration
- [x] Shared delivery mode types and validators
- [x] Product API DTO validation
- [x] Product create/update/readback persistence
- [x] Checkout seller-package delivery option filtering
- [x] Order placement package-level delivery validation
- [x] Seller web product mode selector
- [x] Customer web checkout package selector
- [x] Seller mobile product mode selector
- [x] Customer mobile checkout package selector
- [x] Admin product/order visibility
- [x] Targeted API/web/mobile tests
- [x] Verification commands documented
- [x] Checkout preference edge-case hardening

## Verification Run

- [x] `pnpm.cmd db:validate`
- [x] `pnpm.cmd run db:generate`
- [x] `pnpm.cmd --filter @indihub/api typecheck`
- [x] `pnpm.cmd --filter @indihub/api lint` passes with pre-existing warnings only.
- [x] `pnpm.cmd --filter @indihub/api test`
- [x] `pnpm.cmd --filter @indihub/web typecheck`
- [x] `pnpm.cmd --filter @indihub/mobile-seller typecheck`
- [x] `pnpm.cmd --filter @indihub/mobile-customer typecheck`

## Implementation Order

1. Backend data contract.
2. Product management API.
3. Checkout and order enforcement.
4. Web seller/customer UI.
5. Mobile seller/customer UI.
6. Tests and final verification.

## Edge Cases To Keep Green

- No product can have zero delivery modes.
- Stale checkout selections are rejected server-side.
- Multi-seller carts can choose different delivery modes per seller package.
- Mixed pickup and delivery carts require address only when needed.
- Store Pickup COD and Manual Transport COD keep seller cash receivable behavior.
- Courier/local delivery partner COD remain unchanged.
- Admin delivery overrides update shipment and package statuses together.

## Latest Bug Check

- Fixed checkout pricing so Store Pickup checkout only resolves product-enabled Store Pickup routes.
- Fixed checkout pricing so Deliver to Address checkout excludes Store Pickup routes.
- Added API regression coverage for product-enabled package modes filtered by checkout preference.
- Hardened checkout summary delivery selections to reject duplicate seller selections and oversized payloads.
