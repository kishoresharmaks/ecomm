# IndiHub Scope Change: Live Courier API Adapter - Shiprocket First

Date: 2026-05-31

## Decision

Live third-party courier API booking is approved as a product expansion over the earlier manual courier baseline.

The implementation must stay provider-portable:

- Keep courier integrations behind a generic adapter interface.
- Use Shiprocket as the first live provider adapter.
- Store provider credentials and endpoints in database-backed courier provider settings.
- Keep seller pickup mapping separate from provider code so future courier providers can be added without changing seller, order, or checkout workflows.
- Keep manual courier AWB entry available as fallback.

## Approved Operational Flow

- Checkout can route packages to an active third-party courier provider.
- Seller/admin marks package ready or packed.
- Admin/finance can book the package with the configured live courier adapter.
- Seller pickup location mapping is read from seller courier settings.
- Product/variant parcel fields are stored for weight and dimensions.
- Provider tracking webhooks continue to update package and order timelines through the existing courier webhook flow.

## COD Handling

Courier COD collection remains auditable through package-level courier COD remittance records.

For Shiprocket, COD remittance verification starts with provider report import and admin/finance verification. This avoids hardcoding an unstable provider-specific COD remittance API and keeps the finance workflow provider-portable.

## Selectable Related Full Implementations

These related areas are not excluded as generic future scope. If selected, each must be implemented as a complete production workflow:

- Delivery partner mobile app.
- Live GPS tracking.
- Delivery OTP.
- Proof-of-delivery media capture.
- Automated delivery partner payouts.
- Automated seller payouts through RazorpayX or another payout provider.

## Third-Party Responsibility

Shiprocket account approval, wallet balance, pickup-location approval, charges, serviceability, SLA, and production credentials are provider/client responsibilities and are separate from development effort.
