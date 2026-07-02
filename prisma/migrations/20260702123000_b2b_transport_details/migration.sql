CREATE TYPE "B2BTransportMode" AS ENUM (
  'STORE_PICKUP',
  'SELLER_ARRANGED_TRANSPORT'
);

CREATE TYPE "B2BTransportStatus" AS ENUM (
  'NOT_REQUIRED',
  'REQUESTED',
  'QUOTED',
  'READY_FOR_PICKUP',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED'
);

ALTER TYPE "B2BAdminAction" ADD VALUE IF NOT EXISTS 'UPDATE_TRANSPORT';

ALTER TABLE "b2b_enquiries"
ADD COLUMN "transport_mode" "B2BTransportMode" NOT NULL DEFAULT 'SELLER_ARRANGED_TRANSPORT',
ADD COLUMN "transport_note" TEXT;

ALTER TABLE "b2b_enquiry_responses"
ADD COLUMN "transport_charge_paise" INTEGER,
ADD COLUMN "transport_eta" TEXT,
ADD COLUMN "transport_note" TEXT;

ALTER TABLE "b2b_orders"
ADD COLUMN "transport_mode" "B2BTransportMode" NOT NULL DEFAULT 'SELLER_ARRANGED_TRANSPORT',
ADD COLUMN "transport_status" "B2BTransportStatus" NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN "transport_charge_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "transport_charge_locked_at" TIMESTAMP(3),
ADD COLUMN "transport_quoted_at" TIMESTAMP(3),
ADD COLUMN "transport_partner_name" TEXT,
ADD COLUMN "transport_partner_phone" TEXT,
ADD COLUMN "transport_tracking_ref" TEXT,
ADD COLUMN "transport_eta" TEXT,
ADD COLUMN "transport_dispatched_at" TIMESTAMP(3),
ADD COLUMN "transport_delivered_at" TIMESTAMP(3),
ADD COLUMN "transport_pickup_address" TEXT,
ADD COLUMN "transport_note" TEXT;

UPDATE "b2b_orders"
SET "transport_status" = 'NOT_REQUIRED'
WHERE "transport_mode" = 'STORE_PICKUP';

CREATE INDEX "b2b_orders_transport_status_idx" ON "b2b_orders"("transport_status");
CREATE INDEX "b2b_orders_transport_mode_status_idx" ON "b2b_orders"("transport_mode", "transport_status");
