-- B2B exception-path hardening.
-- Additive migration. Validate on a disposable PostgreSQL database before deployment.

CREATE TYPE "B2BOrderAmendmentStatus" AS ENUM (
  'REQUESTED',
  'APPLIED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "B2BDisputeResolutionType" AS ENUM (
  'ACCEPTED_AS_DELIVERED',
  'PARTIAL_ACCEPTANCE',
  'REPLACEMENT',
  'RETURN_AND_REFUND',
  'CREDIT_NOTE',
  'CLAIM_REJECTED'
);

CREATE TYPE "B2BFinancialReconciliationStatus" AS ENUM (
  'MATCHED',
  'CORRECTED',
  'EXCEPTION'
);

ALTER TABLE "b2b_orders"
  ADD COLUMN "delivery_address_snapshot" JSONB;

CREATE TABLE "b2b_order_amendments" (
  "id" UUID NOT NULL,
  "amendment_number" TEXT NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "status" "B2BOrderAmendmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "base_order_version" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "line_changes" JSONB,
  "delivery_address_snapshot" JSONB,
  "payment_due_at" TIMESTAMP(3),
  "before_snapshot" JSONB NOT NULL,
  "after_snapshot" JSONB,
  "decision_reason" TEXT,
  "requested_by_user_id" UUID NOT NULL,
  "decided_by_user_id" UUID,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "b2b_order_amendments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "b2b_dispute_resolutions" (
  "id" UUID NOT NULL,
  "resolution_number" TEXT NOT NULL,
  "support_case_id" UUID NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "b2b_order_line_id" UUID,
  "shipment_id" UUID,
  "resolution_type" "B2BDisputeResolutionType" NOT NULL,
  "accepted_quantity" INTEGER NOT NULL DEFAULT 0,
  "rejected_quantity" INTEGER NOT NULL DEFAULT 0,
  "return_quantity" INTEGER NOT NULL DEFAULT 0,
  "replacement_quantity" INTEGER NOT NULL DEFAULT 0,
  "refund_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "receivable_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "credit_note_tax_document_id" UUID,
  "replacement_enquiry_id" UUID,
  "reason" TEXT NOT NULL,
  "resolved_by_user_id" UUID NOT NULL,
  "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "b2b_dispute_resolutions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_dispute_resolutions_quantities_nonnegative"
    CHECK (
      "accepted_quantity" >= 0 AND
      "rejected_quantity" >= 0 AND
      "return_quantity" >= 0 AND
      "replacement_quantity" >= 0
    ),
  CONSTRAINT "b2b_dispute_resolutions_amounts_nonnegative"
    CHECK (
      "refund_amount_paise" >= 0 AND
      "receivable_adjustment_paise" >= 0
    )
);

CREATE TABLE "b2b_financial_reconciliations" (
  "id" UUID NOT NULL,
  "reconciliation_number" TEXT NOT NULL,
  "b2b_order_id" UUID NOT NULL,
  "status" "B2BFinancialReconciliationStatus" NOT NULL,
  "expected_paid_amount_paise" INTEGER NOT NULL,
  "actual_paid_amount_paise" INTEGER NOT NULL,
  "expected_outstanding_paise" INTEGER NOT NULL,
  "actual_outstanding_paise" INTEGER,
  "corrected" BOOLEAN NOT NULL DEFAULT false,
  "discrepancy" JSONB,
  "note" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "b2b_financial_reconciliations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_financial_reconciliations_amounts_nonnegative"
    CHECK (
      "expected_paid_amount_paise" >= 0 AND
      "actual_paid_amount_paise" >= 0 AND
      "expected_outstanding_paise" >= 0 AND
      ("actual_outstanding_paise" IS NULL OR "actual_outstanding_paise" >= 0)
    )
);

CREATE UNIQUE INDEX "b2b_order_amendments_amendment_number_key"
  ON "b2b_order_amendments"("amendment_number");
CREATE INDEX "b2b_order_amendments_b2b_order_id_status_created_at_idx"
  ON "b2b_order_amendments"("b2b_order_id", "status", "created_at");
CREATE INDEX "b2b_order_amendments_requested_by_user_id_created_at_idx"
  ON "b2b_order_amendments"("requested_by_user_id", "created_at");
CREATE INDEX "b2b_order_amendments_decided_by_user_id_idx"
  ON "b2b_order_amendments"("decided_by_user_id");

