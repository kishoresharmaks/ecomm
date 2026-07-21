CREATE TYPE "SellerTaxRegistrationStatus" AS ENUM (
  'GST_REGISTERED',
  'NOT_REGISTERED',
  'COMPOSITION'
);

CREATE TYPE "ProductTaxClassification" AS ENUM (
  'TAXABLE',
  'NIL_RATED',
  'EXEMPT',
  'NON_GST'
);

ALTER TYPE "TaxDocumentType" ADD VALUE IF NOT EXISTS 'COMMERCIAL_INVOICE';

ALTER TABLE "seller_profiles"
  ADD COLUMN "tax_registration_status" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED';

UPDATE "seller_profiles"
SET "tax_registration_status" = CASE
  WHEN UPPER(TRIM(COALESCE("gst_number", ''))) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    THEN 'GST_REGISTERED'::"SellerTaxRegistrationStatus"
  ELSE 'NOT_REGISTERED'::"SellerTaxRegistrationStatus"
END;

ALTER TABLE "categories"
  ADD COLUMN "default_tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE';

UPDATE "categories"
SET "default_tax_classification" = CASE
  WHEN "default_gst_rate_percent" = 0
    THEN 'NIL_RATED'::"ProductTaxClassification"
  ELSE 'TAXABLE'::"ProductTaxClassification"
END;

ALTER TABLE "products"
  ADD COLUMN "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE';

UPDATE "products"
SET "tax_classification" = CASE
  WHEN "gst_rate_percent" = 0
    THEN 'NIL_RATED'::"ProductTaxClassification"
  ELSE 'TAXABLE'::"ProductTaxClassification"
END;

ALTER TABLE "order_items"
  ADD COLUMN "supplier_tax_registration_status_snapshot" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
  ADD COLUMN "product_tax_classification_snapshot" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE';

UPDATE "order_items"
SET
  "supplier_tax_registration_status_snapshot" = CASE
    WHEN UPPER(TRIM(COALESCE("supplier_gstin_snapshot", ''))) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      THEN 'GST_REGISTERED'::"SellerTaxRegistrationStatus"
    ELSE 'NOT_REGISTERED'::"SellerTaxRegistrationStatus"
  END,
  "product_tax_classification_snapshot" = CASE
    WHEN COALESCE("gst_rate_percent_snapshot", 0) = 0
      THEN 'NIL_RATED'::"ProductTaxClassification"
    ELSE 'TAXABLE'::"ProductTaxClassification"
  END;

ALTER TABLE "tax_documents"
  ADD COLUMN "seller_tax_registration_status" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED';

UPDATE "tax_documents"
SET "seller_tax_registration_status" = CASE
  WHEN UPPER(TRIM(COALESCE("seller_gstin", ''))) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    THEN 'GST_REGISTERED'::"SellerTaxRegistrationStatus"
  ELSE 'NOT_REGISTERED'::"SellerTaxRegistrationStatus"
END;

ALTER TABLE "tax_document_lines"
  ADD COLUMN "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE';

UPDATE "tax_document_lines"
SET "tax_classification" = CASE
  WHEN COALESCE("gst_rate_percent", 0) = 0
    THEN 'NIL_RATED'::"ProductTaxClassification"
  ELSE 'TAXABLE'::"ProductTaxClassification"
END;

CREATE INDEX "tax_documents_registration_status_status_issue_date_idx"
  ON "tax_documents"("seller_tax_registration_status", "status", "issue_date");

CREATE INDEX "tax_document_lines_tax_classification_tax_document_id_idx"
  ON "tax_document_lines"("tax_classification", "tax_document_id");

CREATE OR REPLACE FUNCTION "prevent_order_item_tax_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."tax_snapshot_source" IS NOT NULL AND ROW(
    NEW."hsn_code_snapshot",
    NEW."gst_rate_percent_snapshot",
    NEW."supplier_tax_registration_status_snapshot",
    NEW."product_tax_classification_snapshot",
    NEW."tax_price_mode_snapshot",
    NEW."tax_supply_type_snapshot",
    NEW."place_of_supply_state_code_snapshot",
    NEW."supplier_gstin_snapshot",
    NEW."buyer_gstin_snapshot",
    NEW."gross_taxable_consideration_paise",
    NEW."taxable_value_paise",
    NEW."cgst_paise",
    NEW."sgst_paise",
    NEW."igst_paise",
    NEW."cess_paise",
    NEW."tax_total_paise",
    NEW."tax_snapshot_source",
    NEW."tax_snapshot"
  ) IS DISTINCT FROM ROW(
    OLD."hsn_code_snapshot",
    OLD."gst_rate_percent_snapshot",
    OLD."supplier_tax_registration_status_snapshot",
    OLD."product_tax_classification_snapshot",
    OLD."tax_price_mode_snapshot",
    OLD."tax_supply_type_snapshot",
    OLD."place_of_supply_state_code_snapshot",
    OLD."supplier_gstin_snapshot",
    OLD."buyer_gstin_snapshot",
    OLD."gross_taxable_consideration_paise",
    OLD."taxable_value_paise",
    OLD."cgst_paise",
    OLD."sgst_paise",
    OLD."igst_paise",
    OLD."cess_paise",
    OLD."tax_total_paise",
    OLD."tax_snapshot_source",
    OLD."tax_snapshot"
  ) THEN
    RAISE EXCEPTION 'Order-item tax snapshots are immutable after capture.';
  END IF;

  RETURN NEW;
END;
$$;
