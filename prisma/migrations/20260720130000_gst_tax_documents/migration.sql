-- Production GST snapshots, seller-scoped tax documents, and reporting support.
-- This migration intentionally backfills existing order-item snapshots before
-- enabling database-level immutability guards.

CREATE TYPE "TaxPriceMode" AS ENUM (
  'INCLUSIVE',
  'EXCLUSIVE'
);

CREATE TYPE "TaxSupplyType" AS ENUM (
  'INTRA_STATE',
  'INTER_STATE',
  'OUTSIDE_INDIA'
);

CREATE TYPE "TaxDocumentType" AS ENUM (
  'TAX_INVOICE',
  'BILL_OF_SUPPLY',
  'CREDIT_NOTE',
  'DEBIT_NOTE'
);

CREATE TYPE "TaxDocumentStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'CANCELLED'
);

CREATE TYPE "TaxDocumentSource" AS ENUM (
  'CHECKOUT',
  'LEGACY_BACKFILL',
  'B2B_FULFILMENT',
  'RETURN_REFUND',
  'ORDER_CANCELLATION'
);

CREATE TYPE "TaxDocumentLineType" AS ENUM (
  'PRODUCT',
  'SHIPPING',
  'ADJUSTMENT'
);

CREATE TYPE "GstrSupplySection" AS ENUM (
  'B2B',
  'B2CL',
  'B2CS',
  'CDNR',
  'CDNUR',
  'EXPORT',
  'SEZ',
  'NIL_EXEMPT_NON_GST'
);

ALTER TABLE "orders"
  ADD COLUMN "buyer_gstin_snapshot" TEXT,
  ADD COLUMN "buyer_legal_name_snapshot" TEXT;

ALTER TABLE "order_items"
  ADD COLUMN "hsn_code_snapshot" TEXT,
  ADD COLUMN "gst_rate_percent_snapshot" DECIMAL(5, 2),
  ADD COLUMN "tax_price_mode_snapshot" "TaxPriceMode" NOT NULL DEFAULT 'INCLUSIVE',
  ADD COLUMN "tax_supply_type_snapshot" "TaxSupplyType",
  ADD COLUMN "place_of_supply_state_code_snapshot" TEXT,
  ADD COLUMN "supplier_gstin_snapshot" TEXT,
  ADD COLUMN "buyer_gstin_snapshot" TEXT,
  ADD COLUMN "gross_taxable_consideration_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "igst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cess_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_total_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_snapshot_source" "TaxDocumentSource",
  ADD COLUMN "tax_snapshot" JSONB;

DROP INDEX IF EXISTS "b2b_orders_tax_invoice_number_key";
CREATE INDEX "b2b_orders_tax_invoice_number_idx"
  ON "b2b_orders"("tax_invoice_number");

CREATE TABLE "tax_document_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" UUID NOT NULL,
  "financial_year" TEXT NOT NULL,
  "document_type" "TaxDocumentType" NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tax_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_number" TEXT,
  "document_type" "TaxDocumentType" NOT NULL,
  "status" "TaxDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "TaxDocumentSource" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "financial_year" TEXT NOT NULL,
  "order_id" UUID,
  "b2b_order_id" UUID,
  "order_seller_split_id" UUID,
  "seller_id" UUID NOT NULL,
  "return_request_id" UUID,
  "refund_request_id" UUID,
  "original_document_id" UUID,
  "issue_date" TIMESTAMP(3),
  "supply_date" TIMESTAMP(3),
  "seller_legal_name" TEXT NOT NULL,
  "seller_gstin" TEXT,
  "seller_address_snapshot" JSONB NOT NULL,
  "buyer_legal_name" TEXT NOT NULL,
  "buyer_gstin" TEXT,
  "buyer_address_snapshot" JSONB NOT NULL,
  "place_of_supply_state_code" TEXT,
  "supply_type" "TaxSupplyType",
  "gstr_supply_section" "GstrSupplySection",
  "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
  "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  "igst_paise" INTEGER NOT NULL DEFAULT 0,
  "cess_paise" INTEGER NOT NULL DEFAULT 0,
  "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
  "invoice_value_paise" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "voided_at" TIMESTAMP(3),
  "void_reason" TEXT,
  "issued_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tax_document_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tax_document_id" UUID NOT NULL,
  "order_item_id" UUID,
  "return_request_item_id" UUID,
  "refund_request_item_id" UUID,
  "line_type" "TaxDocumentLineType" NOT NULL DEFAULT 'PRODUCT',
  "description" TEXT NOT NULL,
  "sku" TEXT,
  "hsn_sac_code" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "uqc" TEXT NOT NULL DEFAULT 'NOS',
  "unit_price_paise" INTEGER NOT NULL DEFAULT 0,
  "gross_value_paise" INTEGER NOT NULL DEFAULT 0,
  "discount_paise" INTEGER NOT NULL DEFAULT 0,
  "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
  "gst_rate_percent" DECIMAL(5, 2),
  "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  "igst_paise" INTEGER NOT NULL DEFAULT 0,
  "cess_paise" INTEGER NOT NULL DEFAULT 0,
  "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
  "line_value_paise" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_document_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_document_sequences_seller_id_financial_year_document_type_key"
  ON "tax_document_sequences"("seller_id", "financial_year", "document_type");
