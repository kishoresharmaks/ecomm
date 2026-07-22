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
