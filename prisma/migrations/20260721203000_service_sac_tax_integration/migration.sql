-- Integrate SAC and seller-output GST snapshots into the services marketplace.

ALTER TYPE "TaxDocumentSource" ADD VALUE IF NOT EXISTS 'SERVICE_BOOKING';
ALTER TYPE "TaxDocumentLineType" ADD VALUE IF NOT EXISTS 'SERVICE';

ALTER TABLE "service_listings"
  ADD COLUMN IF NOT EXISTS "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
  ADD COLUMN IF NOT EXISTS "sac_code" TEXT,
  ADD COLUMN IF NOT EXISTS "gst_rate_percent" DECIMAL(5, 2);

-- Existing listings need seller review because their SAC cannot be inferred safely.
UPDATE "service_listings"
SET
  "tax_classification" = 'NON_GST',
  "gst_rate_percent" = 0
WHERE "sac_code" IS NULL;

CREATE INDEX IF NOT EXISTS "service_listings_sac_code_idx"
  ON "service_listings"("sac_code");
CREATE INDEX IF NOT EXISTS "service_listings_tax_classification_gst_rate_percent_idx"
  ON "service_listings"("tax_classification", "gst_rate_percent");

ALTER TABLE "service_bookings"
  ADD COLUMN IF NOT EXISTS "seller_tax_registration_status_snapshot" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
  ADD COLUMN IF NOT EXISTS "seller_legal_name_snapshot" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "seller_gstin_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_address_snapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "buyer_legal_name_snapshot" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "buyer_gstin_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "buyer_address_snapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "service_tax_classification_snapshot" "ProductTaxClassification" NOT NULL DEFAULT 'NON_GST',
  ADD COLUMN IF NOT EXISTS "sac_code_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "gst_rate_percent_snapshot" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_supply_type_snapshot" "TaxSupplyType" NOT NULL DEFAULT 'INTER_STATE',
  ADD COLUMN IF NOT EXISTS "place_of_supply_state_code_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "igst_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cess_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_total_paise" INTEGER NOT NULL DEFAULT 0;

UPDATE "service_bookings" booking
SET
  "seller_tax_registration_status_snapshot" =
    COALESCE(profile."tax_registration_status", 'NOT_REGISTERED'),
  "seller_legal_name_snapshot" =
    COALESCE(NULLIF(profile."business_legal_name", ''), seller."store_name"),
  "seller_gstin_snapshot" = NULLIF(UPPER(profile."gst_number"), ''),
  "seller_address_snapshot" = COALESCE(
    (
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'line1', address."line1",
        'line2', address."line2",
        'area', address."area",
        'city', address."city",
        'state', address."state",
        'pincode', address."pincode",
        'country', address."country",
        'countryCode', address."country_code",
        'stateCode', address."state_code"
      ))
      FROM "seller_addresses" address
      WHERE address."seller_id" = booking."seller_id"
      ORDER BY address."created_at", address."id"
      LIMIT 1
    ),
    '{}'::JSONB
  ),
  "buyer_legal_name_snapshot" =
    COALESCE(NULLIF(customer."display_name", ''), NULLIF(app_user."full_name", ''), app_user."email"),
  "buyer_address_snapshot" = COALESCE(
    (
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'fullName', address."full_name",
        'line1', address."line1",
        'line2', address."line2",
        'area', address."area",
        'city', address."city",
        'state', address."state",
        'pincode', address."pincode",
        'country', address."country",
        'countryCode', address."country_code",
        'stateCode', address."state_code"
      ))
      FROM "customer_addresses" address
      WHERE address."customer_id" = booking."customer_id"
      ORDER BY address."is_default" DESC, address."created_at", address."id"
      LIMIT 1
    ),
    booking."address_snapshot",
    '{}'::JSONB
  ),
  "service_tax_classification_snapshot" = listing."tax_classification",
  "sac_code_snapshot" = listing."sac_code",
  "gst_rate_percent_snapshot" = 0,
  "taxable_value_paise" = booking."total_payable_paise",
  "tax_total_paise" = 0
FROM "sellers" seller
LEFT JOIN "seller_profiles" profile ON profile."seller_id" = seller."id"
JOIN "customers" customer ON customer."id" = booking."customer_id"
JOIN "users" app_user ON app_user."id" = customer."user_id"
JOIN "service_listings" listing ON listing."id" = booking."service_listing_id"
WHERE seller."id" = booking."seller_id";

ALTER TABLE "service_bookings"
  ALTER COLUMN "seller_legal_name_snapshot" DROP DEFAULT,
  ALTER COLUMN "seller_address_snapshot" DROP DEFAULT,
  ALTER COLUMN "buyer_legal_name_snapshot" DROP DEFAULT,
  ALTER COLUMN "buyer_address_snapshot" DROP DEFAULT,
  ALTER COLUMN "service_tax_classification_snapshot" SET DEFAULT 'TAXABLE';

CREATE INDEX IF NOT EXISTS "service_bookings_seller_tax_registration_status_snapshot_created_at_idx"
  ON "service_bookings"("seller_tax_registration_status_snapshot", "created_at");
CREATE INDEX IF NOT EXISTS "service_bookings_sac_code_snapshot_created_at_idx"
  ON "service_bookings"("sac_code_snapshot", "created_at");

ALTER TABLE "tax_documents"
  ADD COLUMN IF NOT EXISTS "service_booking_id" UUID;

CREATE INDEX IF NOT EXISTS "tax_documents_service_booking_id_seller_id_idx"
  ON "tax_documents"("service_booking_id", "seller_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tax_documents_service_booking_id_fkey'
      AND conrelid = 'tax_documents'::regclass
  ) THEN
    ALTER TABLE "tax_documents"
      ADD CONSTRAINT "tax_documents_service_booking_id_fkey"
      FOREIGN KEY ("service_booking_id") REFERENCES "service_bookings"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
