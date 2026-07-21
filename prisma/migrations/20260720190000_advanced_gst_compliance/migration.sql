-- Advanced GST compliance reporting, filing snapshots, reconciliation,
-- platform commission invoices, and e-invoice/e-way metadata.
-- This migration is intentionally generated for review and must not be
-- applied to a connected remote database from the development workspace.

ALTER TYPE "TaxDocumentSource" ADD VALUE IF NOT EXISTS 'MANUAL_ADJUSTMENT';

CREATE TYPE "GstFilingPeriodStatus" AS ENUM (
  'OPEN',
  'LOCKED',
  'FILED',
  'REOPENED'
);

CREATE TYPE "GstReconciliationSeverity" AS ENUM (
  'INFO',
  'WARNING',
  'ERROR'
);

CREATE TYPE "GstComplianceStatus" AS ENUM (
  'NOT_REQUIRED',
  'READY',
  'PENDING',
  'SUBMITTED',
  'GENERATED',
  'CANCELLED',
  'FAILED'
);

CREATE TYPE "GstReportExportType" AS ENUM (
  'GST_REGISTER',
  'HSN_SUMMARY',
  'GSTR1_CSV',
  'GSTR1_JSON',
  'GSTR3B',
  'GSTR8',
  'TCS_STATEMENT',
  'DOCUMENT_SERIES',
  'RATE_LIABILITY',
  'STATE_LIABILITY',
  'GSTIN_SUMMARY',
  'RECONCILIATION',
  'PLATFORM_COMMISSION',
  'E_INVOICE',
  'E_WAY_BILL'
);

CREATE TABLE "tax_document_compliance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tax_document_id" UUID NOT NULL,
  "e_invoice_status" "GstComplianceStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "irn" TEXT,
  "acknowledgement_number" TEXT,
  "acknowledgement_date" TIMESTAMP(3),
  "signed_qr_code" TEXT,
  "e_invoice_provider" TEXT,
  "e_invoice_provider_ref" TEXT,
  "e_invoice_error" TEXT,
  "e_way_bill_status" "GstComplianceStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "e_way_bill_number" TEXT,
  "e_way_bill_generated_at" TIMESTAMP(3),
  "e_way_bill_valid_until" TIMESTAMP(3),
  "e_way_bill_provider" TEXT,
  "e_way_bill_provider_ref" TEXT,
  "e_way_bill_error" TEXT,
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_document_compliance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gst_filing_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "return_period" TEXT NOT NULL,
  "financial_year" TEXT NOT NULL,
  "date_from" DATE NOT NULL,
  "date_to" DATE NOT NULL,
  "status" "GstFilingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "snapshot" JSONB,
  "snapshot_hash" TEXT,
  "locked_at" TIMESTAMP(3),
  "locked_by_id" UUID,
  "filed_at" TIMESTAMP(3),
  "filed_by_id" UUID,
  "filing_reference" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gst_filing_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gst_reconciliation_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "filing_period_id" UUID,
  "seller_id" UUID NOT NULL,
  "date_from" DATE NOT NULL,
  "date_to" DATE NOT NULL,
  "issue_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "book_snapshot" JSONB NOT NULL,
  "filing_snapshot" JSONB NOT NULL,
  "issues" JSONB NOT NULL,
  "run_hash" TEXT NOT NULL,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gst_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gst_report_exports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "filing_period_id" UUID,
  "seller_id" UUID,
  "export_type" "GstReportExportType" NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "generated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gst_report_exports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_tax_document_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "financial_year" TEXT NOT NULL,
  "document_type" "TaxDocumentType" NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_tax_document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_tax_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_number" TEXT NOT NULL,
  "document_type" "TaxDocumentType" NOT NULL DEFAULT 'TAX_INVOICE',
  "status" "TaxDocumentStatus" NOT NULL DEFAULT 'ISSUED',
  "idempotency_key" TEXT NOT NULL,
  "financial_year" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "issue_date" TIMESTAMP(3) NOT NULL,
  "supplier_legal_name" TEXT NOT NULL,
  "supplier_gstin" TEXT NOT NULL,
  "supplier_address_snapshot" JSONB NOT NULL,
  "recipient_legal_name" TEXT NOT NULL,
  "recipient_gstin" TEXT,
  "recipient_address_snapshot" JSONB NOT NULL,
  "place_of_supply_state_code" TEXT,
  "supply_type" "TaxSupplyType",
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
  "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  "igst_paise" INTEGER NOT NULL DEFAULT 0,
  "cess_paise" INTEGER NOT NULL DEFAULT 0,
  "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
  "invoice_value_paise" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "reason" TEXT,
  "issued_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_tax_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_document_compliance_tax_document_id_key"
  ON "tax_document_compliance"("tax_document_id");
CREATE UNIQUE INDEX "tax_document_compliance_irn_key"
  ON "tax_document_compliance"("irn");
CREATE UNIQUE INDEX "tax_document_compliance_e_way_bill_number_key"
  ON "tax_document_compliance"("e_way_bill_number");
CREATE INDEX "tax_document_compliance_e_invoice_status_created_at_idx"
  ON "tax_document_compliance"("e_invoice_status", "created_at");
CREATE INDEX "tax_document_compliance_e_way_bill_status_created_at_idx"
  ON "tax_document_compliance"("e_way_bill_status", "created_at");

