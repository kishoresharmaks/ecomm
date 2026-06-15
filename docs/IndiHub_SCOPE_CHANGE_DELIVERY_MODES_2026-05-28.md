# Delivery Mode Scope Change - 2026-05-28

## Approved Platform Delivery Modes

The current delivery mode selection supports three modes:

- `STORE_PICKUP` - customer collects from the seller/store after pickup confirmation.
- `LOCAL_DELIVERY_PARTNER` - internal/local delivery partner workflow with automatic assignment after the order is packed.
- `THIRD_PARTY_COURIER` - external courier service workflow for providers such as BlueDart, Shiprocket, or similar services.

## Removed From User-Facing Operations

- Seller self delivery is no longer offered as a delivery mode.
- Manual courier is renamed in application code to third-party courier service.

## Operational Rules

- Auto-assignment is allowed only for `LOCAL_DELIVERY_PARTNER` orders after delivery reaches `PACKED`.
- Store pickup and third-party courier orders must remain unassigned from local delivery partner workload.
- Third-party courier tracking currently supports manual/provider-tracking data. If live courier API integration is selected, implement booking, tracking, webhook, failure, and admin visibility end to end.
- Existing database rows using the previous courier storage value remain readable through the `THIRD_PARTY_COURIER` application enum mapping.
