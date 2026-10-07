-- 1HandIndia post-baseline migration repair.
-- Generated on 2026-07-30 for a database that already has the approved
-- 20260721203000_service_sac_tax_integration baseline but is missing every later migration.
-- Do not run this file on an empty database or rerun it after it succeeds.

-- Migration: 20260722123000_sac_master_and_service_quote_tax_lines
CREATE TYPE "ServiceQuoteLineType" AS ENUM ('SERVICE', 'PRODUCT');
CREATE TYPE "SacMasterImportStatus" AS ENUM ('DRY_RUN', 'COMPLETED', 'FAILED');

CREATE TABLE "sac_master" (
  "id" UUID NOT NULL,
  "sac_code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "source_document" TEXT,
  "source_reference" TEXT,
  "effective_date" DATE,
  "source_version" TEXT,
  "import_checksum" TEXT,
  "imported_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sac_master_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sac_master_sac_code_key" ON "sac_master"("sac_code");
CREATE INDEX "sac_master_is_active_sac_code_idx" ON "sac_master"("is_active", "sac_code");
CREATE INDEX "sac_master_description_idx" ON "sac_master"("description");

CREATE TABLE "sac_master_import_runs" (
  "id" UUID NOT NULL,
  "status" "SacMasterImportStatus" NOT NULL,
  "source_document" TEXT NOT NULL,
  "source_reference" TEXT,
  "effective_date" DATE,
  "source_version" TEXT,
  "import_checksum" TEXT NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "inserted_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "deactivated_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "sac_master_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sac_master_import_runs_status_imported_at_idx"
  ON "sac_master_import_runs"("status", "imported_at");
CREATE INDEX "sac_master_import_runs_import_checksum_idx"
  ON "sac_master_import_runs"("import_checksum");

ALTER TABLE "categories"
  ADD COLUMN "default_sac_code" TEXT,
  ADD COLUMN "default_sac_master_id" UUID;

CREATE INDEX "categories_default_sac_code_idx" ON "categories"("default_sac_code");
CREATE INDEX "categories_default_sac_master_id_idx" ON "categories"("default_sac_master_id");

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_default_sac_master_id_fkey"
  FOREIGN KEY ("default_sac_master_id") REFERENCES "sac_master"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_listings"
  ADD COLUMN "sac_master_id" UUID,
  ADD COLUMN "tax_review_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tax_configuration_version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "service_listings_sac_master_id_idx" ON "service_listings"("sac_master_id");
CREATE INDEX "service_listings_tax_review_required_approval_status_status_idx"
  ON "service_listings"("tax_review_required", "approval_status", "status");

ALTER TABLE "service_listings"
  ADD CONSTRAINT "service_listings_sac_master_id_fkey"
  FOREIGN KEY ("sac_master_id") REFERENCES "sac_master"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_bookings"
  ADD COLUMN "sac_description_snapshot" TEXT,
  ADD COLUMN "sac_source_reference_snapshot" TEXT,
  ADD COLUMN "tax_snapshot_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "service_quotes"
  ADD COLUMN "revision_number" INTEGER;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "booking_id"
    ORDER BY "created_at", "id"
  ) AS revision_number
  FROM "service_quotes"
)
UPDATE "service_quotes" quote
SET "revision_number" = numbered.revision_number
FROM numbered
WHERE numbered."id" = quote."id";

ALTER TABLE "service_quotes"
  ALTER COLUMN "revision_number" SET NOT NULL,
  ALTER COLUMN "revision_number" SET DEFAULT 1;

CREATE UNIQUE INDEX "service_quotes_booking_id_revision_number_key"
  ON "service_quotes"("booking_id", "revision_number");

ALTER TABLE "service_quote_line_items"
  ADD COLUMN "line_type" "ServiceQuoteLineType" NOT NULL DEFAULT 'SERVICE',
  ADD COLUMN "hsn_sac_code" TEXT,
  ADD COLUMN "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
  ADD COLUMN "gst_rate_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "uqc" TEXT NOT NULL DEFAULT 'NOS',
  ADD COLUMN "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "igst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cess_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_total_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "classification_description_snapshot" TEXT,
  ADD COLUMN "classification_source_snapshot" TEXT,
  ADD COLUMN "tax_snapshot_version" INTEGER NOT NULL DEFAULT 1;

