-- PostgreSQL-only coupon scale hardening.
-- Keeps hot redemption counters on a narrow row instead of the wider coupon row.

ALTER TABLE "coupons"
  ADD COLUMN "is_marketplace_wide" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "coupon_usage_counters" (
  "coupon_id" UUID NOT NULL,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "discount_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  "seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_usage_counters_pkey" PRIMARY KEY ("coupon_id")
);

INSERT INTO "coupon_usage_counters" (
  "coupon_id",
  "used_count",
  "discount_paise",
  "platform_funded_discount_paise",
  "seller_funded_discount_paise",
  "version",
  "updated_at"
)
SELECT
  c."id",
  COALESCE(COUNT(r."id") FILTER (WHERE r."status" <> 'FULLY_REVERSED'), 0)::INTEGER,
  COALESCE(SUM(r."discount_paise") FILTER (WHERE r."status" <> 'FULLY_REVERSED'), 0)::INTEGER,
  COALESCE(SUM(r."platform_funded_discount_paise") FILTER (WHERE r."status" <> 'FULLY_REVERSED'), 0)::INTEGER,
  COALESCE(SUM(r."seller_funded_discount_paise") FILTER (WHERE r."status" <> 'FULLY_REVERSED'), 0)::INTEGER,
  0,
  CURRENT_TIMESTAMP
FROM "coupons" c
LEFT JOIN "coupon_redemptions" r ON r."coupon_id" = c."id"
GROUP BY c."id";

UPDATE "coupons" c
SET "is_marketplace_wide" = NOT (
  EXISTS (SELECT 1 FROM "coupon_seller_eligibilities" e WHERE e."coupon_id" = c."id") OR
  EXISTS (SELECT 1 FROM "coupon_product_eligibilities" e WHERE e."coupon_id" = c."id") OR
  EXISTS (SELECT 1 FROM "coupon_category_eligibilities" e WHERE e."coupon_id" = c."id") OR
  EXISTS (SELECT 1 FROM "coupon_customer_eligibilities" e WHERE e."coupon_id" = c."id")
);

CREATE INDEX "coupons_is_marketplace_wide_status_idx" ON "coupons"("is_marketplace_wide", "status");
CREATE INDEX "coupon_usage_counters_used_count_idx" ON "coupon_usage_counters"("used_count");
CREATE INDEX "coupon_redemptions_coupon_id_created_at_id_idx" ON "coupon_redemptions"("coupon_id", "created_at" DESC, "id" DESC);

ALTER TABLE "coupon_usage_counters"
  ADD CONSTRAINT "coupon_usage_counters_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
