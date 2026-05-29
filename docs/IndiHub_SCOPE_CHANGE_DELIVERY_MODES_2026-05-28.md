# Delivery Mode Scope Change - 2026-05-28

## Approved Platform Delivery Modes

Phase 1 delivery mode selection is restricted to three modes:

- `STORE_PICKUP` - customer collects from the seller/store after pickup confirmation.
- `LOCAL_DELIVERY_PARTNER` - internal/local delivery partner workflow with automatic assignment after the order is packed.
- `THIRD_PARTY_COURIER` - external courier service workflow for providers such as BlueDart, Shiprocket, or similar services.

## Removed From User-Facing Operations

- Seller self delivery is no longer offered as a delivery mode.
- Manual courier is renamed in application code to third-party courier service.

## Operational Rules

- Auto-assignment is allowed only for `LOCAL_DELIVERY_PARTNER` orders after delivery reaches `PACKED`.
- Store pickup and third-party courier orders must remain unassigned from local delivery partner workload.
- Third-party courier tracking remains manual in Phase 1; live courier API integrations are future scope.
- Existing database rows using the previous courier storage value remain readable through the `THIRD_PARTY_COURIER` application enum mapping.