CREATE INDEX "tax_document_sequences_seller_id_financial_year_idx"
  ON "tax_document_sequences"("seller_id", "financial_year");

CREATE UNIQUE INDEX "tax_documents_idempotency_key_key"
  ON "tax_documents"("idempotency_key");
CREATE UNIQUE INDEX "tax_documents_seller_id_document_number_key"
  ON "tax_documents"("seller_id", "document_number");
CREATE INDEX "tax_documents_seller_id_issue_date_document_type_idx"
  ON "tax_documents"("seller_id", "issue_date", "document_type");
CREATE INDEX "tax_documents_seller_id_status_created_at_idx"
  ON "tax_documents"("seller_id", "status", "created_at");
CREATE INDEX "tax_documents_order_id_seller_id_idx"
  ON "tax_documents"("order_id", "seller_id");
CREATE INDEX "tax_documents_b2b_order_id_seller_id_idx"
  ON "tax_documents"("b2b_order_id", "seller_id");
CREATE INDEX "tax_documents_order_seller_split_id_idx"
  ON "tax_documents"("order_seller_split_id");
CREATE INDEX "tax_documents_return_request_id_seller_id_idx"
  ON "tax_documents"("return_request_id", "seller_id");
CREATE INDEX "tax_documents_refund_request_id_seller_id_idx"
  ON "tax_documents"("refund_request_id", "seller_id");
CREATE INDEX "tax_documents_original_document_id_idx"
  ON "tax_documents"("original_document_id");
CREATE INDEX "tax_documents_issued_by_id_idx"
  ON "tax_documents"("issued_by_id");

CREATE INDEX "tax_document_lines_tax_document_id_idx"
  ON "tax_document_lines"("tax_document_id");
CREATE INDEX "tax_document_lines_order_item_id_idx"
  ON "tax_document_lines"("order_item_id");
CREATE INDEX "tax_document_lines_return_request_item_id_idx"
  ON "tax_document_lines"("return_request_item_id");
CREATE INDEX "tax_document_lines_refund_request_item_id_idx"
  ON "tax_document_lines"("refund_request_item_id");
CREATE INDEX "tax_document_lines_hsn_sac_code_created_at_idx"
  ON "tax_document_lines"("hsn_sac_code", "created_at");

CREATE INDEX "order_items_hsn_code_snapshot_created_at_idx"
  ON "order_items"("hsn_code_snapshot", "created_at");
CREATE INDEX "order_items_gst_rate_percent_snapshot_created_at_idx"
  ON "order_items"("gst_rate_percent_snapshot", "created_at");

