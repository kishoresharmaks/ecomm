# IndiHub Courier Workspace Scope Change

Date: 2026-06-04

## Approved Change

Add a dedicated back-office courier and delivery operations workspace at `/courier`.

This workspace is separate from:

- `/delivery`, which remains for field delivery partners handling assigned deliveries.
- `/finance`, which remains responsible for payment verification, settlements, payouts, and final COD verification.
- `/admin`, which remains the full platform control panel.

## Access Boundary

- `ADMIN` can access `/courier`.
- `COURIER_MANAGER` can access `/courier`.
- `COURIER_MANAGER` must not access full admin-only, finance payout, seller, or customer areas.

## Operational Scope

The courier workspace covers:

- Logistics dashboard.
- Package-level courier operations.
- Package label access through backend-proxied endpoints.
- Routing failure queue and manual overrides.
- Local delivery assignment oversight.
- Local delivery partner operational profile management.
- Courier provider setup, including Shiprocket.
- Courier COD remittance recording/import handoff.

Seller responsibilities stay limited to packing, readiness, label download/print, and tracking for their own packages. Courier managers control booking and provider operations. Customers see tracking only.

## Delivery Partner Management Boundary

Courier managers can manage only delivery operations data for users who already have the `DELIVERY_PARTNER` role:

- Phone and vehicle number.
- Availability and assignment priority.
- Country, state, city, pincode, and local-area service coverage.
- Base latitude, base longitude, and service radius.
- COD cash limit and operational notes.
- Read-only active workload, COD exposure, assignment readiness, and profile/coverage warnings.

Courier managers cannot create users, delete users, assign or remove roles, set passwords, disable platform user accounts, or verify finance COD/payment records. Those remain Admin/Finance responsibilities.

## Deployment Note

The migration adding `COURIER_MANAGER` was deployed after explicit approval on 2026-06-04. Delivery partner management did not require a new schema migration because it reuses the existing `DeliveryPartnerProfile` model.
