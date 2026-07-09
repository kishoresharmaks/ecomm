CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

INSERT INTO "delivery_partner_service_areas" (
  "id",
  "partner_profile_id",
  "country_code",
  "state_code",
  "city_code",
  "pincode",
  "local_area_code",
  "priority",
  "is_active",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  profile."id",
  profile."service_country_code",
  profile."service_state_code",
  profile."service_city_code",
  btrim(pin."value"),
  NULL,
  profile."priority",
  TRUE,
  'Backfilled from legacy delivery_partner_profiles.service_pincodes',
  now(),
  now()
FROM "delivery_partner_profiles" profile
CROSS JOIN LATERAL unnest(COALESCE(profile."service_pincodes", ARRAY[]::text[])) AS pin("value")
WHERE btrim(pin."value") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "delivery_partner_service_areas" existing
    WHERE existing."partner_profile_id" = profile."id"
      AND existing."is_active" = TRUE
      AND upper(COALESCE(existing."country_code", '')) = upper(COALESCE(profile."service_country_code", ''))
      AND upper(COALESCE(existing."state_code", '')) = upper(COALESCE(profile."service_state_code", ''))
      AND upper(COALESCE(existing."city_code", '')) = upper(COALESCE(profile."service_city_code", ''))
      AND upper(COALESCE(existing."pincode", '')) = upper(btrim(pin."value"))
      AND existing."local_area_code" IS NULL
  );

INSERT INTO "delivery_partner_service_areas" (
  "id",
  "partner_profile_id",
  "country_code",
  "state_code",
  "city_code",
  "pincode",
  "local_area_code",
  "priority",
  "is_active",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  profile."id",
  profile."service_country_code",
  profile."service_state_code",
  profile."service_city_code",
  NULL,
  btrim(area."value"),
  profile."priority",
  TRUE,
  'Backfilled from legacy delivery_partner_profiles.service_local_area_codes',
  now(),
  now()
FROM "delivery_partner_profiles" profile
CROSS JOIN LATERAL unnest(COALESCE(profile."service_local_area_codes", ARRAY[]::text[])) AS area("value")
WHERE btrim(area."value") <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "delivery_partner_service_areas" existing
    WHERE existing."partner_profile_id" = profile."id"
      AND existing."is_active" = TRUE
      AND upper(COALESCE(existing."country_code", '')) = upper(COALESCE(profile."service_country_code", ''))
      AND upper(COALESCE(existing."state_code", '')) = upper(COALESCE(profile."service_state_code", ''))
      AND upper(COALESCE(existing."city_code", '')) = upper(COALESCE(profile."service_city_code", ''))
      AND existing."pincode" IS NULL
      AND upper(COALESCE(existing."local_area_code", '')) = upper(btrim(area."value"))
  );

DROP INDEX CONCURRENTLY IF EXISTS "delivery_partner_profiles_base_latitude_base_longitude_idx";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_partner_profiles_earth_gist_idx"
  ON "delivery_partner_profiles"
  USING gist (ll_to_earth("base_latitude"::float8, "base_longitude"::float8))
  WHERE "base_latitude" IS NOT NULL
    AND "base_longitude" IS NOT NULL
    AND "service_radius_km" IS NOT NULL
    AND "service_radius_km" > 0;

ALTER TABLE "delivery_partner_profiles"
  DROP COLUMN IF EXISTS "service_pincodes",
  DROP COLUMN IF EXISTS "service_local_area_codes";