UPDATE "service_quote_line_items" line
SET
  "hsn_sac_code" = booking."sac_code_snapshot",
  "tax_classification" = booking."service_tax_classification_snapshot",
  "gst_rate_percent" = booking."gst_rate_percent_snapshot",
  "taxable_value_paise" = CASE
    WHEN booking."total_payable_paise" > 0
      THEN ROUND(line."total_paise"::numeric * booking."taxable_value_paise" / booking."total_payable_paise")::integer
    ELSE line."total_paise"
  END,
  "cgst_paise" = CASE
    WHEN booking."total_payable_paise" > 0
      THEN ROUND(line."total_paise"::numeric * booking."cgst_paise" / booking."total_payable_paise")::integer
    ELSE 0
  END,
  "sgst_paise" = CASE
    WHEN booking."total_payable_paise" > 0
      THEN ROUND(line."total_paise"::numeric * booking."sgst_paise" / booking."total_payable_paise")::integer
    ELSE 0
  END,
  "igst_paise" = CASE
    WHEN booking."total_payable_paise" > 0
      THEN ROUND(line."total_paise"::numeric * booking."igst_paise" / booking."total_payable_paise")::integer
    ELSE 0
  END,
  "tax_total_paise" = CASE
    WHEN booking."total_payable_paise" > 0
      THEN ROUND(line."total_paise"::numeric * booking."tax_total_paise" / booking."total_payable_paise")::integer
    ELSE 0
  END
FROM "service_quotes" quote
JOIN "service_bookings" booking ON booking."id" = quote."booking_id"
WHERE quote."id" = line."quote_id";

CREATE INDEX "service_quote_line_items_line_type_hsn_sac_code_idx"
  ON "service_quote_line_items"("line_type", "hsn_sac_code");

ALTER TABLE "tax_document_lines"
  ADD COLUMN "classification_description_snapshot" TEXT,
  ADD COLUMN "classification_source_snapshot" TEXT,
  ADD COLUMN "tax_snapshot_version" INTEGER NOT NULL DEFAULT 1;

-- Migration: 20260722200000_order_tax_register
ALTER TYPE "GstReportExportType" ADD VALUE 'ORDER_TAX_REGISTER';

ALTER TABLE "tax_document_lines"
  ADD COLUMN "source_record_type" TEXT,
  ADD COLUMN "source_record_id" UUID;

UPDATE "tax_document_lines"
SET
  "source_record_type" = 'ORDER_ITEM',
  "source_record_id" = "order_item_id"
WHERE "order_item_id" IS NOT NULL;

CREATE INDEX "tax_document_lines_source_record_type_source_record_id_idx"
  ON "tax_document_lines"("source_record_type", "source_record_id");

-- Migration: 20260722213000_report_export_jobs
CREATE TYPE "ReportExportAudience" AS ENUM ('ADMIN', 'FINANCE', 'SELLER');

CREATE TYPE "ReportExportStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TYPE "ReportExportType" AS ENUM (
  'ADMIN_SALES',
  'ADMIN_SELLERS',
  'ADMIN_PRODUCTS',
  'ADMIN_ENQUIRIES',
  'FINANCE_PAYMENTS',
  'FINANCE_COD_COLLECTIONS',
  'FINANCE_ORDER_SETTLEMENTS',
  'FINANCE_SERVICE_SETTLEMENTS',
  'FINANCE_PAYOUTS',
  'FINANCE_SERVICE_RECEIVABLES',
  'SELLER_SALES',
  'SELLER_INVENTORY',
  'SELLER_FINANCE',
  'SELLER_TAX',
  'SELLER_RETURNS'
);

CREATE TABLE "report_export_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "audience" "ReportExportAudience" NOT NULL,
  "export_type" "ReportExportType" NOT NULL,
  "status" "ReportExportStatus" NOT NULL DEFAULT 'PENDING',
  "actor_user_id" UUID NOT NULL,
  "seller_id" UUID,
  "filters" JSONB NOT NULL,
  "file_name" TEXT,
  "content_type" TEXT,
  "storage_key" TEXT,
  "sha256" TEXT,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "byte_size" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "error_message" TEXT,
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "report_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_export_jobs_status_available_at_idx"
  ON "report_export_jobs"("status", "available_at");

CREATE INDEX "report_export_jobs_audience_created_at_idx"
  ON "report_export_jobs"("audience", "created_at");

CREATE INDEX "report_export_jobs_actor_user_id_created_at_idx"
  ON "report_export_jobs"("actor_user_id", "created_at");

CREATE INDEX "report_export_jobs_seller_id_created_at_idx"
  ON "report_export_jobs"("seller_id", "created_at");

