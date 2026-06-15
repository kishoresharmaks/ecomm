-- Add acceptance timeout support for forward delivery partner assignments.
ALTER TABLE "delivery_details"
  ADD COLUMN "assignment_expires_at" TIMESTAMP(3);

ALTER TABLE "order_shipments"
  ADD COLUMN "assignment_expires_at" TIMESTAMP(3);

CREATE INDEX "delivery_details_assignment_expires_at_assignment_status_idx"
  ON "delivery_details"("assignment_expires_at", "assignment_status");

CREATE INDEX "order_shipments_assignment_expires_at_assignment_status_idx"
  ON "order_shipments"("assignment_expires_at", "assignment_status");
