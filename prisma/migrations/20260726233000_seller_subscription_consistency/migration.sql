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
