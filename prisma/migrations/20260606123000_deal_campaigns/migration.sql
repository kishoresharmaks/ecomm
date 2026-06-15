-- Real commerce deal campaigns.
-- Seller-funded discounts are applied at read/checkout time; product prices are not mutated.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "DealStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'CANCELLED'
);

CREATE TYPE "DealParticipationStatus" AS ENUM (
  'ACCEPTED',
  'DECLINED'
);

CREATE TYPE "DealProductEnrollmentStatus" AS ENUM (
  'ENROLLED',
  'REMOVED'
);

CREATE TABLE "deals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category_id" UUID NOT NULL,
  "discount_bps" INTEGER NOT NULL,
  "join_deadline" TIMESTAMP(3) NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
  "max_sellers" INTEGER,
  "max_products" INTEGER,
  "published_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deal_participations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "deal_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "status" "DealParticipationStatus" NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "declined_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deal_participations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deal_product_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "deal_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "status" "DealProductEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
  "enrolled_at" TIMESTAMP(3),
  "removed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deal_product_enrollments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_items"
  ADD COLUMN "original_unit_price_paise" INTEGER,
  ADD COLUMN "deal_discount_bps" INTEGER,
  ADD COLUMN "deal_discount_paise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deal_id" UUID,
  ADD COLUMN "deal_snapshot" JSONB;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deal_participations"
  ADD CONSTRAINT "deal_participations_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_participations"
  ADD CONSTRAINT "deal_participations_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_product_enrollments"
  ADD CONSTRAINT "deal_product_enrollments_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_product_enrollments"
  ADD CONSTRAINT "deal_product_enrollments_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deal_product_enrollments"
  ADD CONSTRAINT "deal_product_enrollments_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "deals_category_id_idx" ON "deals"("category_id");
CREATE INDEX "deals_status_starts_at_ends_at_idx" ON "deals"("status", "starts_at", "ends_at");
CREATE INDEX "deals_join_deadline_idx" ON "deals"("join_deadline");
CREATE INDEX "deals_created_by_idx" ON "deals"("created_by");
CREATE INDEX "deals_updated_by_idx" ON "deals"("updated_by");

CREATE UNIQUE INDEX "deal_participations_deal_id_seller_id_key"
  ON "deal_participations"("deal_id", "seller_id");
CREATE INDEX "deal_participations_seller_id_status_idx"
  ON "deal_participations"("seller_id", "status");
CREATE INDEX "deal_participations_deal_id_status_idx"
  ON "deal_participations"("deal_id", "status");

CREATE UNIQUE INDEX "deal_product_enrollments_deal_id_product_id_key"
  ON "deal_product_enrollments"("deal_id", "product_id");
CREATE INDEX "deal_product_enrollments_deal_id_status_idx"
  ON "deal_product_enrollments"("deal_id", "status");
CREATE INDEX "deal_product_enrollments_seller_id_status_idx"
  ON "deal_product_enrollments"("seller_id", "status");
CREATE INDEX "deal_product_enrollments_product_id_status_idx"
  ON "deal_product_enrollments"("product_id", "status");

CREATE INDEX "order_items_deal_id_idx" ON "order_items"("deal_id");
