-- Store optional postal-source metadata for imported local-area rows.
-- Existing address flows continue to use the normalized area name and postal code.

ALTER TABLE location_areas
ADD COLUMN IF NOT EXISTS metadata JSONB;
