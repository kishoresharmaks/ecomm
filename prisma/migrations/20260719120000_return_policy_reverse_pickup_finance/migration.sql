ALTER TYPE "DeliveryPartnerWalletEntryType" ADD VALUE IF NOT EXISTS 'REVERSE_PICKUP_EARNING';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'REVERSE_LOGISTICS_FEE';

ALTER TABLE "return_requests"
ADD COLUMN IF NOT EXISTS "reverse_shipment_mode" "ReverseShipmentMode" NOT NULL DEFAULT 'PLATFORM_PICKUP';

ALTER TABLE "delivery_partner_wallet_entries"
ADD COLUMN IF NOT EXISTS "reverse_shipment_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS
"delivery_partner_wallet_entries_reverse_shipment_id_entry_type_key"
ON "delivery_partner_wallet_entries"("reverse_shipment_id", "entry_type");

ALTER TABLE "delivery_partner_wallet_entries"
ADD CONSTRAINT "delivery_partner_wallet_entries_reverse_shipment_id_fkey"
FOREIGN KEY ("reverse_shipment_id") REFERENCES "reverse_shipments"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
