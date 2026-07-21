-- Prepare an existing database for the DeliveryMode schema rename.
-- Prisma 7 reads the datasource from prisma.config.ts for `prisma db execute`.
-- This script is idempotent and does not delete rows.

DO $$
DECLARE
  old_value_exists BOOLEAN;
  new_value_exists BOOLEAN;
  target RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
    WHERE enum_type.typname = 'DeliveryMode'
      AND enum_namespace.nspname = current_schema()
      AND enum_value.enumlabel = 'MANUAL_COURIER'
  ) INTO old_value_exists;

  SELECT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
    WHERE enum_type.typname = 'DeliveryMode'
      AND enum_namespace.nspname = current_schema()
      AND enum_value.enumlabel = 'THIRD_PARTY_COURIER'
  ) INTO new_value_exists;

  IF old_value_exists AND NOT new_value_exists THEN
    ALTER TYPE "DeliveryMode"
      RENAME VALUE 'MANUAL_COURIER' TO 'THIRD_PARTY_COURIER';
    RETURN;
  END IF;

  IF old_value_exists AND new_value_exists THEN
    FOR target IN
      SELECT
        namespace.nspname AS schema_name,
        relation.relname AS table_name,
        attribute.attname AS column_name
      FROM pg_attribute attribute
      JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      JOIN pg_type enum_type ON enum_type.oid = attribute.atttypid
      WHERE enum_type.typname = 'DeliveryMode'
        AND namespace.nspname = current_schema()
        AND relation.relkind IN ('r', 'p')
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    LOOP
      EXECUTE format(
        'UPDATE %I.%I SET %I = %L WHERE %I::text = %L',
        target.schema_name,
        target.table_name,
        target.column_name,
        'THIRD_PARTY_COURIER',
        target.column_name,
        'MANUAL_COURIER'
      );
    END LOOP;
    RETURN;
  END IF;

  IF NOT old_value_exists AND NOT new_value_exists THEN
    RAISE EXCEPTION
      'DeliveryMode contains neither MANUAL_COURIER nor THIRD_PARTY_COURIER';
  END IF;
END $$;
