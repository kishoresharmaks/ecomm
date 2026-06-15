-- Reverse pickup assignment lifecycle for return requests.
-- Keeps delivery partner return pickups independent from buyer delivery assignments.

ALTER TABLE "reverse_shipments"
  ADD COLUMN "assignment_status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
  ADD COLUMN "pickup_proof_reference" TEXT,
  ADD COLUMN "receipt_proof_reference" TEXT,
  ADD COLUMN "received_by_name" TEXT,
  ADD COLUMN "accepted_at" TIMESTAMP(3),
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "assignment_expires_at" TIMESTAMP(3),
  ADD COLUMN "assignment_note" TEXT;

UPDATE "reverse_shipments"
SET
  "assignment_status" = 'ASSIGNED',
  "status" = CASE
    WHEN "status" = 'REQUESTED' THEN 'ASSIGNED'::"ReverseShipmentStatus"
    ELSE "status"
  END,
  "assigned_at" = COALESCE("assigned_at", "updated_at"),
  "assignment_expires_at" = COALESCE("assignment_expires_at", "updated_at" + INTERVAL '2 hours'),
  "assignment_note" = COALESCE("assignment_note", 'Existing assigned reverse shipment.')
WHERE "assigned_partner_user_id" IS NOT NULL;

CREATE TABLE "reverse_shipment_assignment_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "return_request_id" UUID NOT NULL,
  "reverse_shipment_id" UUID NOT NULL,
  "partner_user_id" UUID NOT NULL,
  "source" "DeliveryAssignmentAttemptSource" NOT NULL,
  "status" "DeliveryAssignmentStatus" NOT NULL,
  "note" TEXT,
  "assigned_by_id" UUID,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reverse_shipment_assignment_attempts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reverse_shipment_assignment_attempts"
  ADD CONSTRAINT "reverse_shipment_assignment_attempts_return_request_id_fkey"
  FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reverse_shipment_assignment_attempts"
  ADD CONSTRAINT "reverse_shipment_assignment_attempts_reverse_shipment_id_fkey"
  FOREIGN KEY ("reverse_shipment_id") REFERENCES "reverse_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reverse_shipment_assignment_attempts"
  ADD CONSTRAINT "reverse_shipment_assignment_attempts_partner_user_id_fkey"
  FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reverse_shipment_assignment_attempts"
  ADD CONSTRAINT "reverse_shipment_assignment_attempts_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "reverse_shipments_assigned_partner_user_id_assignment_status_status_idx"
  ON "reverse_shipments"("assigned_partner_user_id", "assignment_status", "status");

CREATE INDEX "reverse_shipments_assignment_status_status_created_at_idx"
  ON "reverse_shipments"("assignment_status", "status", "created_at");

CREATE INDEX "reverse_shipments_assignment_expires_at_assignment_status_idx"
  ON "reverse_shipments"("assignment_expires_at", "assignment_status");

CREATE INDEX "reverse_shipment_assignment_attempts_return_request_id_created_at_idx"
  ON "reverse_shipment_assignment_attempts"("return_request_id", "created_at");

CREATE INDEX "reverse_shipment_assignment_attempts_reverse_shipment_id_created_at_idx"
  ON "reverse_shipment_assignment_attempts"("reverse_shipment_id", "created_at");

CREATE INDEX "reverse_shipment_assignment_attempts_partner_user_id_status_idx"
  ON "reverse_shipment_assignment_attempts"("partner_user_id", "status");

CREATE INDEX "reverse_shipment_assignment_attempts_source_status_idx"
  ON "reverse_shipment_assignment_attempts"("source", "status");

CREATE INDEX "reverse_shipment_assignment_attempts_assigned_by_id_idx"
  ON "reverse_shipment_assignment_attempts"("assigned_by_id");
