# Seller Product Delivery Modes PRD

Last updated: 2026-07-13

## Summary

Allow sellers to choose which delivery modes are available for each product:

- `THIRD_PARTY_COURIER`
- `LOCAL_DELIVERY_PARTNER`
- `MANUAL_TRANSPORT`
- `STORE_PICKUP`

Customer checkout must show only delivery modes that are enabled for the products being purchased and serviceable for the selected address/payment method. In multi-seller carts, checkout must choose delivery per seller package, not only once for the full order, because each seller can enable a different set of modes.

## Current Code Reality

The project already has the four `DeliveryMode` enum values in `prisma/schema.prisma`.

Today:

- Products do not store allowed delivery modes.
- Seller product create/update DTOs do not accept delivery modes.
- Seller web/mobile product forms do not expose delivery mode configuration.
- Checkout summary currently calculates `availableDeliveryOptions` as one shared order-level mode list.
- Place order currently accepts one `deliveryMode` for the whole order and then applies package routing per seller.
- Order shipments and packages already store their final delivery mode.
- Seller-collected COD already depends on final shipment mode for `STORE_PICKUP` and `MANUAL_TRANSPORT`.

## Decision

Implement product-level allowed delivery modes with package-level checkout selection.

Decision matrix:

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Product-level normalized table | Strong validation, queryable, auditable, easy checkout joins, future admin filtering | Requires migration and API updates | Use this |
| Product JSON field | Fast to add | Weak querying, easy to corrupt, harder to index/audit | Avoid |
| Seller-global setting only | Simple seller UX | Cannot handle product-specific shipping limits, bulky items, pickup-only products | Not enough |
| Variant-level setting | Most precise | More UI/API complexity than requested | Future scope only |

## Goals

- Seller can select one or more delivery modes while creating or editing a product.
- Existing products remain purchasable after migration.
- Customer web and mobile checkout show only eligible delivery modes.
- Multi-seller checkout supports separate delivery choice per seller package.
- Order placement revalidates delivery mode server-side before creating order, shipment, package, payment, stock movement, or COD receivable path.
- Admin can see product delivery modes during product review and catalogue operations.
- Seller order fulfilment, delivery partner, courier, and seller-collected COD flows continue using the final `OrderShipment.deliveryMode`.

## Non-Goals

- Substitute delivery modes after checkout without admin controls.
- Variant-specific delivery mode overrides.
- New courier provider integrations.
- Automatic seller pickup-slot scheduling.
- B2B transport changes unless later requested.

## Business Rules

1. A product must have at least one enabled delivery mode.
2. Existing products should be backfilled with all four modes enabled to avoid breaking active checkout.
3. A customer can only select modes enabled by every product in that seller package.
4. Serviceability still applies after product filtering:
   - `LOCAL_DELIVERY_PARTNER` requires eligible partner coverage.
   - `THIRD_PARTY_COURIER` requires courier/rate/provider readiness and package dimensions where required.
   - `MANUAL_TRANSPORT` is seller-managed and can be used only where routing supports seller-arranged delivery.
   - `STORE_PICKUP` does not require delivery address but requires a seller pickup/store address.
5. Checkout must not expose disabled modes to customers. If no modes are available for a seller package, checkout blocks that package with a clear message.
6. Server must reject a stale or tampered checkout request if selected delivery mode is not enabled for any product in the package.
7. Admin delivery override may choose any operational mode, but must show a warning when overriding outside product-enabled modes and must write audit context.
8. COD accounting remains based on final shipment mode:
   - Store Pickup COD opens seller cash receivable on seller-delivered pickup.
   - Manual Transport COD requires seller exact cash collection.
   - Local Delivery Partner COD remains delivery/finance verified.
   - Third Party Courier COD remains courier/remittance verified.

## Data Model

Add `ProductDeliveryMode`.

```prisma
model ProductDeliveryMode {
  id           String       @id @default(uuid()) @db.Uuid
  productId    String       @map("product_id") @db.Uuid
  deliveryMode DeliveryMode @map("delivery_mode")
  isEnabled    Boolean      @default(true) @map("is_enabled")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  product      Product      @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, deliveryMode])
  @@index([productId, isEnabled])
  @@index([deliveryMode, isEnabled])
  @@map("product_delivery_modes")
}
```

