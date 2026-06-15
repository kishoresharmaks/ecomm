ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "orders_customer_id_idempotency_key_key"
  ON "orders"("customer_id", "idempotency_key");
