# Smart Delivery Routing Scope Change - 2026-05-28

## Approved Change

The delivery system is upgraded from manual mode selection into a smart routing and shipping charge foundation.

Customer checkout now exposes only:

- `STORE_PICKUP`
- `DELIVER_TO_ADDRESS`

The backend resolves the operational mode:

- `STORE_PICKUP`
- `LOCAL_DELIVERY_PARTNER`
- `THIRD_PARTY_COURIER`

## Operational Rules

- Store pickup has no shipping charge.
- Deliver-to-address checks eligible local delivery partners first.
- Local partner matching uses service-area specificity, partner priority, active workload, COD exposure, and assignment history.
- Partners who rejected the same order are skipped for automatic re-assignment.
- If no local partner is eligible, routing falls back to an active courier provider such as XpressBees when the destination country is configured as serviceable.
- If no courier provider can serve the address, the order is marked as a routing failure for admin action.
- Shipping and COD surcharge values are stored as immutable order/delivery snapshots.

## Admin Controls

- Admins can manage shipping rate cards.
- Admins can enable provider-ready courier settings for XpressBees.
- Admins can run a routing simulator that uses the same backend routing engine as checkout.
- Rate card edits affect only future orders; old orders retain snapshots.

## Provider Boundary

XpressBees is represented behind a provider-ready configuration model. Live booking, AWB generation, label download, cancellation, and signed tracking webhooks can be added through the same provider boundary once real account credentials and account-specific API details are available.