CREATE UNIQUE INDEX "b2b_dispute_resolutions_resolution_number_key"
  ON "b2b_dispute_resolutions"("resolution_number");
CREATE UNIQUE INDEX "b2b_dispute_resolutions_support_case_id_key"
  ON "b2b_dispute_resolutions"("support_case_id");
CREATE UNIQUE INDEX "b2b_dispute_resolutions_credit_note_tax_document_id_key"
  ON "b2b_dispute_resolutions"("credit_note_tax_document_id");
CREATE UNIQUE INDEX "b2b_dispute_resolutions_replacement_enquiry_id_key"
  ON "b2b_dispute_resolutions"("replacement_enquiry_id");
CREATE INDEX "b2b_dispute_resolutions_b2b_order_id_created_at_idx"
  ON "b2b_dispute_resolutions"("b2b_order_id", "created_at");
CREATE INDEX "b2b_dispute_resolutions_b2b_order_line_id_idx"
  ON "b2b_dispute_resolutions"("b2b_order_line_id");
CREATE INDEX "b2b_dispute_resolutions_shipment_id_idx"
  ON "b2b_dispute_resolutions"("shipment_id");
CREATE INDEX "b2b_dispute_resolutions_resolved_by_user_id_created_at_idx"
  ON "b2b_dispute_resolutions"("resolved_by_user_id", "created_at");

CREATE UNIQUE INDEX "b2b_financial_reconciliations_reconciliation_number_key"
  ON "b2b_financial_reconciliations"("reconciliation_number");
CREATE INDEX "b2b_financial_reconciliations_b2b_order_id_created_at_idx"
  ON "b2b_financial_reconciliations"("b2b_order_id", "created_at");
CREATE INDEX "b2b_financial_reconciliations_status_created_at_idx"
  ON "b2b_financial_reconciliations"("status", "created_at");
CREATE INDEX "b2b_financial_reconciliations_created_by_user_id_created_at_idx"
  ON "b2b_financial_reconciliations"("created_by_user_id", "created_at");

ALTER TABLE "b2b_order_amendments"
  ADD CONSTRAINT "b2b_order_amendments_b2b_order_id_fkey"
  FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "b2b_order_amendments"
  ADD CONSTRAINT "b2b_order_amendments_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "b2b_order_amendments"
  ADD CONSTRAINT "b2b_order_amendments_decided_by_user_id_fkey"
  FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_support_case_id_fkey"
  FOREIGN KEY ("support_case_id") REFERENCES "b2b_support_cases"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_b2b_order_id_fkey"
  FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_b2b_order_line_id_fkey"
  FOREIGN KEY ("b2b_order_line_id") REFERENCES "b2b_order_lines"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_shipment_id_fkey"
  FOREIGN KEY ("shipment_id") REFERENCES "b2b_shipments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_credit_note_tax_document_id_fkey"
  FOREIGN KEY ("credit_note_tax_document_id") REFERENCES "tax_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_replacement_enquiry_id_fkey"
  FOREIGN KEY ("replacement_enquiry_id") REFERENCES "b2b_enquiries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "b2b_financial_reconciliations"
  ADD CONSTRAINT "b2b_financial_reconciliations_b2b_order_id_fkey"
  FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "b2b_financial_reconciliations"
  ADD CONSTRAINT "b2b_financial_reconciliations_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_final_b2b_amendment_change"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" <> 'REQUESTED' THEN
    RAISE EXCEPTION 'Final B2B amendments are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_order_amendments_final_immutable"
BEFORE UPDATE OR DELETE ON "b2b_order_amendments"
FOR EACH ROW EXECUTE FUNCTION "prevent_final_b2b_amendment_change"();

CREATE OR REPLACE FUNCTION "prevent_b2b_dispute_resolution_change"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'B2B dispute resolutions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_dispute_resolutions_immutable"
BEFORE UPDATE OR DELETE ON "b2b_dispute_resolutions"
FOR EACH ROW EXECUTE FUNCTION "prevent_b2b_dispute_resolution_change"();

CREATE OR REPLACE FUNCTION "prevent_b2b_financial_reconciliation_change"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'B2B financial reconciliation history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_financial_reconciliations_immutable"
BEFORE UPDATE OR DELETE ON "b2b_financial_reconciliations"
FOR EACH ROW EXECUTE FUNCTION "prevent_b2b_financial_reconciliation_change"();
