-- Admin-managed coupons for 1HandIndia.
-- Coupons are PostgreSQL-backed and do not use Redis for validation, limits, or redemption tracking.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'COUPON_DISCOUNT';

CREATE TYPE "CouponStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "CouponDiscountType" AS ENUM (
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_SHIPPING'
);

CREATE TYPE "CouponFundingSource" AS ENUM (
  'PLATFORM',
  'SELLER'
);

CREATE TYPE "CouponSellerParticipationStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'REMOVED'
);

CREATE TYPE "CouponRedemptionStatus" AS ENUM (
  'ACTIVE',
  'PARTIALLY_ADJUSTED',
  'FULLY_REVERSED'
);

CREATE TYPE "CouponAdjustmentReason" AS ENUM (
  'ORDER_CANCELLED',
  'PARTIAL_CANCELLED',
  'REFUND_ADJUSTMENT',
  'SHIPPING_NON_REFUNDABLE',
  'ADMIN_ADJUSTMENT'
);

CREATE TABLE "coupons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
  "discount_type" "CouponDiscountType" NOT NULL,
  "funding_source" "CouponFundingSource" NOT NULL DEFAULT 'PLATFORM',
  "discount_value_bps" INTEGER,
  "discount_amount_paise" INTEGER,
  "max_discount_paise" INTEGER,
  "min_subtotal_paise" INTEGER,
  "max_subtotal_paise" INTEGER,
  "total_usage_limit" INTEGER,
  "per_customer_limit" INTEGER,
  "redeemed_count" INTEGER NOT NULL DEFAULT 0,
  "first_order_only" BOOLEAN NOT NULL DEFAULT false,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "paused_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "internal_note" TEXT,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_seller_eligibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_seller_eligibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_product_eligibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_product_eligibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_category_eligibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_category_eligibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_customer_eligibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_customer_eligibilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_seller_participations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "status" "CouponSellerParticipationStatus" NOT NULL DEFAULT 'PENDING',
  "accepted_at" TIMESTAMP(3),
  "declined_at" TIMESTAMP(3),
  "removed_at" TIMESTAMP(3),
  "locked_at" TIMESTAMP(3),
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_seller_participations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_redemptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "code_snapshot" TEXT NOT NULL,
  "title_snapshot" TEXT NOT NULL,
  "discount_type_snapshot" "CouponDiscountType" NOT NULL,
  "funding_source_snapshot" "CouponFundingSource" NOT NULL,
  "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "merchandise_basis_paise" INTEGER NOT NULL DEFAULT 0,
  "shipping_basis_paise" INTEGER NOT NULL DEFAULT 0,
  "merchandise_discount_paise" INTEGER NOT NULL DEFAULT 0,
  "shipping_discount_paise" INTEGER NOT NULL DEFAULT 0,
  "discount_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  "seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  "adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "snapshot" JSONB,
  "reversed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupon_redemption_adjustments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "coupon_redemption_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "order_item_id" UUID,
  "order_seller_split_id" UUID,
  "reason" "CouponAdjustmentReason" NOT NULL,
  "discount_reversed_paise" INTEGER NOT NULL DEFAULT 0,
  "merchandise_discount_reversed_paise" INTEGER NOT NULL DEFAULT 0,
  "shipping_discount_reversed_paise" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_redemption_adjustments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders"
  ADD COLUMN "coupon_id" UUID,
  ADD COLUMN "coupon_code" TEXT,
  ADD COLUMN "coupon_title" TEXT,
  ADD COLUMN "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_merchandise_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_shipping_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_snapshot" JSONB;

ALTER TABLE "order_items"
  ADD COLUMN "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_snapshot" JSONB;

ALTER TABLE "order_seller_splits"
  ADD COLUMN "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_snapshot" JSONB;

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_status_starts_at_ends_at_idx" ON "coupons"("status", "starts_at", "ends_at");
CREATE INDEX "coupons_funding_source_status_idx" ON "coupons"("funding_source", "status");
CREATE INDEX "coupons_created_at_idx" ON "coupons"("created_at");
CREATE INDEX "coupons_created_by_idx" ON "coupons"("created_by");
CREATE INDEX "coupons_updated_by_idx" ON "coupons"("updated_by");

