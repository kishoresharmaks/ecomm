ALTER TABLE "b2b_orders"
  ADD COLUMN IF NOT EXISTS "payout_id" UUID,
  ADD COLUMN IF NOT EXISTS "settlement_status" "SellerSettlementStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
  ADD COLUMN IF NOT EXISTS "settlement_eligible_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = current_schema()
      AND table_name = 'b2b_orders'
      AND constraint_name = 'b2b_orders_payout_id_fkey'
  ) THEN
    ALTER TABLE "b2b_orders"
      ADD CONSTRAINT "b2b_orders_payout_id_fkey"
      FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "b2b_orders_payout_id_idx" ON "b2b_orders"("payout_id");
CREATE INDEX IF NOT EXISTS "b2b_orders_settlement_status_idx" ON "b2b_orders"("settlement_status");
CREATE INDEX IF NOT EXISTS "b2b_orders_seller_id_settlement_status_created_at_idx" ON "b2b_orders"("seller_id", "settlement_status", "created_at");
