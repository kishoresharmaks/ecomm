CREATE TABLE IF NOT EXISTS "seller_service_areas" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "label" TEXT,
  "country_code" TEXT,
  "state_code" TEXT,
  "city_code" TEXT,
  "local_area_code" TEXT,
  "pincode" TEXT,
  "latitude" DECIMAL(10, 7),
  "longitude" DECIMAL(10, 7),
  "radius_km" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "seller_service_areas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seller_service_areas_seller_id_idx" ON "seller_service_areas"("seller_id");
CREATE INDEX IF NOT EXISTS "seller_service_areas_seller_id_is_active_idx" ON "seller_service_areas"("seller_id", "is_active");
CREATE INDEX IF NOT EXISTS "seller_service_areas_country_code_state_code_city_code_idx" ON "seller_service_areas"("country_code", "state_code", "city_code");
CREATE INDEX IF NOT EXISTS "seller_service_areas_local_area_code_idx" ON "seller_service_areas"("local_area_code");
CREATE INDEX IF NOT EXISTS "seller_service_areas_pincode_idx" ON "seller_service_areas"("pincode");

ALTER TABLE "seller_service_areas"
  ADD CONSTRAINT "seller_service_areas_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
