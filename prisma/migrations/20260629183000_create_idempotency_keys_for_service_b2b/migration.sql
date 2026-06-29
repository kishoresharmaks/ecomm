ALTER TABLE "service_bookings" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "service_bookings_customer_id_idempotency_key_key"
  ON "service_bookings"("customer_id", "idempotency_key");

ALTER TABLE "b2b_enquiries" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "b2b_enquiries_business_buyer_id_idempotency_key_key"
  ON "b2b_enquiries"("business_buyer_id", "idempotency_key");