CREATE INDEX "report_export_jobs_expires_at_status_idx"
  ON "report_export_jobs"("expires_at", "status");

ALTER TABLE "report_export_jobs"
  ADD CONSTRAINT "report_export_jobs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_export_jobs"
  ADD CONSTRAINT "report_export_jobs_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Migration: 20260724130000_fix_order_shipment_assignment_events_id
-- Fix order_shipment_assignment_events id column default and trigger function
ALTER TABLE "order_shipment_assignment_events"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION "record_order_shipment_assignment_event"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."delivery_partner_user_id" IS NOT NULL
       OR NEW."assignment_status" <> 'UNASSIGNED' THEN
      INSERT INTO "order_shipment_assignment_events" (
        "id",
        "order_shipment_id",
        "order_id",
        "partner_user_id",
        "status",
        "assignment_note",
        "assigned_at",
        "accepted_at",
        "rejected_at",
        "assignment_expires_at"
      ) VALUES (
        gen_random_uuid(),
        NEW."id",
        NEW."order_id",
        NEW."delivery_partner_user_id",
        NEW."assignment_status",
        NEW."assignment_note",
        NEW."assigned_at",
        NEW."accepted_at",
        NEW."rejected_at",
        NEW."assignment_expires_at"
      );
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(
    OLD."delivery_partner_user_id",
    OLD."assignment_status",
    OLD."assignment_note",
    OLD."assigned_at",
    OLD."accepted_at",
    OLD."rejected_at",
    OLD."assignment_expires_at"
  ) IS DISTINCT FROM ROW(
    NEW."delivery_partner_user_id",
    NEW."assignment_status",
    NEW."assignment_note",
    NEW."assigned_at",
    NEW."accepted_at",
    NEW."rejected_at",
    NEW."assignment_expires_at"
  ) THEN
    INSERT INTO "order_shipment_assignment_events" (
      "id",
      "order_shipment_id",
      "order_id",
      "previous_partner_user_id",
      "partner_user_id",
      "previous_status",
      "status",
      "assignment_note",
      "assigned_at",
      "accepted_at",
      "rejected_at",
      "assignment_expires_at"
    ) VALUES (
      gen_random_uuid(),
      NEW."id",
      NEW."order_id",
      OLD."delivery_partner_user_id",
      NEW."delivery_partner_user_id",
      OLD."assignment_status",
      NEW."assignment_status",
      NEW."assignment_note",
      NEW."assigned_at",
      NEW."accepted_at",
      NEW."rejected_at",
      NEW."assignment_expires_at"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Migration: 20260724150000_add_eway_bill_number
-- AlterTable
ALTER TABLE "order_shipment_packages" ADD COLUMN "eway_bill_number" VARCHAR(20);

-- Migration: 20260726173000_gstr1_review_workbooks
ALTER TYPE "ReportExportType" ADD VALUE IF NOT EXISTS 'GSTR1_REVIEW_SELLER_XLSX';
ALTER TYPE "ReportExportType" ADD VALUE IF NOT EXISTS 'GSTR1_REVIEW_ALL_SELLERS_ZIP';
ALTER TYPE "ReportExportType" ADD VALUE IF NOT EXISTS 'GSTR1_REVIEW_PLATFORM_XLSX';

ALTER TABLE "marketplace_tax_documents"
  ADD COLUMN "gstr_supply_section_snapshot" "GstrSupplySection",
  ADD COLUMN "tax_lines_snapshot" JSONB;

-- Migration: 20260726233000_seller_subscription_consistency
WITH ranked_current_subscriptions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "seller_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS current_rank
  FROM "seller_subscriptions"
  WHERE "is_current" = true
)
UPDATE "seller_subscriptions" AS subscription
SET "is_current" = false
FROM ranked_current_subscriptions AS ranked
WHERE subscription."id" = ranked."id"
  AND ranked.current_rank > 1;

CREATE UNIQUE INDEX "seller_subscriptions_one_current_per_seller_idx"
  ON "seller_subscriptions"("seller_id")
  WHERE "is_current" = true;

-- Migration: 20260726234500_create_cms_popup_announcements
CREATE TABLE "cms_popup_announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "desktop_image_url" TEXT NOT NULL,
    "mobile_image_url" TEXT,
    "image_alt" TEXT NOT NULL,
    "primary_link_url" TEXT,
    "primary_cta_label" TEXT,
    "secondary_link_url" TEXT,
    "secondary_cta_label" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_popup_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cms_popup_announcements_starts_at_idx" ON "cms_popup_announcements"("starts_at");
