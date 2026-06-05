CREATE INDEX IF NOT EXISTS idx_location_cities_code_active
  ON location_cities (code, active);

CREATE INDEX IF NOT EXISTS idx_location_areas_city_postal
  ON location_areas (city_id, postal_code);

CREATE INDEX IF NOT EXISTS idx_location_areas_code
  ON location_areas (code);

CREATE INDEX IF NOT EXISTS idx_location_areas_postal_active_sort
  ON location_areas (postal_code, active, sort_order);
