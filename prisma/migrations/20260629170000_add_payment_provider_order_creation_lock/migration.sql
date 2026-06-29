ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "provider_order_creation_in_progress" BOOLEAN NOT NULL DEFAULT false;
