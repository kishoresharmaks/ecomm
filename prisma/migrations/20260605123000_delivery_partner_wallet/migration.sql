-- Delivery partner wallet for local delivery partner earnings.
-- This records web-workspace earnings for local delivery partners only.
-- Third-party courier COD/remittance remains in courier remittance/provider finance tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "DeliveryPartnerWalletEntryType" AS ENUM (
  'LOCAL_DELIVERY_EARNING',
  'MANUAL_ADJUSTMENT',
  'MANUAL_PAYOUT'
);

CREATE TYPE "DeliveryPartnerWalletEntryDirection" AS ENUM (
  'CREDIT',
  'DEBIT'
);

CREATE TABLE "delivery_partner_wallet_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_user_id" UUID NOT NULL,
  "order_id" UUID,
  "order_shipment_id" UUID,
  "delivery_detail_id" UUID,
  "entry_type" "DeliveryPartnerWalletEntryType" NOT NULL,
  "direction" "DeliveryPartnerWalletEntryDirection" NOT NULL DEFAULT 'CREDIT',
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "description" TEXT,
  "metadata" JSONB,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_partner_wallet_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "delivery_partner_wallet_entries"
  ADD CONSTRAINT "delivery_partner_wallet_entries_partner_user_id_fkey"
  FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_wallet_entries"
  ADD CONSTRAINT "delivery_partner_wallet_entries_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_wallet_entries"
  ADD CONSTRAINT "delivery_partner_wallet_entries_order_shipment_id_fkey"
  FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_wallet_entries"
  ADD CONSTRAINT "delivery_partner_wallet_entries_delivery_detail_id_fkey"
  FOREIGN KEY ("delivery_detail_id") REFERENCES "delivery_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_wallet_entries"
  ADD CONSTRAINT "delivery_partner_wallet_entries_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "delivery_partner_wallet_entries_order_shipment_id_entry_type_key"
  ON "delivery_partner_wallet_entries"("order_shipment_id", "entry_type");

CREATE INDEX "delivery_partner_wallet_entries_partner_user_id_created_at_idx"
  ON "delivery_partner_wallet_entries"("partner_user_id", "created_at");

CREATE INDEX "delivery_partner_wallet_entries_partner_user_id_entry_type_created_at_idx"
  ON "delivery_partner_wallet_entries"("partner_user_id", "entry_type", "created_at");

CREATE INDEX "delivery_partner_wallet_entries_order_id_idx"
  ON "delivery_partner_wallet_entries"("order_id");

CREATE INDEX "delivery_partner_wallet_entries_order_shipment_id_idx"
  ON "delivery_partner_wallet_entries"("order_shipment_id");

CREATE INDEX "delivery_partner_wallet_entries_delivery_detail_id_idx"
  ON "delivery_partner_wallet_entries"("delivery_detail_id");

CREATE INDEX "delivery_partner_wallet_entries_created_by_id_idx"
  ON "delivery_partner_wallet_entries"("created_by_id");