ALTER TABLE "tax_document_sequences"
  ADD CONSTRAINT "tax_document_sequences_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_b2b_order_id_fkey"
  FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_order_seller_split_id_fkey"
  FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_return_request_id_fkey"
  FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_refund_request_id_fkey"
  FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_original_document_id_fkey"
  FOREIGN KEY ("original_document_id") REFERENCES "tax_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_documents"
  ADD CONSTRAINT "tax_documents_issued_by_id_fkey"
  FOREIGN KEY ("issued_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tax_document_lines"
  ADD CONSTRAINT "tax_document_lines_tax_document_id_fkey"
  FOREIGN KEY ("tax_document_id") REFERENCES "tax_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_document_lines"
  ADD CONSTRAINT "tax_document_lines_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_document_lines"
  ADD CONSTRAINT "tax_document_lines_return_request_item_id_fkey"
  FOREIGN KEY ("return_request_item_id") REFERENCES "return_request_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_document_lines"
  ADD CONSTRAINT "tax_document_lines_refund_request_item_id_fkey"
  FOREIGN KEY ("refund_request_item_id") REFERENCES "refund_request_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

WITH legacy_source AS (
  SELECT
    oi."id",
    p."hsn_code",
    CASE
      WHEN sp."gst_number" IS NOT NULL
        AND UPPER(TRIM(sp."gst_number")) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      THEN UPPER(TRIM(sp."gst_number"))
      ELSE NULL
    END AS "supplier_gstin",
    CASE
      WHEN sp."gst_number" IS NOT NULL
        AND UPPER(TRIM(sp."gst_number")) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      THEN COALESCE(p."gst_rate_percent", 0)
      ELSE 0
    END AS "gst_rate_percent",
    UPPER(NULLIF(TRIM(sa."state_code"), '')) AS "seller_state_code",
    UPPER(COALESCE(NULLIF(TRIM(sa."country_code"), ''), 'IN')) AS "seller_country_code",
    UPPER(
      COALESCE(
        NULLIF(TRIM(o."shipping_address_snapshot" ->> 'stateCode'), ''),
        NULLIF(TRIM(o."shipping_address_snapshot" ->> 'state_code'), ''),
        NULLIF(TRIM(sa."state_code"), '')
      )
    ) AS "buyer_state_code",
    UPPER(
      COALESCE(
        NULLIF(TRIM(o."shipping_address_snapshot" ->> 'countryCode'), ''),
        NULLIF(TRIM(o."shipping_address_snapshot" ->> 'country_code'), ''),
        'IN'
      )
    ) AS "buyer_country_code",
    GREATEST(0, oi."line_total_paise" - oi."coupon_discount_paise") AS "consideration_paise",
    oi."line_total_paise" AS "gross_line_value_paise",
    GREATEST(0, oi."coupon_discount_paise") AS "discount_paise"
  FROM "order_items" oi
  INNER JOIN "orders" o ON o."id" = oi."order_id"
  INNER JOIN "products" p ON p."id" = oi."product_id"
  LEFT JOIN "seller_profiles" sp ON sp."seller_id" = oi."seller_id"
  LEFT JOIN LATERAL (
    SELECT
      seller_address."state_code",
      seller_address."country_code"
    FROM "seller_addresses" seller_address
    WHERE seller_address."seller_id" = oi."seller_id"
    ORDER BY seller_address."created_at" ASC
    LIMIT 1
  ) sa ON true
),
legacy_calculation AS (
  SELECT
    legacy_source.*,
    CASE
      WHEN "seller_country_code" <> 'IN' OR "buyer_country_code" <> 'IN'
        THEN 'OUTSIDE_INDIA'::"TaxSupplyType"
      WHEN "seller_state_code" IS NOT NULL
        AND "buyer_state_code" IS NOT NULL
        AND "seller_state_code" = "buyer_state_code"
        THEN 'INTRA_STATE'::"TaxSupplyType"
      ELSE 'INTER_STATE'::"TaxSupplyType"
    END AS "supply_type",
    GREATEST(0, ROUND("gst_rate_percent" * 100)::INTEGER) AS "rate_bps"
  FROM legacy_source
),
legacy_tax AS (
  SELECT
    legacy_calculation.*,
    CASE
      WHEN "consideration_paise" <= 0 OR "rate_bps" <= 0
        THEN "consideration_paise"
      ELSE ROUND(
        ("consideration_paise"::NUMERIC * 10000) /
        (10000 + "rate_bps")
      )::INTEGER
    END AS "taxable_paise"
  FROM legacy_calculation
),
legacy_totals AS (
  SELECT
    legacy_tax.*,
    GREATEST(0, "consideration_paise" - "taxable_paise") AS "tax_paise"
  FROM legacy_tax
)
UPDATE "order_items" oi
SET
  "hsn_code_snapshot" = NULLIF(TRIM(legacy_totals."hsn_code"), ''),
  "gst_rate_percent_snapshot" = legacy_totals."gst_rate_percent",
  "tax_price_mode_snapshot" = 'INCLUSIVE',
  "tax_supply_type_snapshot" = legacy_totals."supply_type",
  "place_of_supply_state_code_snapshot" = legacy_totals."buyer_state_code",
  "supplier_gstin_snapshot" = legacy_totals."supplier_gstin",
  "buyer_gstin_snapshot" = NULL,
  "gross_taxable_consideration_paise" = legacy_totals."consideration_paise",
  "taxable_value_paise" = legacy_totals."taxable_paise",
  "cgst_paise" = CASE
    WHEN legacy_totals."supply_type" = 'INTRA_STATE'
      THEN FLOOR(legacy_totals."tax_paise"::NUMERIC / 2)::INTEGER
    ELSE 0
  END,
  "sgst_paise" = CASE
    WHEN legacy_totals."supply_type" = 'INTRA_STATE'
      THEN legacy_totals."tax_paise" - FLOOR(legacy_totals."tax_paise"::NUMERIC / 2)::INTEGER
    ELSE 0
  END,
  "igst_paise" = CASE
    WHEN legacy_totals."supply_type" <> 'INTRA_STATE'
      THEN legacy_totals."tax_paise"
    ELSE 0
  END,
  "cess_paise" = 0,
  "tax_total_paise" = legacy_totals."tax_paise",
  "tax_snapshot_source" = 'LEGACY_BACKFILL',
  "tax_snapshot" = jsonb_build_object(
    'version', 1,
    'source', 'LEGACY_BACKFILL',
    'priceMode', 'INCLUSIVE',
    'sellerStateCode', legacy_totals."seller_state_code",
    'placeOfSupplyStateCode', legacy_totals."buyer_state_code",
    'supplyType', legacy_totals."supply_type",
    'registeredSupplier', legacy_totals."supplier_gstin" IS NOT NULL,
    'grossLineValuePaise', legacy_totals."gross_line_value_paise",
    'discountPaise', legacy_totals."discount_paise",
    'considerationPaise', legacy_totals."consideration_paise",
    'hsnCode', NULLIF(TRIM(legacy_totals."hsn_code"), ''),
    'gstRatePercent', legacy_totals."gst_rate_percent",
    'taxableValuePaise', legacy_totals."taxable_paise",
    'cgstPaise', CASE
      WHEN legacy_totals."supply_type" = 'INTRA_STATE'
        THEN FLOOR(legacy_totals."tax_paise"::NUMERIC / 2)::INTEGER
      ELSE 0
    END,
    'sgstPaise', CASE
      WHEN legacy_totals."supply_type" = 'INTRA_STATE'
        THEN legacy_totals."tax_paise" - FLOOR(legacy_totals."tax_paise"::NUMERIC / 2)::INTEGER
      ELSE 0
    END,
    'igstPaise', CASE
      WHEN legacy_totals."supply_type" <> 'INTRA_STATE'
        THEN legacy_totals."tax_paise"
      ELSE 0
    END,
    'cessPaise', 0,
    'taxTotalPaise', legacy_totals."tax_paise"
  )
FROM legacy_totals
WHERE oi."id" = legacy_totals."id"
  AND oi."tax_snapshot_source" IS NULL;

CREATE OR REPLACE FUNCTION "prevent_order_item_tax_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."tax_snapshot_source" IS NOT NULL AND ROW(
    NEW."hsn_code_snapshot",
    NEW."gst_rate_percent_snapshot",
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

CREATE TRIGGER "order_items_tax_snapshot_immutable"
BEFORE UPDATE ON "order_items"
FOR EACH ROW
EXECUTE FUNCTION "prevent_order_item_tax_snapshot_mutation"();

CREATE OR REPLACE FUNCTION "prevent_issued_tax_document_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'ISSUED' THEN
    RAISE EXCEPTION 'Issued tax documents are immutable.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "tax_documents_issued_immutable"
BEFORE UPDATE OR DELETE ON "tax_documents"
FOR EACH ROW
EXECUTE FUNCTION "prevent_issued_tax_document_mutation"();

CREATE OR REPLACE FUNCTION "prevent_issued_tax_document_line_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "TaxDocumentStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status"
    INTO parent_status
    FROM "tax_documents"
    WHERE "id" = OLD."tax_document_id";

    IF parent_status = 'ISSUED' THEN
      RAISE EXCEPTION 'Lines belonging to issued tax documents are immutable.';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status"
    INTO parent_status
    FROM "tax_documents"
    WHERE "id" = NEW."tax_document_id";

    IF parent_status = 'ISSUED' THEN
      RAISE EXCEPTION 'Lines cannot be added to or changed on issued tax documents.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "tax_document_lines_issued_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "tax_document_lines"
FOR EACH ROW
EXECUTE FUNCTION "prevent_issued_tax_document_line_mutation"();
