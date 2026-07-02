CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "service_bookings"
  ADD COLUMN IF NOT EXISTS "assigned_technician_id" UUID;

CREATE TABLE IF NOT EXISTS "seller_service_technicians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_service_technicians_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_service_availability_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_service_availability_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "seller_service_blocked_windows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "is_full_day" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_service_blocked_windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seller_service_technicians_seller_id_is_active_idx"
  ON "seller_service_technicians"("seller_id", "is_active");

CREATE INDEX IF NOT EXISTS "seller_service_availability_rules_seller_id_day_of_week_is_active_idx"
  ON "seller_service_availability_rules"("seller_id", "day_of_week", "is_active");

CREATE INDEX IF NOT EXISTS "seller_service_blocked_windows_seller_id_starts_at_ends_at_idx"
  ON "seller_service_blocked_windows"("seller_id", "starts_at", "ends_at");

CREATE INDEX IF NOT EXISTS "service_bookings_assigned_technician_id_scheduled_start_at_idx"
  ON "service_bookings"("assigned_technician_id", "scheduled_start_at");

ALTER TABLE "seller_service_technicians"
  ADD CONSTRAINT "seller_service_technicians_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_service_availability_rules"
  ADD CONSTRAINT "seller_service_availability_rules_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_service_blocked_windows"
  ADD CONSTRAINT "seller_service_blocked_windows_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_bookings"
  ADD CONSTRAINT "service_bookings_assigned_technician_id_fkey"
  FOREIGN KEY ("assigned_technician_id") REFERENCES "seller_service_technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