CREATE INDEX "cms_popup_announcements_ends_at_idx" ON "cms_popup_announcements"("ends_at");
CREATE INDEX "cms_popup_announcements_status_sort_order_idx" ON "cms_popup_announcements"("status", "sort_order");

-- Migration: 20260909120000_add_newsletter_subscriber
-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "source" VARCHAR(50) NOT NULL DEFAULT 'footer',
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_subscribed_at_idx" ON "newsletter_subscribers"("status", "subscribed_at");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_source_idx" ON "newsletter_subscribers"("source");

-- Migration: 20260912_b2b_schema_changes
-- B2B Order-to-Cash V2 schema changes.
-- Generated from unapplied schema changes blocked by a broken prior migration.
-- Apply with: psql <connection-string> -f prisma/migrations/20260912_b2b_schema_changes/migration.sql

-- 1. Add CANCELLED to B2BPaymentStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CANCELLED'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'B2BPaymentStatus')
  ) THEN
    ALTER TYPE "B2BPaymentStatus" ADD VALUE 'CANCELLED';
  END IF;
END $$;

-- 2. Add CANCEL_ORDER and UPDATE_ORDER_STATUS to B2BAdminAction enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CANCEL_ORDER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'B2BAdminAction')
  ) THEN
    ALTER TYPE "B2BAdminAction" ADD VALUE 'CANCEL_ORDER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'UPDATE_ORDER_STATUS'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'B2BAdminAction')
  ) THEN
    ALTER TYPE "B2BAdminAction" ADD VALUE 'UPDATE_ORDER_STATUS';
  END IF;
END $$;

-- 3. Add composite unique index on B2BOrder(sellerId, taxInvoiceNumber)
-- Uses IF NOT EXISTS so re-running this migration is safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_orders_seller_tax_invoice
ON b2b_orders (seller_id, tax_invoice_number)
WHERE tax_invoice_number IS NOT NULL;

-- 4. Change BusinessBuyer.user FK from CASCADE to SET NULL
-- Drop old constraint and recreate with SET NULL.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'business_buyers'::regclass
    AND confrelid = 'users'::regclass
    AND contype = 'f'
    AND conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'business_buyers'::regclass AND attname = 'user_id')
    ]::smallint[]
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE business_buyers DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE business_buyers
    ADD CONSTRAINT business_buyers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  $inner$;
END $$;

-- 5. Change B2BOrder.businessBuyer FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_orders'::regclass
    AND confrelid = 'business_buyers'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_orders DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_orders
    ADD CONSTRAINT b2b_orders_business_buyer_id_fkey
    FOREIGN KEY (business_buyer_id) REFERENCES business_buyers(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 6. Change B2BPaymentProof.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_payment_proofs'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_payment_proofs DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_payment_proofs
    ADD CONSTRAINT b2b_payment_proofs_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 7. Change B2BOrderAmendment.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_order_amendments'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_order_amendments DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_order_amendments
    ADD CONSTRAINT b2b_order_amendments_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 8. Change B2BDisputeResolution.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_dispute_resolutions'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_dispute_resolutions DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_dispute_resolutions
    ADD CONSTRAINT b2b_dispute_resolutions_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 9. Change B2BFinancialReconciliation.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_financial_reconciliations'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_financial_reconciliations DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_financial_reconciliations
    ADD CONSTRAINT b2b_financial_reconciliations_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- Migration: 20261007200000_add_admin_mfa
-- Add Admin TOTP MFA and recovery codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminMfaType') THEN
    CREATE TYPE "AdminMfaType" AS ENUM ('NONE', 'TOTP');
  END IF;
END $$;

ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_type" "AdminMfaType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_secret_encrypted" TEXT;
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_enforced_at" TIMESTAMP(3);
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "failed_mfa_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admin_credentials" ADD COLUMN IF NOT EXISTS "mfa_locked_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "admin_credentials_mfa_locked_until_idx" ON "admin_credentials"("mfa_locked_until");

CREATE TABLE IF NOT EXISTS "admin_mfa_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "credential_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_mfa_recovery_codes_credential_id_used_at_idx" ON "admin_mfa_recovery_codes"("credential_id", "used_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_mfa_recovery_codes_credential_id_fkey'
  ) THEN
    ALTER TABLE "admin_mfa_recovery_codes"
      ADD CONSTRAINT "admin_mfa_recovery_codes_credential_id_fkey"
      FOREIGN KEY ("credential_id") REFERENCES "admin_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
