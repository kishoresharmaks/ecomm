CREATE TYPE "B2BPaymentStatus" AS ENUM (
  'PENDING',
  'SUBMITTED_FOR_VERIFICATION',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'REFUNDED',
  'NOT_REQUIRED'
);

CREATE TYPE "B2BProofStatus" AS ENUM (
  'SUBMITTED',
  'VERIFIED',
  'REJECTED',
  'RAZORPAY_FAILED'
);

CREATE TYPE "B2BPaymentMethod" AS ENUM (
  'BANK_TRANSFER',
  'MANUAL',
  'RAZORPAY'
);

CREATE TYPE "B2BAuditActorType" AS ENUM (
  'ADMIN',
  'FINANCE',
  'SYSTEM'
);

CREATE TYPE "B2BAdminAction" AS ENUM (
  'EXTEND_PAYMENT_DUE_DATE',
  'SET_NOT_REQUIRED',
  'UNLOCK_FULFILMENT',
  'CANCEL_OVERDUE_ORDER',
  'REGENERATE_PROFORMA',
  'RECORD_MANUAL_PAYMENT',
  'VERIFY_PAYMENT_PROOF',
  'REJECT_PAYMENT_PROOF',
  'ISSUE_REFUND',
  'PAYMENT_OVERDUE'
);

ALTER TABLE "b2b_orders"
ADD COLUMN "proforma_invoice_file_key" TEXT,
ADD COLUMN "payment_status" "B2BPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "payment_method" "B2BPaymentMethod",
ADD COLUMN "buyer_payable_amount_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paid_amount_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paid_at" TIMESTAMP(3),
ADD COLUMN "payment_due_at" TIMESTAMP(3),
ADD COLUMN "payment_overdue_at" TIMESTAMP(3),
ADD COLUMN "payment_verified_by_id" UUID,
ADD COLUMN "payment_verified_at" TIMESTAMP(3),
ADD COLUMN "fulfilment_unlocked_by_id" UUID,
ADD COLUMN "fulfilment_unlocked_at" TIMESTAMP(3),
ADD COLUMN "fulfilment_unlock_note" TEXT;

UPDATE "b2b_orders"
SET
  "buyer_payable_amount_paise" = COALESCE("subtotal_paise", 0),
  "payment_due_at" = COALESCE("proforma_issued_at", "created_at") + INTERVAL '7 days'
WHERE "payment_due_at" IS NULL;

ALTER TABLE "b2b_orders"
ALTER COLUMN "payment_due_at" SET NOT NULL;

CREATE TABLE "b2b_payment_proofs" (
  "id" UUID NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "method" "B2BPaymentMethod" NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "overpayment_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "reference_number" TEXT,
  "proof_file_key" TEXT,
  "razorpay_payment_id" TEXT,
  "submitted_by_user_id" UUID NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "B2BProofStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "b2b_payment_proofs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "b2b_proforma_invoice_revisions" (
  "id" UUID NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "file_key" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  "generated_by_user_id" UUID,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "b2b_proforma_invoice_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "b2b_admin_audit_logs" (
  "id" UUID NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "actor_id" UUID,
  "actor_type" "B2BAuditActorType" NOT NULL,
  "action" "B2BAdminAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "before_snapshot" JSONB,
  "after_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "b2b_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "b2b_orders_payment_status_idx" ON "b2b_orders"("payment_status");
CREATE INDEX "b2b_orders_payment_due_at_idx" ON "b2b_orders"("payment_due_at");
CREATE INDEX "b2b_payment_proofs_b2b_order_id_idx" ON "b2b_payment_proofs"("b2b_order_id");
CREATE INDEX "b2b_payment_proofs_submitted_by_user_id_idx" ON "b2b_payment_proofs"("submitted_by_user_id");
CREATE INDEX "b2b_payment_proofs_reviewed_by_user_id_idx" ON "b2b_payment_proofs"("reviewed_by_user_id");
CREATE INDEX "b2b_payment_proofs_reference_number_status_idx" ON "b2b_payment_proofs"("reference_number", "status");
CREATE INDEX "b2b_payment_proofs_status_submitted_at_idx" ON "b2b_payment_proofs"("status", "submitted_at");
CREATE INDEX "b2b_proforma_invoice_revisions_b2b_order_id_idx" ON "b2b_proforma_invoice_revisions"("b2b_order_id");
CREATE INDEX "b2b_proforma_invoice_revisions_created_at_idx" ON "b2b_proforma_invoice_revisions"("created_at");
CREATE INDEX "b2b_admin_audit_logs_b2b_order_id_idx" ON "b2b_admin_audit_logs"("b2b_order_id");
CREATE INDEX "b2b_admin_audit_logs_actor_id_idx" ON "b2b_admin_audit_logs"("actor_id");
CREATE INDEX "b2b_admin_audit_logs_action_idx" ON "b2b_admin_audit_logs"("action");
CREATE INDEX "b2b_admin_audit_logs_created_at_idx" ON "b2b_admin_audit_logs"("created_at");

ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_payment_verified_by_id_fkey"
FOREIGN KEY ("payment_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_fulfilment_unlocked_by_id_fkey"
FOREIGN KEY ("fulfilment_unlocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "b2b_payment_proofs" ADD CONSTRAINT "b2b_payment_proofs_b2b_order_id_fkey"
FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "b2b_payment_proofs" ADD CONSTRAINT "b2b_payment_proofs_submitted_by_user_id_fkey"
FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "b2b_payment_proofs" ADD CONSTRAINT "b2b_payment_proofs_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "b2b_proforma_invoice_revisions" ADD CONSTRAINT "b2b_proforma_invoice_revisions_b2b_order_id_fkey"
FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "b2b_proforma_invoice_revisions" ADD CONSTRAINT "b2b_proforma_invoice_revisions_generated_by_user_id_fkey"
FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "b2b_admin_audit_logs" ADD CONSTRAINT "b2b_admin_audit_logs_b2b_order_id_fkey"
FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "b2b_admin_audit_logs" ADD CONSTRAINT "b2b_admin_audit_logs_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
