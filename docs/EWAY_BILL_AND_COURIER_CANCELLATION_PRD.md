# E-Way Bill Compliance & Third-Party Courier Lifecycle PRD

Last updated: 2026-07-24

## 1. Executive Summary

Under Indian Goods and Services Tax (GST) regulations (CGST Rule 138), any movement of goods with a consignment value exceeding **₹50,000** mandates the generation and attachment of a valid **12-digit E-Way Bill Number**. 

This PRD establishes the complete lifecycle governance, UI state retention, non-editability guardrails, PDF invoice rendering, accounting export integration, and third-party courier (Shiprocket) sync/cancellation workflows across 1HandIndia.

---

## 2. Core Business Objectives

1. **Non-Destructive UI State Retention**:
   - Prevent the E-Way Bill field from dynamically disappearing after submission in the Seller Center.
   - Permanently retain and render the saved 12-digit E-Way Bill Number inside the seller package card as a read-only, audit-locked field.

2. **Strict Editability Lock & Warning Guardrails**:
   - Enforce an irreversible lock once an E-Way Bill Number is submitted on a package.
   - Display a high-visibility warning notice prior to submission:
     > ⚠️ *Important: Please double-check your 12-digit E-Way Bill Number before saving. Once recorded, it becomes permanently non-editable for statutory GST compliance and courier audit integrity.*

3. **Statutory GST Tax Document Compliance**:
   - Automatically render the `E-Way Bill No: XXXXXXXXXXXX` header on generated PDF Tax Invoices, Delivery Challans, and Shipping Manifests when consignment value is ≥ ₹50,000.
   - Surface the E-Way Bill Number in downloadable Finance Manager GST Sales Registers (CSV/Excel).

4. **Third-Party Courier Sync & Lifecycle Cancellation**:
   - Pass `ewaybill_no` directly into Shiprocket's `/v1/external/orders/create/adhoc` API payload during order creation.
   - Automatically push cancellation payloads (`POST /v1/external/orders/cancel`) to Shiprocket whenever an order is cancelled by **Customer**, **Admin**, or **Seller**.
   - Provide an Admin Bulk Sync API endpoint (`POST /api/admin/courier-shipments/sync-cancelled`) to reconcile historical cancelled orders with third-party logistics.

---

## 3. Product Architecture & Workflow

### 3.1 Data Flow Diagram

```mermaid
flowchart TD
    subgraph Seller Center
        A["Seller Action (Packed / Dispatched)"] -->|Consignment >= ₹50,000| B{"E-Way Bill Input"}
        B -->|Validation: 12 Numeric Digits| C["Submit Status & E-Way Bill"]
    end

    subgraph Backend Core (Orders & Logistics)
        C --> D["Save to OrderShipmentPackage.ewayBillNumber"]
        D --> E["Lock Field (isNonEditable = true)"]
        D --> F["Shiprocket Booking API (ewaybill_no)"]
    end

    subgraph Platform Surface Readbacks
        E --> G1["Seller Package Card (Read-Only View)"]
        E --> G2["Admin Order & Logistics Detail (Read-Only)"]
        E --> G3["PDF Tax Invoice & Delivery Challan (CGST Rule 138)"]
        E --> G4["Finance GST Compliance CSV Export"]
    end

    subgraph Multi-Channel Cancellation Workflow
        H["Order Cancelled (Customer / Admin / Seller)"] --> I["CourierLogisticsService.cancelShipmentForSellerSplit"]
        I --> J["Shiprocket API: POST /v1/external/orders/cancel"]
        J --> K["Mark CourierShipmentStatus = CANCELLED"]
    end
```

---

## 4. UI & Form Specifications

### 4.1 Seller Center Package Card (`seller-order-detail-client.tsx`)

| Element | Trigger / Condition | UI Representation | Behavioral Rule |
| :--- | :--- | :--- | :--- |
| **E-Way Bill Input** | Order Value ≥ ₹50,000 AND Package Status `PENDING`/`ACCEPTED` | Required input box with validation notice. | Must be 12 numeric digits. Submitting sets lock. |
| **E-Way Bill Warning** | Form active prior to submit | Yellow/Orange Notice Badge: *"Once saved, E-Way Bill is locked for tax compliance."* | Non-dismissable informational banner. |
| **Package Card Badge** | Saved `ewayBillNumber` exists | Locked Read-Only Badge: `E-Way Bill: 123456789012 🔒` | Permanent view; non-editable by seller. |

### 4.2 Admin Control Panel (`admin-order-detail-client.tsx`)

- Display the saved `ewayBillNumber` alongside package weight and dimensions in the Admin Package Audit card.
- Provide an Admin override action (Audit-logged) if legal correction is mandated by finance administrators.

---

## 5. API & Database Specifications

### 5.1 Schema (`schema.prisma`)

```prisma
model OrderShipmentPackage {
  id                 String   @id @default(uuid()) @db.Uuid
  orderShipmentId     String   @map("order_shipment_id") @db.Uuid
  ewayBillNumber     String?  @map("eway_bill_number") @db.VarChar(20)
  // ... other fields
}
```

### 5.2 API Contracts

1. **Order Readbacks (`GET /api/seller/orders/:orderNumber`)**:
   Returns `ewayBillNumber` inside `orderShipment.packages[]`.

2. **Status Update Payload (`POST /api/seller/orders/:orderNumber/status`)**:
   ```json
   {
     "sellerStatus": "DISPATCHED",
     "note": "Handed over to courier",
     "ewayBillNumber": "123456789012"
   }
   ```

3. **Shiprocket Booking Integration Payload**:
   ```json
   {
     "order_id": "1HI20260724844722-S01",
     "order_date": "2026-07-24",
     "pickup_location": "Primary Warehouse",
     "billing_customer_name": "Kishore",
     "ewaybill_no": "123456789012"
   }
   ```

4. **Admin Historical Re-Sync API (`POST /api/admin/courier-shipments/sync-cancelled`)**:
   Exposed for back-office reconciliation to push cancellations for orders cancelled prior to live webhook sync.

---

## 6. Non-Functional & Verification Requirements

1. **Security & Audit**:
   - Every E-Way Bill creation or update creates an immutable entry in `AuditLog` containing `actorUserId`, `entityType: "order_shipment_package"`, and `ewayBillNumber`.

2. **Performance**:
   - E-Way Bill status checks are evaluated in-memory during readback without extra DB query roundtrips.

3. **Automated Test Coverage**:
   - Vitest suite in `apps/api/src/orders/courier-logistics.service.test.ts` verifying third-party courier cancellation idempotency and payload structure.
   - Vitest suite in `apps/web/src/components/seller/seller-order-detail-client.test.ts` verifying read-only UI rendering and warning message presence.

---

## 7. Approval & Sign-Off

- **Product Management**: Approved
- **Logistics Operations**: Approved
- **Tax & Compliance Team**: Approved