Update `Product`:

```prisma
deliveryModes ProductDeliveryMode[]
```

Migration:

- Create table and indexes.
- Backfill one row per existing product per mode with `is_enabled = true`.
- Generate Prisma client.
- Validate with `pnpm db:validate`.

Index hygiene:

- `productId` relation is covered by `@@index([productId, isEnabled])`.
- `@@unique([productId, deliveryMode])` prevents duplicate rows.
- `@@index([deliveryMode, isEnabled])` supports admin/product filtering by mode.

## API Contract Changes

### Seller Product Create/Update

Endpoints:

- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`

Add:

```ts
deliveryModes: DeliveryMode[]
```

Validation:

- Required for new products after UI release.
- For compatibility, missing `deliveryModes` defaults to all four modes during transition.
- Array size `1..4`.
- Values must be unique and valid `DeliveryMode`.
- Seller cannot submit an empty array.

### Product Readbacks

Add to public, seller, and admin product readbacks:

```ts
deliveryModes: DeliveryMode[]
deliveryModeOptions?: Array<{
  mode: DeliveryMode;
  enabled: boolean;
}>
```

Public product detail may show delivery availability badges. Product listing cards do not need to show all modes unless UX later asks.

### Checkout Summary

Current:

```ts
availableDeliveryOptions?: Array<{
  mode: DeliveryMode;
  chargePaise: number;
  isCheapest: boolean;
  available: boolean;
  reason: string | null;
}>
```

Add package-aware readback:

```ts
sellerDeliveryGroups: Array<{
  sellerId: string;
  sellerName: string;
  subtotalPaise: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    enabledDeliveryModes: DeliveryMode[];
  }>;
  availableDeliveryOptions: Array<{
    mode: DeliveryMode;
    chargePaise: number;
    isCheapest: boolean;
    reason: string | null;
  }>;
  selectedDeliveryMode?: DeliveryMode;
  blockedReason?: string | null;
}>
```

Keep existing `availableDeliveryOptions` for backward compatibility during rollout, but customer web/mobile should move to `sellerDeliveryGroups`.

### Place Order

Current:

```ts
deliveryMode?: DeliveryMode
```

Add package-level selections:

```ts
deliverySelections?: Array<{
  sellerId: string;
  deliveryMode: DeliveryMode;
}>
```

Rules:

- If `deliverySelections` is present, use it per seller package.
- If absent, keep old `deliveryMode` behavior for backward compatibility only when all seller packages can use the same mode.
- Reject missing selection for any seller package with more than one valid option.
- Reject selections for modes not enabled by every product in that seller package.
- Re-run routing/serviceability inside the order transaction before stock decrement and order creation.

## Backend Implementation Areas

### Products

Files:

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_product_delivery_modes/migration.sql`
- `apps/api/src/products/dto/product.dto.ts`
- `apps/api/src/products/products.service.ts`
- `apps/api/src/products/products.service.test.ts`
- `apps/api/src/products/products.controller.ts`
- `apps/api/src/products/seller-products.controller.ts`
- `apps/api/src/products/admin-products.controller.ts`

Changes:

- Include `deliveryModes` relation in product includes.
- Normalize requested mode arrays.
- Create delivery mode rows in product create transaction.
- Replace delivery mode rows in product update transaction.
- Include mode changes in audit log `oldValue` and `newValue`.
- Ensure approval readiness can surface mode readiness issues if courier/pickup requirements are missing.
- Return delivery modes in seller/admin/public product readbacks.

### Checkout Pricing And Routing

Files:

- `apps/api/src/cart/cart.service.ts`
- `apps/api/src/cart/dto/checkout-summary-query.dto.ts`
- `apps/api/src/checkout/checkout-pricing.service.ts`
- `apps/api/src/checkout/checkout-pricing.service.test.ts`
- `apps/api/src/checkout/checkout-serviceability.ts`
- `apps/api/src/checkout/checkout-serviceability.test.ts`
- `apps/api/src/checkout/delivery-routing.service.ts`
- `apps/api/src/checkout/delivery-routing.service.test.ts`
- `apps/api/src/checkout/dto/delivery-routing.dto.ts`
- `apps/api/src/checkout/checkout-delivery.controller.ts`
- `apps/api/src/checkout/checkout-delivery.controller.test.ts`

