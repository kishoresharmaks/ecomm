-- Bulk location imports stage source rows here, then merge into the canonical
-- location tables with set-based PostgreSQL statements.

CREATE TABLE IF NOT EXISTS location_import_staging_rows (
  run_id UUID NOT NULL,
  row_number INTEGER NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  locale TEXT NOT NULL,
  phone_code TEXT NOT NULL,
  postal_code_label TEXT NOT NULL,
  postal_code_pattern TEXT,
  country_enabled BOOLEAN NOT NULL DEFAULT true,
  country_sort_order INTEGER NOT NULL DEFAULT 0,
  subdivision_code TEXT,
  subdivision_name TEXT,
  subdivision_type TEXT,
  subdivision_source_record_id TEXT,
  subdivision_sort_order INTEGER,
  city_code TEXT,
  city_name TEXT,
  city_source_record_id TEXT,
  city_sort_order INTEGER,
  area_code TEXT,
  area_name TEXT,
  area_postal_code TEXT,
  area_source_record_id TEXT,
  area_metadata JSONB,
  area_sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, row_number)
);

CREATE INDEX IF NOT EXISTS location_import_staging_rows_run_country_idx
  ON location_import_staging_rows (run_id, country_code);

CREATE INDEX IF NOT EXISTS location_import_staging_rows_run_hierarchy_idx
  ON location_import_staging_rows (run_id, country_code, subdivision_code, city_code, area_code);
