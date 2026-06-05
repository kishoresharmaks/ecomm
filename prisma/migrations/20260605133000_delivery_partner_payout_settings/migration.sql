-- Dynamic delivery partner payout settings and manual payout requests.
-- Settings are DB-managed and apply prospectively to future wallet credits.
-- Historical wallet entries keep their stored metadata/settings snapshot.

CREATE TYPE "DeliveryPartnerPayoutStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'PAID'
);

CREATE TABLE "delivery_partner_payouts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payout_number" TEXT NOT NULL,
  "partner_user_id" UUID NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "DeliveryPartnerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "settings_snapshot" JSONB,
  "requested_by_id" UUID,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by_id" UUID,
  "approved_at" TIMESTAMP(3),
  "paid_by_id" UUID,
  "paid_at" TIMESTAMP(3),
  "payment_mode" TEXT,
  "transaction_reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_partner_payouts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "delivery_partner_wallet_entries"
  ADD COLUMN "payout_id" UUID;

ALTER TABLE "delivery_partner_payouts"
  ADD CONSTRAINT "delivery_partner_payouts_partner_user_id_fkey"
  FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_payouts"
  ADD CONSTRAINT "delivery_partner_payouts_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_payouts"
  ADD CONSTRAINT "delivery_partner_payouts_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_payouts"
  ADD CONSTRAINT "delivery_partner_payouts_paid_by_id_fkey"
  FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_wallet_entries"
  ADD CONSTRAINT "delivery_partner_wallet_entries_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "delivery_partner_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "delivery_partner_payouts_payout_number_key"
  ON "delivery_partner_payouts"("payout_number");

CREATE UNIQUE INDEX "delivery_partner_wallet_entries_payout_id_entry_type_key"
  ON "delivery_partner_wallet_entries"("payout_id", "entry_type");

CREATE INDEX "delivery_partner_payouts_partner_user_id_status_created_at_idx"
  ON "delivery_partner_payouts"("partner_user_id", "status", "created_at");

CREATE INDEX "delivery_partner_payouts_status_created_at_idx"
  ON "delivery_partner_payouts"("status", "created_at");

CREATE INDEX "delivery_partner_payouts_requested_by_id_idx"
  ON "delivery_partner_payouts"("requested_by_id");

CREATE INDEX "delivery_partner_payouts_approved_by_id_idx"
  ON "delivery_partner_payouts"("approved_by_id");

CREATE INDEX "delivery_partner_payouts_paid_by_id_idx"
  ON "delivery_partner_payouts"("paid_by_id");

CREATE INDEX "delivery_partner_wallet_entries_payout_id_idx"
  ON "delivery_partner_wallet_entries"("payout_id");

INSERT INTO "settings" ("id", "key", "group", "value_type", "value", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'delivery_partner.payout.minimum_per_order_paise', 'delivery_partner_payouts', 'NUMBER', '4000'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delivery_partner.payout.base_pay_paise', 'delivery_partner_payouts', 'NUMBER', '2500'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delivery_partner.payout.per_km_paise', 'delivery_partner_payouts', 'NUMBER', '800'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delivery_partner.payout.cod_bonus_paise', 'delivery_partner_payouts', 'NUMBER', '500'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delivery_partner.payout.minimum_wallet_payout_paise', 'delivery_partner_payouts', 'NUMBER', '100000'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delivery_partner.payout.requests_enabled', 'delivery_partner_payouts', 'BOOLEAN', 'true'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'delivery_partner.payout.free_delivery_platform_subsidy_enabled', 'delivery_partner_payouts', 'BOOLEAN', 'true'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
