# 1HandIndia Delivery Architecture (End-to-End)

This document provides a comprehensive overview of how order delivery is processed across all supported delivery modes within the 1HandIndia platform. It serves as the single source of truth for the end-to-end delivery lifecycle.

---

## Supported Delivery Modes

The platform supports 4 distinct delivery modes (defined in `DeliveryMode` enum):

1. **`LOCAL_DELIVERY_PARTNER`**: Hyperlocal delivery by gig-economy riders (Zomato/Swiggy style).
2. **`MANUAL_COURIER` (Third-Party Courier)**: National/Regional shipping via integrated logistics providers (e.g., Shiprocket, Delhivery).
3. **`STORE_PICKUP`**: Customer collects the item directly from the seller's physical store.
4. **`MANUAL_TRANSPORT`**: B2B freight or self-arranged heavy transport.

---

## 1. Local Delivery Partner (Hyperlocal)

This mode is designed for fast, local deliveries within a specific radius (e.g., same city).

### Lifecycle End-to-End

1. **Checkout & Routing**: 
   - The routing engine checks the distance between the seller and the customer. If within the supported local radius, `LOCAL_DELIVERY_PARTNER` is selected.
   - The order enters the `PENDING` delivery state.
2. **Seller Packing**: 
   - The seller views the order in the Seller Portal and begins processing.
   - Once the items are boxed, the seller marks the order as `PACKED`.
   - The API instantly responds with success.
3. **Asynchronous Batching (The V2 Routing Engine)**:
   - A background cron worker (`apps/worker/src/delivery-routing-batch-worker.ts`) polls every 60 seconds.
   - It identifies all `PACKED` local-delivery shipments waiting for >3 minutes (buffer time).
   - Packed local-delivery shipments are grouped by exact `sellerId` into batches of up to 3 orders.
   - The worker hits an internal API endpoint (`POST /api/internal/delivery/batch-assign`).
4. **Partner Selection & Dispatch**:
   - The API scans for active delivery partners matching the service area.
   - It evaluates proximity (`earth_distance`), active workload, and COD cash limits.
   - The selected partner receives an assignment lock for the entire batch and their `DeliveryAssignmentStatus` becomes `ASSIGNED`.
5. **Partner Acceptance**:
   - The delivery partner sees the assigned batch in the Mobile Delivery App and has a limited window (e.g., 110 minutes) to accept.
   - If accepted, status changes to `ACCEPTED`. If ignored/rejected, the batch goes back to the worker pool for reassignment.
6. **Pickup & Transit**:
   - The partner marks the order as `DISPATCHED` upon pickup.
   - The partner navigates to the customer using the app.
7. **Delivery & COD**:
   - Upon arrival, the partner marks the order as `DELIVERED`.
   - If the order was COD, the partner collects cash and registers the collection in the app (`CodCollectionStatus` -> `COLLECTED`).
   - The order is now complete.

---

## 2. Third-Party Courier (MANUAL_COURIER)

This mode is used for standard national e-commerce shipping.

### Lifecycle End-to-End

1. **Checkout & Routing**: 
   - If the delivery is outside the hyperlocal radius, the routing engine falls back to `MANUAL_COURIER`.
   - Shipping rates are calculated based on weight, dimensions, and zones.
2. **Seller Packing**: 
   - The seller packs the order and inputs the final package dimensions/weight.
   - The seller marks the order as `PACKED`.
3. **Courier Booking (Shiprocket/Logistics Adapter)**:
   - A dedicated background worker (`shiprocket-booking-worker.ts`) picks up the packed shipment.
   - It sends an API request to the logistics provider (e.g., Shiprocket) with pickup and drop-off coordinates, package dimensions, and COD details.
   - Upon success, an `AWB` (Airway Bill) and tracking link are generated and stored in `courier_shipments`.
4. **Manifest & Handover**:
   - The seller prints the generated shipping label.
   - The courier company sends a pickup agent.
   - The status updates to `DISPATCHED` once the package is scanned by the courier.
5. **Transit Tracking**:
   - The system polls the logistics provider's webhook or tracking API to sync transit updates (`IN_TRANSIT`, `OUT_FOR_DELIVERY`).
6. **Delivery**:
   - The courier provider marks the package as `DELIVERED` via webhook.
   - COD remittance is handled later via Finance reconciliation (the courier deposits the cash into the platform's bank account).

---

## 3. Store Pickup

Designed for click-and-collect or O2O (Online-to-Offline) scenarios.

### Lifecycle End-to-End

1. **Checkout**: 
   - Customer selects "Store Pickup".
2. **Seller Processing**: 
   - Seller prepares the items and marks the order as `PACKED`. 
   - An email/SMS notification is triggered telling the customer "Your order is ready for pickup".
3. **Customer Arrival**:
   - The customer visits the physical store and provides their order ID or OTP.
4. **Handover**:
   - The seller clicks "Mark as Picked Up" (which resolves the status to `DELIVERED` under the hood) on the Seller Portal.
   - The transaction is complete.

---

## 4. Manual Transport (B2B / Heavy Freight)

Designed for wholesale B2B purchases that require specialized transport, full-truckload (FTL), or seller-arranged logistics.

### Lifecycle End-to-End

1. **Checkout**: 
   - Typically triggered during B2B wholesale quotation acceptance. The mode is set to `MANUAL_TRANSPORT`.
2. **Seller Packing**: 
   - Seller packs pallets/crates and marks the order `PACKED`.
3. **Offline Dispatch**:
   - The seller arranges an offline truck or specialized transporter.
   - The seller manually updates the tracking details (Transporter Name, LR Number, Driver Contact) in the Seller Portal.
   - The seller marks the order `DISPATCHED`.
4. **Delivery**:
   - Once the buyer acknowledges receipt or the transporter confirms drop-off, the seller (or B2B Buyer) marks the order `DELIVERED`.

---

## Unified Delivery State Machine

Regardless of the delivery mode, all orders follow the core `DeliveryStatus` state machine:
`PENDING` -> `PACKED` -> `DISPATCHED` -> `DELIVERED`

The differences lie purely in **who** triggers the state transitions:
- **Local Delivery**: Triggered by the gig worker's mobile app.
- **Courier**: Triggered by third-party webhooks.
- **Store Pickup**: Triggered by the seller upon physical handover.
- **Manual Transport**: Triggered manually by the seller/buyer based on offline coordination.

---

## Payment & Commission Triggers
- **COD (Cash on Delivery)**: For Local Delivery, the gig worker holds the cash until remitted. For Courier, the logistics company remits the cash. In all cases, the platform holds the authoritative ledger.
- **Seller Payouts**: A seller's payout (settlement) is only eligible to be unlocked *after* the `DeliveryStatus` reaches `DELIVERED` and the payment is marked `PAID`.