CREATE UNIQUE INDEX "coupon_seller_eligibilities_coupon_id_seller_id_key" ON "coupon_seller_eligibilities"("coupon_id", "seller_id");
CREATE INDEX "coupon_seller_eligibilities_seller_id_idx" ON "coupon_seller_eligibilities"("seller_id");

CREATE UNIQUE INDEX "coupon_product_eligibilities_coupon_id_product_id_key" ON "coupon_product_eligibilities"("coupon_id", "product_id");
CREATE INDEX "coupon_product_eligibilities_product_id_idx" ON "coupon_product_eligibilities"("product_id");

CREATE UNIQUE INDEX "coupon_category_eligibilities_coupon_id_category_id_key" ON "coupon_category_eligibilities"("coupon_id", "category_id");
CREATE INDEX "coupon_category_eligibilities_category_id_idx" ON "coupon_category_eligibilities"("category_id");

CREATE UNIQUE INDEX "coupon_customer_eligibilities_coupon_id_customer_id_key" ON "coupon_customer_eligibilities"("coupon_id", "customer_id");
CREATE INDEX "coupon_customer_eligibilities_customer_id_idx" ON "coupon_customer_eligibilities"("customer_id");

CREATE UNIQUE INDEX "coupon_seller_participations_coupon_id_seller_id_key" ON "coupon_seller_participations"("coupon_id", "seller_id");
CREATE INDEX "coupon_seller_participations_seller_id_status_idx" ON "coupon_seller_participations"("seller_id", "status");
CREATE INDEX "coupon_seller_participations_coupon_id_status_idx" ON "coupon_seller_participations"("coupon_id", "status");

CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");
CREATE INDEX "coupon_redemptions_coupon_id_status_created_at_idx" ON "coupon_redemptions"("coupon_id", "status", "created_at");
CREATE INDEX "coupon_redemptions_customer_id_coupon_id_status_idx" ON "coupon_redemptions"("customer_id", "coupon_id", "status");
CREATE INDEX "coupon_redemptions_customer_id_created_at_idx" ON "coupon_redemptions"("customer_id", "created_at");

CREATE INDEX "coupon_redemption_adjustments_coupon_redemption_id_created_at_idx" ON "coupon_redemption_adjustments"("coupon_redemption_id", "created_at");
CREATE INDEX "coupon_redemption_adjustments_order_id_created_at_idx" ON "coupon_redemption_adjustments"("order_id", "created_at");
CREATE INDEX "coupon_redemption_adjustments_order_item_id_idx" ON "coupon_redemption_adjustments"("order_item_id");
CREATE INDEX "coupon_redemption_adjustments_order_seller_split_id_idx" ON "coupon_redemption_adjustments"("order_seller_split_id");
CREATE INDEX "coupon_redemption_adjustments_created_by_idx" ON "coupon_redemption_adjustments"("created_by");

CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");
CREATE INDEX "orders_coupon_code_idx" ON "orders"("coupon_code");
CREATE INDEX "order_items_coupon_discount_paise_idx" ON "order_items"("coupon_discount_paise");

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "coupon_seller_eligibilities" ADD CONSTRAINT "coupon_seller_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_seller_eligibilities" ADD CONSTRAINT "coupon_seller_eligibilities_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_product_eligibilities" ADD CONSTRAINT "coupon_product_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_product_eligibilities" ADD CONSTRAINT "coupon_product_eligibilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_category_eligibilities" ADD CONSTRAINT "coupon_category_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_category_eligibilities" ADD CONSTRAINT "coupon_category_eligibilities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_customer_eligibilities" ADD CONSTRAINT "coupon_customer_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_customer_eligibilities" ADD CONSTRAINT "coupon_customer_eligibilities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_seller_participations" ADD CONSTRAINT "coupon_seller_participations_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_seller_participations" ADD CONSTRAINT "coupon_seller_participations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_coupon_redemption_id_fkey" FOREIGN KEY ("coupon_redemption_id") REFERENCES "coupon_redemptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
