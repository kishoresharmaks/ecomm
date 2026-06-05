# IndiHub Scope Change - Delivery Partner Wallet

Last updated: 2026-06-05

## Approved Scope

The delivery partner wallet is implemented for local delivery partners only.

Local delivery partners can see:

- Available wallet balance.
- Total local delivery earnings.
- Count of credited local deliveries.
- Manual payout or adjustment debits when admin finance uses them in future workflow.
- Ledger entries linked back to delivery orders and shipments.

## Earning Rule

The system credits a wallet entry when a local delivery partner shipment is marked `DELIVERED`.

The credit amount uses the shipment-level local delivery shipping fee already stored on the order shipment. The credit is idempotent per shipment, so repeating a delivered status update does not create duplicate earnings.

## Excluded From Wallet

Third-party courier shipments do not create delivery partner wallet earnings.

Third-party courier money remains part of courier-provider cost, COD remittance, provider settlement, and platform finance handling. It is not payable to an internal local delivery partner.

## Still Future Scope

The wallet does not yet include automated delivery partner payouts, mobile app payout screens, GPS proof, OTP proof, uploaded proof-of-delivery files, or third-party courier payout automation. Those remain separate future delivery operations scope.
