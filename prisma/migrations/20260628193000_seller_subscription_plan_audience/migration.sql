CREATE TYPE "SellerSubscriptionPlanAudience" AS ENUM ('RETAIL', 'SERVICE', 'ALL');

ALTER TABLE "seller_subscription_plans"
  ADD COLUMN "audience" "SellerSubscriptionPlanAudience" NOT NULL DEFAULT 'RETAIL';

UPDATE "seller_subscription_plans"
SET "audience" = 'SERVICE'
WHERE "code" IN ('SERVICE_STARTER', 'SERVICE_GROWTH_MONTHLY', 'SERVICE_PRO_YEARLY')
   OR "code" LIKE 'SERVICE\_%' ESCAPE '\';

CREATE INDEX "seller_subscription_plans_audience_is_active_sort_order_idx"
  ON "seller_subscription_plans"("audience", "is_active", "sort_order");
