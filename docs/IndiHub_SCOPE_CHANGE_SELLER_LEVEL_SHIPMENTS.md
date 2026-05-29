# IndiHub Scope Change - Seller-Level Shipments

Date: 2026-05-28

## Decision

1HandIndia keeps one customer order and one payment for checkout, but delivery operations must support one seller-level package per seller in the order.

## Reason

The platform does not maintain a central warehouse. In a multi-seller order, each seller fulfils from their own location, so logistics cannot be treated as one physical package.

## Operating Model

- Customer places one order and pays once.
- The order is split by seller using `OrderSellerSplit`.
- Each seller split receives one `OrderShipment` package.
- Seller, delivery, and courier statuses can be managed per package.
- Order-level delivery status remains a rollup for customer account, admin lists, reports, and notifications.

## Example

If a customer buys from Seller A and Seller B:

- Order: `1HI...`
- Shipment: `1HI...-S01` for Seller A
- Shipment: `1HI...-S02` for Seller B

This keeps customer checkout simple while allowing seller-wise dispatch, courier assignment, delivery tracking, and settlement readiness.
