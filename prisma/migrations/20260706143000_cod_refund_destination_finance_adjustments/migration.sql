ALTER TABLE "return_requests"
  ADD COLUMN IF NOT EXISTS "refund_destination_snapshot" JSONB;

ALTER TABLE "refund_requests"
  ADD COLUMN IF NOT EXISTS "approved_amount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_destination_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "amount_adjustment_note" TEXT,
  ADD COLUMN IF NOT EXISTS "amount_adjusted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "amount_adjusted_by" UUID;

UPDATE "refund_requests"
SET "approved_amount_paise" = "amount_paise"
WHERE "approved_amount_paise" = 0
  AND "amount_paise" > 0;

CREATE INDEX IF NOT EXISTS "refund_requests_amount_adjusted_by_idx"
  ON "refund_requests"("amount_adjusted_by");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_requests_amount_adjusted_by_fkey'
  ) THEN
    ALTER TABLE "refund_requests"
      ADD CONSTRAINT "refund_requests_amount_adjusted_by_fkey"
      FOREIGN KEY ("amount_adjusted_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
