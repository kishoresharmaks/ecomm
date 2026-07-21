-- Add seller contact columns without losing existing seller profile rows.
ALTER TABLE "seller_profiles"
  ADD COLUMN IF NOT EXISTS "contactName" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

UPDATE "seller_profiles" AS profile
SET
  "contactName" = COALESCE(
    NULLIF(BTRIM(profile."contactName"), ''),
    NULLIF(BTRIM(app_user."full_name"), ''),
    NULLIF(BTRIM(seller."store_name"), ''),
    'Seller'
  ),
  "contactPhone" = COALESCE(
    NULLIF(BTRIM(profile."contactPhone"), ''),
    NULLIF(BTRIM(app_user."phone"), ''),
    ''
  ),
  "contactEmail" = COALESCE(
    NULLIF(BTRIM(profile."contactEmail"), ''),
    NULLIF(BTRIM(app_user."email"), '')
  )
FROM "sellers" AS seller
JOIN "users" AS app_user
  ON app_user."id" = seller."user_id"
WHERE seller."id" = profile."seller_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "seller_profiles"
    WHERE "contactName" IS NULL
      OR "contactPhone" IS NULL
      OR "contactEmail" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Seller profile contact backfill failed because one or more profiles have no linked seller/user data.';
  END IF;
END
$$;

ALTER TABLE "seller_profiles"
  ALTER COLUMN "contactName" SET NOT NULL,
  ALTER COLUMN "contactPhone" SET NOT NULL,
  ALTER COLUMN "contactEmail" SET NOT NULL;
