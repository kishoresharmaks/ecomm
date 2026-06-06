-- Delivery partner application queue.
-- Public applicants submit here first; admin approval creates the DELIVERY_PARTNER role/profile.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "DeliveryPartnerApplicationStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "delivery_partner_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "status" "DeliveryPartnerApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "alternate_phone" TEXT,
  "vehicle_type" TEXT NOT NULL,
  "vehicle_number" TEXT NOT NULL,
  "driving_license_number" TEXT,
  "experience_summary" TEXT,
  "service_country_code" TEXT,
  "service_state_code" TEXT,
  "service_city_code" TEXT,
  "service_pincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "service_local_area_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "address_line_1" TEXT NOT NULL,
  "address_line_2" TEXT,
  "area" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'India',
  "base_latitude" DECIMAL(10,7),
  "base_longitude" DECIMAL(10,7),
  "location_source" "LocationSource",
  "accuracy_meters" DECIMAL(10,2),
  "location_confidence_score" DECIMAL(5,2),
  "service_radius_km" INTEGER,
  "availability_notes" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_id" UUID,
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_partner_applications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "delivery_partner_applications"
  ADD CONSTRAINT "delivery_partner_applications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_partner_applications"
  ADD CONSTRAINT "delivery_partner_applications_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "delivery_partner_applications_user_id_key"
  ON "delivery_partner_applications"("user_id");

CREATE INDEX "delivery_partner_applications_status_created_at_idx"
  ON "delivery_partner_applications"("status", "created_at");

CREATE INDEX "delivery_partner_applications_email_idx"
  ON "delivery_partner_applications"("email");

CREATE INDEX "delivery_partner_applications_phone_idx"
  ON "delivery_partner_applications"("phone");

CREATE INDEX "delivery_partner_applications_service_country_code_service_state_code_service_city_code_idx"
  ON "delivery_partner_applications"("service_country_code", "service_state_code", "service_city_code");

CREATE INDEX "delivery_partner_applications_reviewed_by_id_idx"
  ON "delivery_partner_applications"("reviewed_by_id");
