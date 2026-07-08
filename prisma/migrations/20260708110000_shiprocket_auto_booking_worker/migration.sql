ALTER TABLE "order_shipments"
  ADD COLUMN "ready_for_booking_at" TIMESTAMP(3),
  ADD COLUMN "booking_in_progress" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "booking_claimed_at" TIMESTAMP(3),
  ADD COLUMN "booking_next_attempt_at" TIMESTAMP(3);

UPDATE "order_shipments" os
SET "ready_for_booking_at" = ready."ready_for_booking_at"
FROM (
  SELECT
    osp."order_shipment_id",
    MIN(osp."ready_for_booking_at") AS "ready_for_booking_at"
  FROM "order_shipment_packages" osp
  WHERE osp."ready_for_booking_at" IS NOT NULL
  GROUP BY osp."order_shipment_id"
) ready
WHERE os.id = ready."order_shipment_id"
  AND os."ready_for_booking_at" IS NULL;

CREATE INDEX "order_shipments_ready_for_booking_at_booking_next_attempt_at_idx"
  ON "order_shipments"("ready_for_booking_at", "booking_next_attempt_at");

CREATE INDEX "order_shipments_booking_in_progress_booking_claimed_at_idx"
  ON "order_shipments"("booking_in_progress", "booking_claimed_at");
