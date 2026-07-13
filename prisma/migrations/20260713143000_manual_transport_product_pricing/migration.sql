ALTER TABLE "product_delivery_modes"
  ADD COLUMN IF NOT EXISTS "manual_transport_free_distance_km" DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS "manual_transport_charge_per_km_paise" INTEGER,
  ADD COLUMN IF NOT EXISTS "manual_transport_note" VARCHAR(500);
