-- Durable multi-seller courier label architecture.
-- Adds physical package and courier consignment records without deleting legacy shipment fields.
-- Do not deploy this against staging/production until provider and rollout checks are approved.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TYPE "CourierShipmentStatus" ADD VALUE IF NOT EXISTS 'PICKUP_SCHEDULED';
ALTER TYPE "CourierShipmentStatus" ADD VALUE IF NOT EXISTS 'RTO_INITIATED';
ALTER TYPE "CourierShipmentStatus" ADD VALUE IF NOT EXISTS 'RTO_IN_TRANSIT';
ALTER TYPE "CourierShipmentStatus" ADD VALUE IF NOT EXISTS 'RTO_DELIVERED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderShipmentPackageStatus') THEN
    CREATE TYPE "OrderShipmentPackageStatus" AS ENUM (
      'PACKING_PENDING',
      'READY_FOR_BOOKING',
      'BOOKING_PENDING',
      'BOOKED',
      'PICKUP_SCHEDULED',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'RTO_INITIATED',
      'RTO_IN_TRANSIT',
      'RTO_DELIVERED',
      'CANCELLED',
      'FAILED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "order_shipment_packages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "package_number" TEXT NOT NULL,
  "order_shipment_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "delivery_mode" "DeliveryMode" NOT NULL,
  "status" "OrderShipmentPackageStatus" NOT NULL DEFAULT 'PACKING_PENDING',
  "shipping_paise" INTEGER NOT NULL DEFAULT 0,
  "cod_surcharge_paise" INTEGER NOT NULL DEFAULT 0,
  "declared_value_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "weight_grams" INTEGER,
  "length_cm" INTEGER,
  "breadth_cm" INTEGER,
  "height_cm" INTEGER,
  "item_allocations" JSONB,
  "package_snapshot" JSONB,
  "ready_for_booking_at" TIMESTAMP(3),
  "booked_at" TIMESTAMP(3),
  "pickup_scheduled_at" TIMESTAMP(3),
  "picked_up_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_shipment_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "courier_consignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "consignment_number" TEXT NOT NULL,
  "order_shipment_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "provider_code" TEXT NOT NULL,
  "provider_order_id" TEXT,
  "pickup_location_name" TEXT,
  "tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
  "tracking_status_label" TEXT,
  "manifest_url" TEXT,
  "invoice_url" TEXT,
  "label_document_url" TEXT,
  "shipping_zone" TEXT,
  "provider_raw_status" TEXT,
  "provider_raw_status_code" TEXT,
  "booking_payload_snapshot" JSONB,
  "booking_response_snapshot" JSONB,
  "last_webhook_event_id" TEXT,
  "last_webhook_at" TIMESTAMP(3),
  "last_tracked_at" TIMESTAMP(3),
  "booking_attempt_count" INTEGER NOT NULL DEFAULT 0,
  "booking_error" TEXT,
  "booked_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "courier_consignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "courier_consignment_packages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "courier_consignment_id" UUID NOT NULL,
  "order_shipment_package_id" UUID NOT NULL,
  "order_shipment_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "provider_package_id" TEXT,
  "awb_number" TEXT,
  "courier_name" TEXT,
  "courier_code" TEXT,
  "tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
  "tracking_status_label" TEXT,
  "tracking_url" TEXT,
  "label_url" TEXT,
  "label_storage_key" TEXT,
  "label_content_type" TEXT,
  "label_fetched_at" TIMESTAMP(3),
  "manifest_url" TEXT,
  "invoice_url" TEXT,
  "shipping_zone" TEXT,
  "provider_raw_status" TEXT,
  "provider_raw_status_code" TEXT,
  "booked_at" TIMESTAMP(3),
  "pickup_scheduled_at" TIMESTAMP(3),
  "last_webhook_event_id" TEXT,
  "last_webhook_at" TIMESTAMP(3),
  "last_tracked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "courier_consignment_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_shipment_packages_package_number_key"
  ON "order_shipment_packages"("package_number");
CREATE UNIQUE INDEX IF NOT EXISTS "order_shipment_packages_order_shipment_id_sequence_key"
  ON "order_shipment_packages"("order_shipment_id", "sequence");
CREATE INDEX IF NOT EXISTS "order_shipment_packages_order_id_status_created_at_idx"
  ON "order_shipment_packages"("order_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "order_shipment_packages_order_shipment_id_status_idx"
  ON "order_shipment_packages"("order_shipment_id", "status");
CREATE INDEX IF NOT EXISTS "order_shipment_packages_seller_id_status_created_at_idx"
  ON "order_shipment_packages"("seller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "order_shipment_packages_delivery_mode_status_created_at_idx"
  ON "order_shipment_packages"("delivery_mode", "status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "courier_consignments_consignment_number_key"
  ON "courier_consignments"("consignment_number");
CREATE UNIQUE INDEX IF NOT EXISTS "courier_consignments_provider_code_provider_order_id_key"
  ON "courier_consignments"("provider_code", "provider_order_id");
CREATE INDEX IF NOT EXISTS "courier_consignments_order_id_tracking_status_updated_at_idx"
  ON "courier_consignments"("order_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignments_order_shipment_id_tracking_status_updated_at_idx"
  ON "courier_consignments"("order_shipment_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignments_seller_id_tracking_status_updated_at_idx"
  ON "courier_consignments"("seller_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignments_provider_code_tracking_status_updated_at_idx"
  ON "courier_consignments"("provider_code", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignments_provider_code_last_tracked_at_idx"
  ON "courier_consignments"("provider_code", "last_tracked_at");

CREATE UNIQUE INDEX IF NOT EXISTS "courier_consignment_packages_awb_number_key"
  ON "courier_consignment_packages"("awb_number");
CREATE UNIQUE INDEX IF NOT EXISTS "courier_consignment_packages_consignment_package_key"
  ON "courier_consignment_packages"("courier_consignment_id", "order_shipment_package_id");
CREATE INDEX IF NOT EXISTS "courier_consignment_packages_order_id_tracking_status_updated_at_idx"
  ON "courier_consignment_packages"("order_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignment_packages_order_shipment_id_tracking_status_updated_at_idx"
  ON "courier_consignment_packages"("order_shipment_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignment_packages_order_shipment_package_id_tracking_status_updated_at_idx"
  ON "courier_consignment_packages"("order_shipment_package_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignment_packages_seller_id_tracking_status_updated_at_idx"
  ON "courier_consignment_packages"("seller_id", "tracking_status", "updated_at");
CREATE INDEX IF NOT EXISTS "courier_consignment_packages_awb_number_tracking_status_idx"
  ON "courier_consignment_packages"("awb_number", "tracking_status");

ALTER TABLE "order_shipment_packages"
  ADD CONSTRAINT "order_shipment_packages_order_shipment_id_fkey"
  FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_shipment_packages"
  ADD CONSTRAINT "order_shipment_packages_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_shipment_packages"
  ADD CONSTRAINT "order_shipment_packages_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "courier_consignments"
  ADD CONSTRAINT "courier_consignments_order_shipment_id_fkey"
  FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courier_consignments"
  ADD CONSTRAINT "courier_consignments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courier_consignments"
  ADD CONSTRAINT "courier_consignments_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courier_consignments"
  ADD CONSTRAINT "courier_consignments_provider_code_fkey"
  FOREIGN KEY ("provider_code") REFERENCES "courier_provider_settings"("provider_code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "courier_consignment_packages"
  ADD CONSTRAINT "courier_consignment_packages_courier_consignment_id_fkey"
  FOREIGN KEY ("courier_consignment_id") REFERENCES "courier_consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courier_consignment_packages"
  ADD CONSTRAINT "courier_consignment_packages_order_shipment_package_id_fkey"
  FOREIGN KEY ("order_shipment_package_id") REFERENCES "order_shipment_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courier_consignment_packages"
  ADD CONSTRAINT "courier_consignment_packages_order_shipment_id_fkey"
  FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courier_consignment_packages"
  ADD CONSTRAINT "courier_consignment_packages_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courier_consignment_packages"
  ADD CONSTRAINT "courier_consignment_packages_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "order_shipment_packages" (
  "id",
  "package_number",
  "order_shipment_id",
  "order_id",
  "seller_id",
  "sequence",
  "delivery_mode",
  "status",
  "shipping_paise",
  "cod_surcharge_paise",
  "declared_value_paise",
  "currency",
  "item_allocations",
  "package_snapshot",
  "ready_for_booking_at",
  "booked_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  os."shipment_number" || '-P01',
  os."id",
  os."order_id",
  os."seller_id",
  1,
  os."delivery_mode",
  CASE
    WHEN os."courier_tracking_status" = 'BOOKED' THEN 'BOOKED'::"OrderShipmentPackageStatus"
    WHEN os."courier_tracking_status" = 'PICKED_UP' THEN 'PICKED_UP'::"OrderShipmentPackageStatus"
    WHEN os."courier_tracking_status" = 'IN_TRANSIT' THEN 'IN_TRANSIT'::"OrderShipmentPackageStatus"
    WHEN os."courier_tracking_status" = 'OUT_FOR_DELIVERY' THEN 'OUT_FOR_DELIVERY'::"OrderShipmentPackageStatus"
    WHEN os."courier_tracking_status" = 'DELIVERED' THEN 'DELIVERED'::"OrderShipmentPackageStatus"
    WHEN os."courier_tracking_status" = 'FAILED' THEN 'FAILED'::"OrderShipmentPackageStatus"
    WHEN os."courier_tracking_status" = 'CANCELLED' THEN 'CANCELLED'::"OrderShipmentPackageStatus"
    WHEN os."delivery_mode" = 'MANUAL_COURIER' THEN 'READY_FOR_BOOKING'::"OrderShipmentPackageStatus"
    ELSE 'PACKING_PENDING'::"OrderShipmentPackageStatus"
  END,
  os."shipping_paise",
  os."cod_surcharge_paise",
  os."subtotal_paise",
  o."currency",
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'orderItemId', oi."id",
          'productId', oi."product_id",
          'productVariantId', oi."product_variant_id",
          'productName', oi."product_name_snapshot",
          'quantity', oi."quantity",
          'lineTotalPaise', oi."line_total_paise"
        )
        ORDER BY oi."created_at"
      )
      FROM "order_items" oi
      WHERE oi."order_id" = os."order_id" AND oi."seller_id" = os."seller_id"
    ),
    '[]'::jsonb
  ),
  jsonb_build_object(
    'source', 'MIGRATION_DEFAULT_PACKAGE',
    'shipmentNumber', os."shipment_number",
    'legacyAwbNumber', os."awb_number",
    'legacyLabelUrl', os."label_url"
  ),
  CASE WHEN os."delivery_mode" = 'MANUAL_COURIER' THEN COALESCE(os."routed_at", os."created_at") ELSE NULL END,
  CASE WHEN os."courier_tracking_status" <> 'NOT_BOOKED' THEN os."updated_at" ELSE NULL END,
  os."created_at",
  os."updated_at"
FROM "order_shipments" os
JOIN "orders" o ON o."id" = os."order_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "order_shipment_packages" osp WHERE osp."order_shipment_id" = os."id"
);

INSERT INTO "courier_consignments" (
  "id",
  "consignment_number",
  "order_shipment_id",
  "order_id",
  "seller_id",
  "provider_code",
  "provider_order_id",
  "tracking_status",
  "tracking_status_label",
  "label_document_url",
  "booking_payload_snapshot",
  "booking_response_snapshot",
  "last_webhook_event_id",
  "last_webhook_at",
  "last_tracked_at",
  "booking_attempt_count",
  "booking_error",
  "booked_at",
  "cancelled_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  os."shipment_number" || '-C01',
  cs."order_shipment_id",
  cs."order_id",
  cs."seller_id",
  cs."provider_code",
  cs."provider_order_id",
  cs."tracking_status",
  cs."tracking_status_label",
  cs."label_url",
  cs."booking_payload_snapshot",
  cs."booking_response_snapshot",
  cs."last_webhook_event_id",
  cs."last_webhook_at",
  cs."last_tracked_at",
  cs."booking_attempt_count",
  cs."booking_error",
  cs."booked_at",
  cs."cancelled_at",
  cs."created_at",
  cs."updated_at"
FROM "courier_shipments" cs
JOIN "order_shipments" os ON os."id" = cs."order_shipment_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "courier_consignments" cc WHERE cc."order_shipment_id" = cs."order_shipment_id"
);

INSERT INTO "courier_consignment_packages" (
  "id",
  "courier_consignment_id",
  "order_shipment_package_id",
  "order_shipment_id",
  "order_id",
  "seller_id",
  "provider_package_id",
  "awb_number",
  "tracking_status",
  "tracking_status_label",
  "tracking_url",
  "label_url",
  "booked_at",
  "last_webhook_event_id",
  "last_webhook_at",
  "last_tracked_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  cc."id",
  osp."id",
  cs."order_shipment_id",
  cs."order_id",
  cs."seller_id",
  cs."provider_order_id",
  cs."awb_number",
  cs."tracking_status",
  cs."tracking_status_label",
  cs."tracking_url",
  cs."label_url",
  cs."booked_at",
  cs."last_webhook_event_id",
  cs."last_webhook_at",
  cs."last_tracked_at",
  cs."created_at",
  cs."updated_at"
FROM "courier_shipments" cs
JOIN "courier_consignments" cc ON cc."order_shipment_id" = cs."order_shipment_id"
JOIN "order_shipment_packages" osp ON osp."order_shipment_id" = cs."order_shipment_id" AND osp."sequence" = 1
WHERE NOT EXISTS (
  SELECT 1 FROM "courier_consignment_packages" ccp
  WHERE ccp."order_shipment_package_id" = osp."id"
);
