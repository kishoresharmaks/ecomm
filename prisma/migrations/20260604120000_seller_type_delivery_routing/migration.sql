-- Production-ready seller-type delivery routing.
-- Deploy this schema migration before enabling wholesale bulky routing.

ALTER TYPE "DeliveryMode" ADD VALUE IF NOT EXISTS 'MANUAL_TRANSPORT';

ALTER TABLE "order_shipments"
  ADD COLUMN IF NOT EXISTS "routing_first_failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "routing_last_attempt_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "routing_retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "routing_permanent_failure_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "routing_snapshot" JSONB;

ALTER TABLE "delivery_partner_profiles"
  ADD COLUMN IF NOT EXISTS "base_latitude" DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "base_longitude" DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "service_radius_km" INTEGER;

CREATE INDEX IF NOT EXISTS "order_shipments_routing_failed_routing_first_failed_at_idx"
  ON "order_shipments"("routing_failed", "routing_first_failed_at");

CREATE INDEX IF NOT EXISTS "order_shipments_routing_permanent_failure_at_idx"
  ON "order_shipments"("routing_permanent_failure_at");

CREATE INDEX IF NOT EXISTS "delivery_partner_profiles_base_latitude_base_longitude_idx"
  ON "delivery_partner_profiles"("base_latitude", "base_longitude");
