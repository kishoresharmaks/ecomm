CREATE TYPE "B2BOrderStatus" AS ENUM (
  'PROFORMA_ISSUED',
  'PO_SUBMITTED',
  'PO_ACCEPTED',
  'IN_FULFILMENT',
  'FULFILLED',
  'CANCELLED'
);

CREATE TABLE "b2b_orders" (
  "id" UUID NOT NULL,
  "order_number" TEXT NOT NULL,
  "enquiry_id" UUID NOT NULL,
  "business_buyer_id" UUID NOT NULL,
  "seller_id" UUID,
  "product_id" UUID,
  "selected_response_id" UUID,
  "status" "B2BOrderStatus" NOT NULL DEFAULT 'PROFORMA_ISSUED',
  "proforma_invoice_number" TEXT NOT NULL,
  "proforma_issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proforma_expires_at" TIMESTAMP(3),
  "purchase_order_number" TEXT,
  "purchase_order_file_key" TEXT,
  "purchase_order_note" TEXT,
  "purchase_order_submitted_at" TIMESTAMP(3),
  "purchase_order_accepted_at" TIMESTAMP(3),
  "fulfilled_at" TIMESTAMP(3),
  "quantity" INTEGER NOT NULL,
  "unit_price_paise" INTEGER,
  "subtotal_paise" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "terms_snapshot" JSONB,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "b2b_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "b2b_order_events" (
  "id" UUID NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "status" "B2BOrderStatus" NOT NULL,
  "note" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "b2b_order_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "b2b_orders_order_number_key" ON "b2b_orders"("order_number");
CREATE UNIQUE INDEX "b2b_orders_enquiry_id_key" ON "b2b_orders"("enquiry_id");
CREATE UNIQUE INDEX "b2b_orders_proforma_invoice_number_key" ON "b2b_orders"("proforma_invoice_number");
CREATE INDEX "b2b_orders_business_buyer_id_idx" ON "b2b_orders"("business_buyer_id");
CREATE INDEX "b2b_orders_seller_id_idx" ON "b2b_orders"("seller_id");
CREATE INDEX "b2b_orders_product_id_idx" ON "b2b_orders"("product_id");
CREATE INDEX "b2b_orders_selected_response_id_idx" ON "b2b_orders"("selected_response_id");
CREATE INDEX "b2b_orders_status_idx" ON "b2b_orders"("status");
CREATE INDEX "b2b_orders_created_at_idx" ON "b2b_orders"("created_at");
CREATE INDEX "b2b_orders_business_buyer_id_status_created_at_idx" ON "b2b_orders"("business_buyer_id", "status", "created_at");
CREATE INDEX "b2b_orders_seller_id_status_created_at_idx" ON "b2b_orders"("seller_id", "status", "created_at");
CREATE INDEX "b2b_order_events_b2b_order_id_idx" ON "b2b_order_events"("b2b_order_id");
CREATE INDEX "b2b_order_events_actor_user_id_idx" ON "b2b_order_events"("actor_user_id");
CREATE INDEX "b2b_order_events_status_idx" ON "b2b_order_events"("status");
CREATE INDEX "b2b_order_events_created_at_idx" ON "b2b_order_events"("created_at");

ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_business_buyer_id_fkey" FOREIGN KEY ("business_buyer_id") REFERENCES "business_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_selected_response_id_fkey" FOREIGN KEY ("selected_response_id") REFERENCES "b2b_enquiry_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_order_events" ADD CONSTRAINT "b2b_order_events_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "b2b_order_events" ADD CONSTRAINT "b2b_order_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
