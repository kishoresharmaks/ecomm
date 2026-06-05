-- Map routing and coordinate foundation for accurate local delivery distance.
-- Provider settings are DB-managed and can be updated from admin settings.

ALTER TABLE "customer_addresses"
  ADD COLUMN "latitude" DECIMAL(10, 7),
  ADD COLUMN "longitude" DECIMAL(10, 7);

CREATE INDEX "customer_addresses_latitude_longitude_idx"
  ON "customer_addresses"("latitude", "longitude");

INSERT INTO "settings" ("id", "key", "group", "value_type", "value", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'maps.routing.enabled', 'maps', 'BOOLEAN', 'false'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'maps.routing.provider', 'maps', 'STRING', '"HAVERSINE"'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'maps.routing.google_api_token', 'maps', 'STRING', '""'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'maps.routing.google_travel_mode', 'maps', 'STRING', '"DRIVE"'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'maps.routing.mapbox_access_token', 'maps', 'STRING', '""'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'maps.routing.mapbox_profile', 'maps', 'STRING', '"mapbox/driving"'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'maps.routing.fallback_to_haversine', 'maps', 'BOOLEAN', 'true'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
