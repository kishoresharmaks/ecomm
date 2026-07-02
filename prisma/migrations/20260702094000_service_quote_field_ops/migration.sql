-- Add service quote withdrawal audit and technician field-ops timestamps.
ALTER TABLE "service_bookings"
  ADD COLUMN "technician_en_route_at" TIMESTAMP(3),
  ADD COLUMN "technician_arrived_at" TIMESTAMP(3),
  ADD COLUMN "technician_check_in_at" TIMESTAMP(3),
  ADD COLUMN "technician_check_out_at" TIMESTAMP(3),
  ADD COLUMN "technician_field_status_note" TEXT,
  ADD COLUMN "technician_field_proof_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "technician_last_latitude" DECIMAL(10,7),
  ADD COLUMN "technician_last_longitude" DECIMAL(10,7);

ALTER TABLE "service_quotes"
  ADD COLUMN "withdrawn_at" TIMESTAMP(3),
  ADD COLUMN "withdrawn_by" UUID,
  ADD COLUMN "withdrawal_note" TEXT;

ALTER TABLE "service_quotes"
  ADD CONSTRAINT "service_quotes_withdrawn_by_fkey"
  FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "service_quotes_withdrawn_by_idx" ON "service_quotes"("withdrawn_by");

ALTER TYPE "PushNotificationType" ADD VALUE IF NOT EXISTS 'SERVICE_BOOKING';