CREATE UNIQUE INDEX "gst_filing_periods_seller_id_return_period_key"
  ON "gst_filing_periods"("seller_id", "return_period");
CREATE INDEX "gst_filing_periods_seller_id_status_date_from_idx"
  ON "gst_filing_periods"("seller_id", "status", "date_from");
CREATE INDEX "gst_filing_periods_locked_by_id_idx"
  ON "gst_filing_periods"("locked_by_id");
CREATE INDEX "gst_filing_periods_filed_by_id_idx"
  ON "gst_filing_periods"("filed_by_id");

CREATE INDEX "gst_reconciliation_runs_filing_period_id_idx"
  ON "gst_reconciliation_runs"("filing_period_id");
CREATE INDEX "gst_reconciliation_runs_seller_id_created_at_idx"
  ON "gst_reconciliation_runs"("seller_id", "created_at");
CREATE INDEX "gst_reconciliation_runs_created_by_id_idx"
  ON "gst_reconciliation_runs"("created_by_id");

CREATE INDEX "gst_report_exports_filing_period_id_created_at_idx"
  ON "gst_report_exports"("filing_period_id", "created_at");
CREATE INDEX "gst_report_exports_seller_id_export_type_created_at_idx"
  ON "gst_report_exports"("seller_id", "export_type", "created_at");
CREATE INDEX "gst_report_exports_generated_by_id_idx"
  ON "gst_report_exports"("generated_by_id");

CREATE UNIQUE INDEX "marketplace_tax_document_sequences_financial_year_document_type_key"
  ON "marketplace_tax_document_sequences"("financial_year", "document_type");

CREATE UNIQUE INDEX "marketplace_tax_documents_document_number_key"
  ON "marketplace_tax_documents"("document_number");
CREATE UNIQUE INDEX "marketplace_tax_documents_idempotency_key_key"
  ON "marketplace_tax_documents"("idempotency_key");
CREATE INDEX "marketplace_tax_documents_seller_id_issue_date_document_type_idx"
  ON "marketplace_tax_documents"("seller_id", "issue_date", "document_type");
CREATE INDEX "marketplace_tax_documents_source_type_source_id_idx"
  ON "marketplace_tax_documents"("source_type", "source_id");
CREATE INDEX "marketplace_tax_documents_issued_by_id_idx"
  ON "marketplace_tax_documents"("issued_by_id");

ALTER TABLE "tax_document_compliance"
  ADD CONSTRAINT "tax_document_compliance_tax_document_id_fkey"
  FOREIGN KEY ("tax_document_id") REFERENCES "tax_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gst_filing_periods"
  ADD CONSTRAINT "gst_filing_periods_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gst_filing_periods"
  ADD CONSTRAINT "gst_filing_periods_locked_by_id_fkey"
  FOREIGN KEY ("locked_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gst_filing_periods"
  ADD CONSTRAINT "gst_filing_periods_filed_by_id_fkey"
  FOREIGN KEY ("filed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gst_reconciliation_runs"
  ADD CONSTRAINT "gst_reconciliation_runs_filing_period_id_fkey"
  FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gst_reconciliation_runs"
  ADD CONSTRAINT "gst_reconciliation_runs_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gst_reconciliation_runs"
  ADD CONSTRAINT "gst_reconciliation_runs_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gst_report_exports"
  ADD CONSTRAINT "gst_report_exports_filing_period_id_fkey"
  FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gst_report_exports"
  ADD CONSTRAINT "gst_report_exports_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gst_report_exports"
  ADD CONSTRAINT "gst_report_exports_generated_by_id_fkey"
  FOREIGN KEY ("generated_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "marketplace_tax_documents"
  ADD CONSTRAINT "marketplace_tax_documents_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_tax_documents"
  ADD CONSTRAINT "marketplace_tax_documents_issued_by_id_fkey"
  FOREIGN KEY ("issued_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_locked_gst_filing_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" IN ('LOCKED', 'FILED')
    AND ROW(NEW."snapshot", NEW."snapshot_hash", NEW."seller_id", NEW."return_period", NEW."date_from", NEW."date_to")
      IS DISTINCT FROM
      ROW(OLD."snapshot", OLD."snapshot_hash", OLD."seller_id", OLD."return_period", OLD."date_from", OLD."date_to")
  THEN
    RAISE EXCEPTION 'Locked GST filing snapshots are immutable.';
  END IF;

  IF OLD."status" = 'FILED' AND NEW."status" <> 'FILED' THEN
    RAISE EXCEPTION 'Filed GST periods cannot be reopened.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "gst_filing_period_snapshot_immutable"
BEFORE UPDATE ON "gst_filing_periods"
FOR EACH ROW
EXECUTE FUNCTION "prevent_locked_gst_filing_snapshot_mutation"();

CREATE OR REPLACE FUNCTION "prevent_issued_marketplace_tax_document_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'ISSUED' THEN
    RAISE EXCEPTION 'Issued marketplace tax documents are immutable.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "marketplace_tax_documents_issued_immutable"
BEFORE UPDATE OR DELETE ON "marketplace_tax_documents"
FOR EACH ROW
EXECUTE FUNCTION "prevent_issued_marketplace_tax_document_mutation"();