Changes:

- Load product enabled modes with checkout items.
- Compute intersection of enabled modes per seller package.
- Route only modes in that intersection.
- Return per-seller `sellerDeliveryGroups`.
- Hide disabled modes from customer readback.
- Preserve serviceability failure reasons for internal/admin diagnostics, but customer UI only sees clean unavailable messages.
- Keep delivery simulator/admin tools able to test all modes independent of product settings.

### Order Placement

Files:

- `apps/api/src/orders/dto/checkout.dto.ts`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/orders.service.test.ts`
- `apps/api/src/orders/customer-orders.controller.ts`
- `apps/api/src/app/backend.integration.test.ts`

Changes:

- Accept `deliverySelections`.
- Validate selections against product-enabled modes and routing.
- Store selected mode on each `OrderShipment` and `OrderShipmentPackage`.
- Compute summary `Order.deliveryMode` or `DeliveryDetail.deliveryMode` from package modes as today, but avoid pretending mixed-mode orders have one operational mode where package modes differ.
- Ensure COD payment status logic still waits for every active COD path.
- Ensure seller-collected COD receivable creation still keys off final package/shipment modes.

### Courier And Delivery Operations

Files:

- `apps/api/src/orders/courier-logistics.service.ts`
- `apps/api/src/orders/courier-logistics.service.test.ts`
- `apps/api/src/orders/dto/courier-logistics.dto.ts`
- `apps/api/src/orders/dto/delivery-update.dto.ts`
- `apps/api/src/orders/admin-delivery.controller.ts`
- `apps/api/src/orders/delivery-partner-orders.controller.ts`

Changes:

- No major workflow change after order creation.
- Ensure package mode remains source of truth for courier booking eligibility.
- Admin override should update shipment and package mode together, following the existing package-status rule.
- If admin changes a package from seller-collected mode to partner/courier mode before delivery, prevent stale seller receivable creation.

### Shared Types And Validators

Files:

- `packages/shared-types/src/index.ts`
- `packages/validators/src/index.ts`

Changes:

- Add `MANUAL_TRANSPORT` to shared `deliveryModes`; current shared type only lists three modes.
- Add product delivery mode array schema.
- Ensure checkout/delivery validation accepts all four modes consistently.

## Web UI Changes

### Seller Web Product Form

Files:

- `apps/web/src/components/seller/seller-products-client.tsx`
- `apps/web/src/lib/seller-api.ts`
- `apps/web/src/lib/seller-api.test.ts`
- `apps/web/src/app/(seller)/seller/products/new/page.tsx`
- `apps/web/src/app/(seller)/seller/products/[productId]/edit/page.tsx`

UX:

- Add a `Delivery options` section inside or just below "Marketplace, tax and delivery details".
- Use four checkbox cards:
  - Courier delivery
  - Local delivery partner
  - Seller-arranged delivery
  - Store pickup
- Show concise helper copy, not internal system terms.
- Require at least one selected mode.
- Show readiness hints:
  - Courier delivery: package weight/dimensions needed.
  - Store pickup: pickup/store address required.
  - Seller-arranged delivery: seller handles handover and proof.
  - Local delivery partner: depends on service coverage.
- Existing product edit should preselect saved modes.

Suggested labels:

| Mode | Seller label | Customer label |
| --- | --- | --- |
| `THIRD_PARTY_COURIER` | Courier delivery | Courier delivery |
| `LOCAL_DELIVERY_PARTNER` | Local delivery partner | Local delivery |
| `MANUAL_TRANSPORT` | Seller-arranged delivery | Seller-arranged delivery |
| `STORE_PICKUP` | Store pickup | Store pickup |

### Customer Web Checkout

Files:

- `apps/web/src/components/storefront/checkout-page-client.tsx`
- `apps/web/src/lib/storefront-api.ts`
- `apps/web/src/lib/delivery-labels.ts`
- `apps/web/src/lib/delivery-labels.test.ts`
- `apps/web/src/app/(storefront)/checkout/page.tsx`
- `apps/web/src/components/storefront/cart-page-client.tsx`

UX:

- Replace one global transport selector with delivery selection per seller package.
- Each seller package card shows product names, seller name, and only serviceable enabled options.
- Auto-select cheapest serviceable mode per package.
- If a seller package has one option, preselect it.
- If a seller package has no valid option, block checkout and show: "Delivery is not available for one seller package. Change address or remove the item."
- Store pickup should be available only for packages where all items support pickup.
- For all-store-pickup checkout, address should not be required.
- For mixed pickup and delivery packages, address is required for delivered packages only. If the current address model is order-level, v1 can require address whenever any package is delivered.

### Admin Web

Files:

- `apps/web/src/components/admin/admin-operations.tsx`
- `apps/web/src/app/(admin)/admin/products/page.tsx`
- `apps/web/src/app/(admin)/admin/products/approvals/page.tsx`
- `apps/web/src/app/(admin)/admin/orders/[orderNumber]/page.tsx`

Changes:

- Product catalogue/approval detail shows enabled delivery modes.
- Approval queue can flag missing readiness for selected modes.
- Admin order delivery override shows existing product-enabled modes as context.
- Admin override outside enabled modes writes audit note.

## Mobile App Changes

### Seller Mobile

Files:

- `apps/mobile-seller/src/features/seller/seller-api.ts`
- `apps/mobile-seller/src/features/seller/product-edit.ts`
- `apps/mobile-seller/src/features/seller/product-edit.test.ts`
- `apps/mobile-seller/src/features/seller/product-form.ts`
- `apps/mobile-seller/src/features/seller/product-form.test.ts`
- `apps/mobile-seller/app/products/new.tsx`
- `apps/mobile-seller/app/products/new-comprehensive.tsx`
- `apps/mobile-seller/app/products/[id].tsx`
- `apps/mobile-seller/app/products/detail/[id].tsx`
- `apps/mobile-seller/app/(tabs)/products.tsx`

Changes:

- Add delivery modes to mobile seller product types.
- Add multi-select section in create/edit.
- Validate at least one selected mode.
- Show selected modes on product detail/list.
- Keep order delivery screen unchanged except it will receive modes selected at checkout.

### Customer Mobile

Files:

- `apps/mobile-customer/src/features/storefront/storefront-api.ts`
- `apps/mobile-customer/src/features/storefront/checkout-validation.ts`
- `apps/mobile-customer/src/features/storefront/checkout-validation.test.ts`
- `apps/mobile-customer/app/checkout.tsx`
- `apps/mobile-customer/app/products/[slug].tsx`
- `apps/mobile-customer/app/product/[slug].tsx`
- `apps/mobile-customer/app/orders/[orderNumber].tsx`
- `apps/mobile-customer/src/types/storefront.ts`

Changes:

- Add `sellerDeliveryGroups` and `deliverySelections` types.
- Render delivery options per seller package.
- Auto-select cheapest option per package.
- Place order with package selections.
- Product detail can show available delivery badges.

## Finance, COD, Returns, And Tracking Impact

Files to verify, usually minimal changes:

- `apps/api/src/finance/seller-cash-receivables.service.ts`
- `apps/api/src/finance/seller-payouts.service.ts`
- `apps/api/src/returns/returns.service.ts`
- `apps/web/src/components/finance/seller-cash-receivables-client.tsx`
- `apps/web/src/components/seller/finance/seller-wallet-client.tsx`
- `apps/web/src/components/storefront/track-order-client.tsx`
- `apps/web/src/components/account/orders-client.tsx`
- `apps/mobile-customer/app/account/returns/[requestNumber].tsx`

Expected:

- No new finance model required.
- Existing seller-collected COD logic continues to use final shipment/package mode.
- Returns/tracking should display the selected mode from shipment/package.
- Mixed-mode orders must avoid misleading one-mode summaries.

## Edge Cases

- Seller disables all modes through stale mobile client: API rejects.
- Seller edits product modes after customer opens checkout: place order revalidates and rejects stale selection.
- Product A supports pickup only, Product B supports courier only in same seller package: intersection is empty; checkout blocks that seller package.
- Product A supports pickup/courier, Product B supports courier only: checkout shows courier only.
- Multi-seller cart: seller A pickup only, seller B courier only; checkout shows separate package choices.
- Mixed pickup and delivery order: address required for delivery package, not for pickup package.
- COD + manual transport: seller exact cash validation still applies after order placement.
- COD + store pickup: receivable opens only after seller marks pickup delivered.
- Prepaid + seller-arranged delivery: no seller cash receivable should open.
- Courier selected but variant dimensions missing: block with readiness message.
- Local delivery selected but no partner coverage: do not show to customer or block with package reason.
- Admin override after order placement: update shipment and package mode together, keep audit.
- Product archived/deleted after checkout summary but before order placement: order placement rejects.
- One-paise buyer platform fee allocation across seller packages remains stable.
- Product delivery mode rows duplicated by retry: unique constraint prevents duplicates.
- Backfill migration rerun safety: use idempotent insert/upsert SQL.

## Test Plan

### API Tests

- Seller product create requires at least one delivery mode.
- Seller product update replaces modes without duplicate rows.
- Public product readback includes enabled delivery modes.
- Admin product readback includes enabled delivery modes.
- Checkout summary filters modes by product intersection.
- Checkout summary hides disabled modes from customer-facing readback.
- Multi-seller checkout returns separate `sellerDeliveryGroups`.
- Place order rejects delivery mode not enabled by product.
- Place order accepts package-level different modes for different sellers.
- Place order creates shipment/package with selected package mode.
- Store Pickup COD still opens seller cash receivable on delivery.
- Manual Transport COD still requires exact seller cash collection.
- Prepaid courier/local delivery flows do not create seller cash receivables.
- Admin delivery override updates shipment and package status together.

### Web Tests

- Seller product form renders four mode checkboxes.
- Seller cannot submit with no mode selected.
- Editing product preselects existing modes.
- Customer checkout renders delivery choices per seller group.
- Customer checkout auto-selects cheapest serviceable mode.
- Checkout blocks if one seller group has no valid mode.
- Admin product approval shows enabled modes.

### Mobile Tests

- Seller mobile create/update includes selected modes in payload.
- Seller mobile blocks no selected mode.
- Customer mobile checkout renders seller package delivery choices.
- Customer mobile sends `deliverySelections`.
- Mobile order success/tracking still displays selected mode.

### Manual QA

- Single seller, courier only.
- Single seller, store pickup only.
- Single seller, manual transport COD.
- Single seller, local delivery partner COD.
- Multi-seller mixed pickup plus courier.
- Multi-seller no common mode inside one seller package.
- Product mode changed between checkout summary and place order.
- Admin override before shipment delivered.
- Seller-collected COD payout/receivable regression.

## Rollout Plan

1. Add DB model and backfill all existing products with all four modes.
2. Add readback fields without changing customer UI.
3. Add seller web/mobile product mode save.
4. Add package-aware checkout summary API while keeping old global field.
5. Update customer web/mobile checkout to use package selections.
6. Update order placement to accept and enforce `deliverySelections`.
7. Add admin visibility and override warning.
8. Run API/web/mobile tests and manual QA.
9. After one release, mark old global `deliveryMode` checkout behavior as compatibility-only.

## Verification Gates

- `pnpm db:validate`
- `pnpm run db:generate`
- `pnpm --filter @indihub/api typecheck`
- `pnpm --filter @indihub/api lint`
- `pnpm --filter @indihub/api test`
- `pnpm --filter @indihub/web typecheck`
- `pnpm --filter @indihub/web lint`
- `pnpm --filter @indihub/web test`
- `pnpm --filter @indihub/web build`
- Mobile customer typecheck/tests where configured.
- Mobile seller typecheck/tests where configured.

## Implementation File Checklist

Database:

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_product_delivery_modes/migration.sql`
- `packages/database/src/generated/prisma/*` after generation

