ALTER TYPE "SellerType" ADD VALUE IF NOT EXISTS 'SERVICE_PROVIDER';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SERVICE_EARNING';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SERVICE_COMMISSION';

DO $$
BEGIN
  CREATE TYPE "SellerCapability" AS ENUM ('RETAIL', 'SERVICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceVisitMode" AS ENUM ('CUSTOMER_LOCATION', 'PROVIDER_LOCATION', 'REMOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServicePricingModel" AS ENUM ('FIXED_PRICE', 'QUOTE_FIRST', 'INSPECTION_FEE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServicePaymentMode" AS ENUM ('FULL_PAYMENT', 'ADVANCE_PAYMENT', 'INSPECTION_FEE', 'PAY_AT_VISIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceBookingStatus" AS ENUM (
    'REQUESTED',
    'ACCEPTED',
    'QUOTE_SENT',
    'QUOTE_ACCEPTED',
    'QUOTE_EXPIRED',
    'QUOTE_REJECTED',
    'CLOSED_AFTER_INSPECTION',
    'REJECTED',
    'CANCELLED',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETION_SUBMITTED',
    'COMPLETION_DISPUTED',
    'COMPLETED',
    'CANCELLED_AFTER_DISPUTE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceCancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceCancellationInitiator" AS ENUM ('CUSTOMER', 'PROVIDER', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceQuoteStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServicePaymentPurpose" AS ENUM (
    'FULL_PAYMENT',
    'ADVANCE_PAYMENT',
    'INSPECTION_FEE',
    'FINAL_QUOTE',
    'PAY_AT_VISIT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceDisputeResolution" AS ENUM (
    'COMPLETE_BOOKING',
    'CANCEL_AFTER_DISPUTE',
    'REFUND_CUSTOMER',
    'RELEASE_TO_PROVIDER',
    'PARTIAL_REFUND'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "sellers"
  ADD COLUMN IF NOT EXISTS "primary_capability" "SellerCapability" NOT NULL DEFAULT 'RETAIL',
  ADD COLUMN IF NOT EXISTS "enabled_capabilities" "SellerCapability"[] NOT NULL DEFAULT ARRAY['RETAIL']::"SellerCapability"[],
  ADD COLUMN IF NOT EXISTS "service_rating" DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS "service_review_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "sellers_primary_capability_idx" ON "sellers"("primary_capability");
CREATE INDEX IF NOT EXISTS "sellers_enabled_capabilities_idx" ON "sellers" USING GIN ("enabled_capabilities");

CREATE TABLE IF NOT EXISTS "service_listings" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ServiceListingStatus" NOT NULL DEFAULT 'DRAFT',
  "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "pricing_model" "ServicePricingModel" NOT NULL DEFAULT 'FIXED_PRICE',
  "payment_mode" "ServicePaymentMode" NOT NULL DEFAULT 'FULL_PAYMENT',
  "cancellation_policy" "ServiceCancellationPolicy" NOT NULL DEFAULT 'FLEXIBLE',
  "base_price_paise" INTEGER,
  "inspection_fee_paise" INTEGER NOT NULL DEFAULT 0,
  "advance_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "quote_ttl_hours" INTEGER NOT NULL DEFAULT 48,
  "service_duration_minutes" INTEGER,
  "allowed_visit_modes" "ServiceVisitMode"[] NOT NULL DEFAULT ARRAY['CUSTOMER_LOCATION']::"ServiceVisitMode"[],
  "highlights" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "inclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "exclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requirements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "service_rating" DECIMAL(3, 2),
  "service_review_count" INTEGER NOT NULL DEFAULT 0,
  "search_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_packages" (
  "id" UUID NOT NULL,
  "service_listing_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_paise" INTEGER NOT NULL,
  "mrp_paise" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "duration_minutes" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_listing_images" (
  "id" UUID NOT NULL,
  "service_listing_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "alt_text" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_listing_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_areas" (
  "id" UUID NOT NULL,
  "service_listing_id" UUID NOT NULL,
  "label" TEXT,
  "country_code" TEXT,
  "state_code" TEXT,
  "city_code" TEXT,
  "local_area_code" TEXT,
  "pincode" TEXT,
  "latitude" DECIMAL(10, 7),
  "longitude" DECIMAL(10, 7),
  "radius_km" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_bookings" (
  "id" UUID NOT NULL,
  "booking_number" TEXT NOT NULL,
  "customer_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "service_listing_id" UUID NOT NULL,
  "service_package_id" UUID,
  "status" "ServiceBookingStatus" NOT NULL DEFAULT 'REQUESTED',
  "visit_mode" "ServiceVisitMode" NOT NULL,
  "payment_mode" "ServicePaymentMode" NOT NULL,
  "cancellation_policy" "ServiceCancellationPolicy" NOT NULL,
  "scheduled_start_at" TIMESTAMP(3),
  "scheduled_end_at" TIMESTAMP(3),
  "address_snapshot" JSONB,
  "customer_issue" TEXT NOT NULL,
  "customer_note" TEXT,
  "provider_note" TEXT,
  "cancellation_reason" TEXT,
  "cancellation_initiator" "ServiceCancellationInitiator",
  "cancelled_by" UUID,
  "cancelled_at" TIMESTAMP(3),
  "completion_note" TEXT,
  "completion_images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "completion_submitted_at" TIMESTAMP(3),
  "completion_confirmed_by" UUID,
  "completion_confirmed_at" TIMESTAMP(3),
  "subtotal_paise" INTEGER NOT NULL DEFAULT 0,
  "inspection_fee_paise" INTEGER NOT NULL DEFAULT 0,
  "advance_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "total_payable_paise" INTEGER NOT NULL DEFAULT 0,
  "paid_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_quotes" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "quote_number" TEXT NOT NULL,
  "status" "ServiceQuoteStatus" NOT NULL DEFAULT 'SENT',
  "subtotal_paise" INTEGER NOT NULL DEFAULT 0,
  "total_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "note" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "sent_by" UUID,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_quote_line_items" (
  "id" UUID NOT NULL,
  "quote_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_paise" INTEGER NOT NULL,
  "total_paise" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "service_quote_line_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_payments" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "purpose" "ServicePaymentPurpose" NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider_order_id" TEXT,
  "provider_payment_id" TEXT,
  "reference_number" TEXT,
  "raw_response" JSONB,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_payment_events" (
  "id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "old_status" "PaymentStatus",
  "new_status" "PaymentStatus",
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_disputes" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "raised_by" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "admin_note" TEXT,
  "resolution" "ServiceDisputeResolution",
  "resolved_by" UUID,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_booking_settlements" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "payout_id" UUID,
  "gross_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "inspection_fee_gross_paise" INTEGER NOT NULL DEFAULT 0,
  "commission_paise" INTEGER NOT NULL DEFAULT 0,
  "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
  "tds_paise" INTEGER NOT NULL DEFAULT 0,
  "tcs_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
  "refund_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "net_payable_paise" INTEGER NOT NULL DEFAULT 0,
  "status" "SellerSettlementStatus" NOT NULL DEFAULT 'ELIGIBLE',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "finance_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_booking_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_reviews" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "service_listing_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "body" TEXT,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_review_replies" (
  "id" UUID NOT NULL,
  "review_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_review_replies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_listings_slug_key" ON "service_listings"("slug");
CREATE INDEX IF NOT EXISTS "service_listings_seller_id_idx" ON "service_listings"("seller_id");
CREATE INDEX IF NOT EXISTS "service_listings_category_id_idx" ON "service_listings"("category_id");
CREATE INDEX IF NOT EXISTS "service_listings_status_idx" ON "service_listings"("status");
CREATE INDEX IF NOT EXISTS "service_listings_approval_status_idx" ON "service_listings"("approval_status");
CREATE INDEX IF NOT EXISTS "service_listings_pricing_model_idx" ON "service_listings"("pricing_model");
CREATE INDEX IF NOT EXISTS "service_listings_payment_mode_idx" ON "service_listings"("payment_mode");
CREATE INDEX IF NOT EXISTS "service_listings_deleted_at_status_approval_status_created_at_idx" ON "service_listings"("deleted_at", "status", "approval_status", "created_at");
CREATE INDEX IF NOT EXISTS "service_listings_category_id_status_approval_status_created_at_idx" ON "service_listings"("category_id", "status", "approval_status", "created_at");
CREATE INDEX IF NOT EXISTS "service_listings_seller_id_deleted_at_created_at_idx" ON "service_listings"("seller_id", "deleted_at", "created_at");

CREATE INDEX IF NOT EXISTS "service_packages_service_listing_id_idx" ON "service_packages"("service_listing_id");
CREATE INDEX IF NOT EXISTS "service_packages_is_active_sort_order_idx" ON "service_packages"("is_active", "sort_order");

CREATE INDEX IF NOT EXISTS "service_listing_images_service_listing_id_idx" ON "service_listing_images"("service_listing_id");

CREATE INDEX IF NOT EXISTS "service_areas_service_listing_id_idx" ON "service_areas"("service_listing_id");
CREATE INDEX IF NOT EXISTS "service_areas_country_code_state_code_city_code_idx" ON "service_areas"("country_code", "state_code", "city_code");
CREATE INDEX IF NOT EXISTS "service_areas_local_area_code_idx" ON "service_areas"("local_area_code");
CREATE INDEX IF NOT EXISTS "service_areas_pincode_idx" ON "service_areas"("pincode");
CREATE INDEX IF NOT EXISTS "service_areas_is_active_idx" ON "service_areas"("is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "service_bookings_booking_number_key" ON "service_bookings"("booking_number");
CREATE INDEX IF NOT EXISTS "service_bookings_customer_id_created_at_idx" ON "service_bookings"("customer_id", "created_at");
CREATE INDEX IF NOT EXISTS "service_bookings_seller_id_created_at_idx" ON "service_bookings"("seller_id", "created_at");
CREATE INDEX IF NOT EXISTS "service_bookings_service_listing_id_idx" ON "service_bookings"("service_listing_id");
CREATE INDEX IF NOT EXISTS "service_bookings_service_package_id_idx" ON "service_bookings"("service_package_id");
CREATE INDEX IF NOT EXISTS "service_bookings_status_idx" ON "service_bookings"("status");
CREATE INDEX IF NOT EXISTS "service_bookings_scheduled_start_at_idx" ON "service_bookings"("scheduled_start_at");
CREATE INDEX IF NOT EXISTS "service_bookings_payment_mode_status_idx" ON "service_bookings"("payment_mode", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "service_quotes_quote_number_key" ON "service_quotes"("quote_number");
CREATE INDEX IF NOT EXISTS "service_quotes_booking_id_idx" ON "service_quotes"("booking_id");
CREATE INDEX IF NOT EXISTS "service_quotes_status_idx" ON "service_quotes"("status");
CREATE INDEX IF NOT EXISTS "service_quotes_expires_at_idx" ON "service_quotes"("expires_at");

CREATE INDEX IF NOT EXISTS "service_quote_line_items_quote_id_idx" ON "service_quote_line_items"("quote_id");

CREATE UNIQUE INDEX IF NOT EXISTS "service_payments_provider_provider_order_id_key" ON "service_payments"("provider", "provider_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "service_payments_provider_provider_payment_id_key" ON "service_payments"("provider", "provider_payment_id");
CREATE INDEX IF NOT EXISTS "service_payments_booking_id_idx" ON "service_payments"("booking_id");
CREATE INDEX IF NOT EXISTS "service_payments_seller_id_created_at_idx" ON "service_payments"("seller_id", "created_at");
CREATE INDEX IF NOT EXISTS "service_payments_status_idx" ON "service_payments"("status");
CREATE INDEX IF NOT EXISTS "service_payments_provider_status_created_at_idx" ON "service_payments"("provider", "status", "created_at");

CREATE INDEX IF NOT EXISTS "service_payment_events_payment_id_idx" ON "service_payment_events"("payment_id");

CREATE INDEX IF NOT EXISTS "service_disputes_booking_id_idx" ON "service_disputes"("booking_id");
CREATE INDEX IF NOT EXISTS "service_disputes_raised_by_idx" ON "service_disputes"("raised_by");
CREATE INDEX IF NOT EXISTS "service_disputes_resolved_at_idx" ON "service_disputes"("resolved_at");

CREATE UNIQUE INDEX IF NOT EXISTS "service_booking_settlements_booking_id_key" ON "service_booking_settlements"("booking_id");
CREATE INDEX IF NOT EXISTS "service_booking_settlements_seller_id_status_created_at_idx" ON "service_booking_settlements"("seller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "service_booking_settlements_payout_id_status_idx" ON "service_booking_settlements"("payout_id", "status");
CREATE INDEX IF NOT EXISTS "service_booking_settlements_status_idx" ON "service_booking_settlements"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "service_reviews_booking_id_customer_id_key" ON "service_reviews"("booking_id", "customer_id");
CREATE INDEX IF NOT EXISTS "service_reviews_service_listing_id_is_visible_created_at_idx" ON "service_reviews"("service_listing_id", "is_visible", "created_at");
CREATE INDEX IF NOT EXISTS "service_reviews_seller_id_is_visible_created_at_idx" ON "service_reviews"("seller_id", "is_visible", "created_at");
CREATE INDEX IF NOT EXISTS "service_reviews_customer_id_created_at_idx" ON "service_reviews"("customer_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "service_review_replies_review_id_key" ON "service_review_replies"("review_id");
CREATE INDEX IF NOT EXISTS "service_review_replies_provider_id_idx" ON "service_review_replies"("provider_id");

ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_listing_images" ADD CONSTRAINT "service_listing_images_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_completion_confirmed_by_fkey" FOREIGN KEY ("completion_confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_quote_line_items" ADD CONSTRAINT "service_quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_payments" ADD CONSTRAINT "service_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_payments" ADD CONSTRAINT "service_payments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_payment_events" ADD CONSTRAINT "service_payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "service_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_booking_settlements" ADD CONSTRAINT "service_booking_settlements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_booking_settlements" ADD CONSTRAINT "service_booking_settlements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_booking_settlements" ADD CONSTRAINT "service_booking_settlements_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_review_replies" ADD CONSTRAINT "service_review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "service_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_review_replies" ADD CONSTRAINT "service_review_replies_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seller_ledger_entries"
  ADD COLUMN IF NOT EXISTS "service_booking_id" UUID,
  ADD COLUMN IF NOT EXISTS "service_settlement_id" UUID;

CREATE INDEX IF NOT EXISTS "seller_ledger_entries_service_booking_id_idx" ON "seller_ledger_entries"("service_booking_id");
CREATE INDEX IF NOT EXISTS "seller_ledger_entries_service_settlement_id_idx" ON "seller_ledger_entries"("service_settlement_id");

ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_service_booking_id_fkey" FOREIGN KEY ("service_booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_service_settlement_id_fkey" FOREIGN KEY ("service_settlement_id") REFERENCES "service_booking_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
