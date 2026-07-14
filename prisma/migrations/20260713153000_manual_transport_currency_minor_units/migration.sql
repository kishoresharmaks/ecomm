ALTER TABLE "product_delivery_modes"
  ADD COLUMN IF NOT EXISTS "manual_transport_charge_per_km_minor" INTEGER,
  ADD COLUMN IF NOT EXISTS "manual_transport_currency" VARCHAR(3);

UPDATE "product_delivery_modes"
SET
  "manual_transport_charge_per_km_minor" = COALESCE("manual_transport_charge_per_km_minor", "manual_transport_charge_per_km_paise"),
  "manual_transport_currency" = COALESCE("manual_transport_currency", 'INR')
WHERE "delivery_mode" = 'MANUAL_TRANSPORT';