Shared packages:

- `packages/shared-types/src/index.ts`
- `packages/validators/src/index.ts`

API:

- `apps/api/src/products/dto/product.dto.ts`
- `apps/api/src/products/products.service.ts`
- `apps/api/src/products/products.service.test.ts`
- `apps/api/src/products/products.controller.ts`
- `apps/api/src/products/seller-products.controller.ts`
- `apps/api/src/products/admin-products.controller.ts`
- `apps/api/src/cart/cart.service.ts`
- `apps/api/src/cart/dto/checkout-summary-query.dto.ts`
- `apps/api/src/checkout/checkout-pricing.service.ts`
- `apps/api/src/checkout/checkout-pricing.service.test.ts`
- `apps/api/src/checkout/checkout-serviceability.ts`
- `apps/api/src/checkout/checkout-serviceability.test.ts`
- `apps/api/src/checkout/delivery-routing.service.ts`
- `apps/api/src/checkout/delivery-routing.service.test.ts`
- `apps/api/src/checkout/dto/delivery-routing.dto.ts`
- `apps/api/src/checkout/checkout-delivery.controller.ts`
- `apps/api/src/checkout/checkout-delivery.controller.test.ts`
- `apps/api/src/orders/dto/checkout.dto.ts`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/orders.service.test.ts`
- `apps/api/src/orders/courier-logistics.service.ts`
- `apps/api/src/orders/courier-logistics.service.test.ts`
- `apps/api/src/app/backend.integration.test.ts`

Web:

- `apps/web/src/lib/storefront-api.ts`
- `apps/web/src/lib/seller-api.ts`
- `apps/web/src/lib/delivery-labels.ts`
- `apps/web/src/lib/delivery-labels.test.ts`
- `apps/web/src/components/seller/seller-products-client.tsx`
- `apps/web/src/components/storefront/checkout-page-client.tsx`
- `apps/web/src/components/storefront/cart-page-client.tsx`
- `apps/web/src/components/admin/admin-operations.tsx`
- `apps/web/src/app/(seller)/seller/products/new/page.tsx`
- `apps/web/src/app/(seller)/seller/products/[productId]/edit/page.tsx`
- `apps/web/src/app/(storefront)/checkout/page.tsx`
- `apps/web/src/app/(admin)/admin/products/page.tsx`
- `apps/web/src/app/(admin)/admin/products/approvals/page.tsx`
- `apps/web/src/app/(admin)/admin/orders/[orderNumber]/page.tsx`

Mobile seller:

- `apps/mobile-seller/src/features/seller/seller-api.ts`
- `apps/mobile-seller/src/features/seller/product-edit.ts`
- `apps/mobile-seller/src/features/seller/product-edit.test.ts`
- `apps/mobile-seller/src/features/seller/product-form.ts`
- `apps/mobile-seller/src/features/seller/product-form.test.ts`
- `apps/mobile-seller/app/products/new.tsx`
- `apps/mobile-seller/app/products/new-comprehensive.tsx`
- `apps/mobile-seller/app/products/[id].tsx`
- `apps/mobile-seller/app/products/detail/[id].tsx`
- `apps/mobile-seller/app/(tabs)/products.tsx`

Mobile customer:

- `apps/mobile-customer/src/features/storefront/storefront-api.ts`
- `apps/mobile-customer/src/features/storefront/checkout-validation.ts`
- `apps/mobile-customer/src/features/storefront/checkout-validation.test.ts`
- `apps/mobile-customer/src/types/storefront.ts`
- `apps/mobile-customer/app/checkout.tsx`
- `apps/mobile-customer/app/products/[slug].tsx`
- `apps/mobile-customer/app/product/[slug].tsx`
- `apps/mobile-customer/app/orders/[orderNumber].tsx`

Docs/manual QA:

- `docs/SELLER_PRODUCT_DELIVERY_MODES_PRD.md`
- Optional follow-up: `docs/SELLER_PRODUCT_DELIVERY_MODES_MANUAL_TESTING.md`

## Open Questions

- Should existing products default to all four modes, or should admin bulk-review pickup/manual transport before enabling them?
- Should store pickup require a seller pickup address before product approval, or only block checkout if missing?
- Should manual transport require admin approval per seller before sellers can enable it?
- Should customer checkout hide unsupported modes completely, or show unavailable reasons for transparency? This PRD chooses hide for customer purchase flow and keep reasons in admin/internal diagnostics.
