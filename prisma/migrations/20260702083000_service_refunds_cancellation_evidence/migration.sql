-- Service refund, cancellation policy, and managed evidence workflow.

ALTER TYPE "RefundReason" ADD VALUE IF NOT EXISTS 'SERVICE_BOOKING_CANCELLED';
ALTER TYPE "RefundReason" ADD VALUE IF NOT EXISTS 'SERVICE_DISPUTE_REFUND';
ALTER TYPE "RefundReason" ADD VALUE IF NOT EXISTS 'SERVICE_DISPUTE_PARTIAL_REFUND';

ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SERVICE_REFUND_HOLD';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SERVICE_REFUND_REVERSAL';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SERVICE_CANCELLATION_FEE';

ALTER TABLE "service_bookings"
  ADD COLUMN IF NOT EXISTS "completion_proof_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cancellation_fee_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancellation_refund_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancellation_policy_snapshot" JSONB;

CREATE TABLE IF NOT EXISTS "service_refund_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "refund_number" TEXT NOT NULL,
  "booking_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "service_payment_id" UUID,
  "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reason" "RefundReason" NOT NULL,
  "method" "RefundMethod",
  "amount_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "note" TEXT,
  "provider_refund_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_refund_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_refund_requests_refund_number_key"
  ON "service_refund_requests"("refund_number");
CREATE INDEX IF NOT EXISTS "service_refund_requests_booking_id_idx"
  ON "service_refund_requests"("booking_id");
CREATE INDEX IF NOT EXISTS "service_refund_requests_customer_id_status_created_at_idx"
  ON "service_refund_requests"("customer_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "service_refund_requests_seller_id_status_created_at_idx"
  ON "service_refund_requests"("seller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "service_refund_requests_service_payment_id_idx"
  ON "service_refund_requests"("service_payment_id");
CREATE INDEX IF NOT EXISTS "service_refund_requests_status_created_at_idx"
  ON "service_refund_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "service_refund_requests_reviewed_by_idx"
  ON "service_refund_requests"("reviewed_by");
CREATE INDEX IF NOT EXISTS "service_refund_requests_created_by_idx"
  ON "service_refund_requests"("created_by");

ALTER TABLE "service_refund_requests"
  ADD CONSTRAINT "service_refund_requests_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_requests_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_requests_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_requests_service_payment_id_fkey"
    FOREIGN KEY ("service_payment_id") REFERENCES "service_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_requests_reviewed_by_fkey"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_requests_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "service_refund_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "service_refund_request_id" UUID NOT NULL,
  "service_payment_id" UUID,
  "provider" "PaymentProvider",
  "method" "RefundMethod" NOT NULL,
  "status" "RefundTransactionStatus" NOT NULL DEFAULT 'INITIATED',
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "idempotency_key" TEXT,
  "manual_reference" TEXT,
  "paid_at" TIMESTAMP(3),
  "provider_refund_id" TEXT,
  "provider_response" JSONB,
  "failure_reason" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_refund_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_refund_transactions_idempotency_key_key"
  ON "service_refund_transactions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "service_refund_transactions_service_refund_request_id_idx"
  ON "service_refund_transactions"("service_refund_request_id");
CREATE INDEX IF NOT EXISTS "service_refund_transactions_service_payment_id_idx"
  ON "service_refund_transactions"("service_payment_id");
CREATE INDEX IF NOT EXISTS "service_refund_transactions_provider_refund_id_idx"
  ON "service_refund_transactions"("provider_refund_id");
CREATE INDEX IF NOT EXISTS "service_refund_transactions_created_by_idx"
  ON "service_refund_transactions"("created_by");
CREATE INDEX IF NOT EXISTS "service_refund_transactions_status_created_at_idx"
  ON "service_refund_transactions"("status", "created_at");

ALTER TABLE "service_refund_transactions"
  ADD CONSTRAINT "service_refund_transactions_service_refund_request_id_fkey"
    FOREIGN KEY ("service_refund_request_id") REFERENCES "service_refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_transactions_service_payment_id_fkey"
    FOREIGN KEY ("service_payment_id") REFERENCES "service_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "service_refund_transactions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_disputes"
  ADD COLUMN IF NOT EXISTS "evidence_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "refund_amount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_request_id" UUID;

CREATE INDEX IF NOT EXISTS "service_disputes_refund_request_id_idx"
  ON "service_disputes"("refund_request_id");

ALTER TABLE "service_disputes"
  ADD CONSTRAINT "service_disputes_refund_request_id_fkey"
    FOREIGN KEY ("refund_request_id") REFERENCES "service_refund_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
