-- Cancellation, return, refund, and replacement production workflow.
-- Adds item-quantity lifecycle tracking and PostgreSQL-indexed return/refund queues.

CREATE TYPE "OrderItemLifecycleStatus" AS ENUM (
  'ACTIVE',
  'PARTIALLY_CANCELLED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'REPLACEMENT_REQUESTED',
  'REPLACED'
);

CREATE TYPE "ReturnRequestStatus" AS ENUM (
  'PENDING_REVIEW',
  'AUTO_APPROVED',
  'APPROVED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'RECEIVED',
  'QC_PASSED',
  'QC_FAILED',
  'RESOLVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "ReturnRequestItemStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'RECEIVED',
  'QC_PASSED',
  'QC_FAILED',
  'REFUND_REQUESTED',
  'REPLACEMENT_CREATED',
  'CLOSED'
);

CREATE TYPE "ReturnRequestResolution" AS ENUM (
  'REFUND',
  'REPLACEMENT',
  'PARTIAL_REFUND',
  'REJECTED'
);

CREATE TYPE "RefundRequestStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'INITIATED',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'RETRY_PENDING',
  'CANCELLED'
);

CREATE TYPE "RefundTransactionStatus" AS ENUM (
  'INITIATED',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "RefundMethod" AS ENUM (
  'RAZORPAY',
  'COD_CASH',
  'BANK_TRANSFER',
  'UPI',
  'MANUAL'
);

CREATE TYPE "RefundReason" AS ENUM (
  'ORDER_CANCELLED',
  'ITEM_CANCELLED',
  'RETURN_REFUND',
  'RETURN_PARTIAL_REFUND',
  'SELLER_NON_FULFILMENT',
  'DAMAGED_LOST_SHIPMENT',
  'GOODWILL_ADJUSTMENT',
  'RTO_REFUND',
  'ADMIN_ADJUSTMENT'
);

CREATE TYPE "ReverseShipmentMode" AS ENUM (
  'PLATFORM_PICKUP',
  'CUSTOMER_SELF_SHIP'
);

CREATE TYPE "ReverseShipmentStatus" AS ENUM (
  'REQUESTED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'RECEIVED',
  'FAILED',
  'CANCELLED'
);

ALTER TABLE "order_items"
  ADD COLUMN "active_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cancelled_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "returned_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refunded_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "replacement_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "retained_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lifecycle_status" "OrderItemLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "cancelled_amount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "returned_amount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refunded_amount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "replacement_amount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "return_policy_snapshot" JSONB,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "order_items"
SET
  "active_quantity" = "quantity",
  "retained_quantity" = "quantity",
  "updated_at" = CURRENT_TIMESTAMP
WHERE "active_quantity" = 0 AND "retained_quantity" = 0;

CREATE TABLE "return_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "request_number" TEXT NOT NULL,
  "order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "resolution" "ReturnRequestResolution" NOT NULL DEFAULT 'REFUND',
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "auto_approved" BOOLEAN NOT NULL DEFAULT false,
  "total_quantity" INTEGER NOT NULL DEFAULT 0,
  "requested_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "approved_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_request_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "return_request_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "order_seller_split_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "product_variant_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "ReturnRequestItemStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "resolution" "ReturnRequestResolution" NOT NULL DEFAULT 'REFUND',
  "reason" TEXT NOT NULL,
  "requested_refund_paise" INTEGER NOT NULL DEFAULT 0,
  "approved_refund_paise" INTEGER NOT NULL DEFAULT 0,
  "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "coupon_platform_funded_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "coupon_seller_funded_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "qc_note" TEXT,
  "seller_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_request_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_request_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "return_request_id" UUID NOT NULL,
  "seller_id" UUID,
  "note" TEXT NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_request_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "refund_number" TEXT NOT NULL,
  "order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "payment_id" UUID,
  "return_request_id" UUID,
  "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reason" "RefundReason" NOT NULL,
  "method" "RefundMethod",
  "amount_paise" INTEGER NOT NULL DEFAULT 0,
  "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "seller_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "note" TEXT,
  "approved_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_request_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "refund_request_id" UUID NOT NULL,
  "return_request_item_id" UUID,
  "order_item_id" UUID NOT NULL,
  "order_seller_split_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount_paise" INTEGER NOT NULL DEFAULT 0,
  "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "seller_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_request_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "refund_request_id" UUID NOT NULL,
  "payment_id" UUID,
  "provider" "PaymentProvider",
  "method" "RefundMethod" NOT NULL,
  "status" "RefundTransactionStatus" NOT NULL DEFAULT 'INITIATED',
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "provider_refund_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "manual_reference" TEXT,
  "paid_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "raw_response" JSONB,
  "created_by" UUID,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reverse_shipments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "return_request_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "assigned_partner_user_id" UUID,
  "mode" "ReverseShipmentMode" NOT NULL DEFAULT 'PLATFORM_PICKUP',
  "status" "ReverseShipmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "awb_number" TEXT,
  "courier_name" TEXT,
  "tracking_reference" TEXT,
  "proof_reference" TEXT,
  "pickup_note" TEXT,
  "assigned_at" TIMESTAMP(3),
  "picked_up_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reverse_shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reverse_shipment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reverse_shipment_id" UUID NOT NULL,
  "old_status" "ReverseShipmentStatus",
  "new_status" "ReverseShipmentStatus" NOT NULL,
  "note" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reverse_shipment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "return_requests_request_number_key" ON "return_requests"("request_number");
CREATE INDEX "return_requests_customer_id_status_created_at_idx" ON "return_requests"("customer_id", "status", "created_at");
CREATE INDEX "return_requests_order_id_idx" ON "return_requests"("order_id");
CREATE INDEX "return_requests_status_created_at_idx" ON "return_requests"("status", "created_at");
CREATE INDEX "return_requests_created_at_idx" ON "return_requests"("created_at");
CREATE INDEX "return_requests_reviewed_by_idx" ON "return_requests"("reviewed_by");
CREATE INDEX "return_requests_created_by_idx" ON "return_requests"("created_by");

CREATE INDEX "return_request_items_return_request_id_idx" ON "return_request_items"("return_request_id");
CREATE INDEX "return_request_items_order_id_idx" ON "return_request_items"("order_id");
CREATE INDEX "return_request_items_order_item_id_idx" ON "return_request_items"("order_item_id");
CREATE INDEX "return_request_items_seller_id_status_idx" ON "return_request_items"("seller_id", "status");
CREATE INDEX "return_request_items_order_seller_split_id_idx" ON "return_request_items"("order_seller_split_id");
CREATE INDEX "return_request_items_status_created_at_idx" ON "return_request_items"("status", "created_at");

CREATE INDEX "return_request_notes_return_request_id_created_at_idx" ON "return_request_notes"("return_request_id", "created_at");
CREATE INDEX "return_request_notes_seller_id_created_at_idx" ON "return_request_notes"("seller_id", "created_at");
CREATE INDEX "return_request_notes_created_by_idx" ON "return_request_notes"("created_by");

CREATE UNIQUE INDEX "refund_requests_refund_number_key" ON "refund_requests"("refund_number");
CREATE INDEX "refund_requests_order_id_idx" ON "refund_requests"("order_id");
CREATE INDEX "refund_requests_customer_id_status_created_at_idx" ON "refund_requests"("customer_id", "status", "created_at");
CREATE INDEX "refund_requests_payment_id_idx" ON "refund_requests"("payment_id");
CREATE INDEX "refund_requests_status_created_at_idx" ON "refund_requests"("status", "created_at");
CREATE INDEX "refund_requests_return_request_id_idx" ON "refund_requests"("return_request_id");
CREATE INDEX "refund_requests_reviewed_by_idx" ON "refund_requests"("reviewed_by");
CREATE INDEX "refund_requests_created_by_idx" ON "refund_requests"("created_by");

CREATE INDEX "refund_request_items_refund_request_id_idx" ON "refund_request_items"("refund_request_id");
CREATE INDEX "refund_request_items_return_request_item_id_idx" ON "refund_request_items"("return_request_item_id");
CREATE INDEX "refund_request_items_order_item_id_idx" ON "refund_request_items"("order_item_id");
CREATE INDEX "refund_request_items_seller_id_created_at_idx" ON "refund_request_items"("seller_id", "created_at");
CREATE INDEX "refund_request_items_order_seller_split_id_idx" ON "refund_request_items"("order_seller_split_id");

CREATE UNIQUE INDEX "refund_transactions_idempotency_key_key" ON "refund_transactions"("idempotency_key");
CREATE UNIQUE INDEX "refund_transactions_provider_provider_refund_id_key" ON "refund_transactions"("provider", "provider_refund_id");
CREATE INDEX "refund_transactions_refund_request_id_idx" ON "refund_transactions"("refund_request_id");
CREATE INDEX "refund_transactions_payment_id_idx" ON "refund_transactions"("payment_id");
CREATE INDEX "refund_transactions_status_created_at_idx" ON "refund_transactions"("status", "created_at");
CREATE INDEX "refund_transactions_created_by_idx" ON "refund_transactions"("created_by");

CREATE UNIQUE INDEX "reverse_shipments_awb_number_key" ON "reverse_shipments"("awb_number");
CREATE INDEX "reverse_shipments_return_request_id_idx" ON "reverse_shipments"("return_request_id");
CREATE INDEX "reverse_shipments_seller_id_status_idx" ON "reverse_shipments"("seller_id", "status");
CREATE INDEX "reverse_shipments_assigned_partner_user_id_status_idx" ON "reverse_shipments"("assigned_partner_user_id", "status");
CREATE INDEX "reverse_shipments_order_id_idx" ON "reverse_shipments"("order_id");
CREATE INDEX "reverse_shipments_status_created_at_idx" ON "reverse_shipments"("status", "created_at");

CREATE INDEX "reverse_shipment_events_reverse_shipment_id_created_at_idx" ON "reverse_shipment_events"("reverse_shipment_id", "created_at");
CREATE INDEX "reverse_shipment_events_created_by_idx" ON "reverse_shipment_events"("created_by");

CREATE INDEX "order_items_lifecycle_status_idx" ON "order_items"("lifecycle_status");
CREATE INDEX "order_items_order_id_lifecycle_status_idx" ON "order_items"("order_id", "lifecycle_status");
CREATE INDEX "order_items_seller_id_lifecycle_status_idx" ON "order_items"("seller_id", "lifecycle_status");

ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "return_request_notes" ADD CONSTRAINT "return_request_notes_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_notes" ADD CONSTRAINT "return_request_notes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_request_notes" ADD CONSTRAINT "return_request_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_return_request_item_id_fkey" FOREIGN KEY ("return_request_item_id") REFERENCES "return_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_assigned_partner_user_id_fkey" FOREIGN KEY ("assigned_partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reverse_shipment_events" ADD CONSTRAINT "reverse_shipment_events_reverse_shipment_id_fkey" FOREIGN KEY ("reverse_shipment_id") REFERENCES "reverse_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reverse_shipment_events" ADD CONSTRAINT "reverse_shipment_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
