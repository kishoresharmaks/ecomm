ALTER TABLE "service_payments"
  ADD COLUMN "provider_order_creation_in_progress" BOOLEAN NOT NULL DEFAULT false;
