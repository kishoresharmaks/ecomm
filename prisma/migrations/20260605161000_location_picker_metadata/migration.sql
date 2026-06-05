-- Location picker metadata for customer and seller pickup coordinates.
-- Coordinates stay the primary source of truth; metadata captures source and quality.

DO $$
BEGIN
  CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MAP_PICK', 'MANUAL', 'REVERSE_GEOCODE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "customer_addresses"
  ADD COLUMN IF NOT EXISTS "location_source" "LocationSource",
  ADD COLUMN IF NOT EXISTS "accuracy_meters" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "location_confidence_score" DECIMAL(5, 2);

ALTER TABLE "seller_addresses"
  ADD COLUMN IF NOT EXISTS "location_source" "LocationSource",
  ADD COLUMN IF NOT EXISTS "accuracy_meters" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "location_confidence_score" DECIMAL(5, 2);
