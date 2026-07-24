-- Schema audit hardening.
-- This migration is intentionally not applied automatically. Test it on a disposable PostgreSQL
-- database before deploying it to staging or production.

-- Normalize the historical DeliveryMode database value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DeliveryMode' AND e.enumlabel = 'MANUAL_COURIER'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DeliveryMode' AND e.enumlabel = 'THIRD_PARTY_COURIER'
  ) THEN
    ALTER TYPE "DeliveryMode" RENAME VALUE 'MANUAL_COURIER' TO 'THIRD_PARTY_COURIER';
  END IF;
END $$;

-- Remove the duplicate manual transport rate after preserving the generalized minor-unit value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_delivery_modes'
      AND column_name = 'manual_transport_charge_per_km_paise'
  ) THEN
    ALTER TABLE "product_delivery_modes"
      ADD COLUMN IF NOT EXISTS "manual_transport_charge_per_km_minor" INTEGER;

    UPDATE "product_delivery_modes"
    SET "manual_transport_charge_per_km_minor" =
      COALESCE("manual_transport_charge_per_km_minor", "manual_transport_charge_per_km_paise");
  END IF;
END $$;

ALTER TABLE "product_delivery_modes"
  DROP COLUMN IF EXISTS "manual_transport_charge_per_km_paise";

-- Split the overloaded seller commission value by unit.
ALTER TABLE "sellers"
  ADD COLUMN IF NOT EXISTS "commission_value_bps" INTEGER,
  ADD COLUMN IF NOT EXISTS "commission_fixed_paise" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sellers'
      AND column_name = 'commission_value'
  ) THEN
    UPDATE "sellers"
    SET
      "commission_value_bps" = CASE
        WHEN "commission_type" = 'PERCENTAGE' THEN "commission_value"
        ELSE "commission_value_bps"
      END,
      "commission_fixed_paise" = CASE
        WHEN "commission_type" = 'FIXED' THEN "commission_value"
        ELSE "commission_fixed_paise"
      END;
  END IF;
END $$;

ALTER TABLE "sellers"
  DROP COLUMN IF EXISTS "commission_value";

-- Link checkout snapshots to both the customer and the order they produced.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checkout_sessions_customer_id_fkey'
      AND conrelid = 'checkout_sessions'::regclass
  ) THEN
    ALTER TABLE "checkout_sessions"
      ADD CONSTRAINT "checkout_sessions_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "checkout_session_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_checkout_session_id_key"
  ON "orders"("checkout_session_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_checkout_session_id_fkey'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_checkout_session_id_fkey"
      FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Normalize Razorpay webhook deduplication storage.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RazorpayWebhookEventStatus') THEN
    CREATE TYPE "RazorpayWebhookEventStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');
  END IF;
END $$;

DROP INDEX IF EXISTS "RazorpayWebhookEvent_provider_providerEventId_idx";

DO $$
BEGIN
  IF to_regclass('public."RazorpayWebhookEvent"') IS NOT NULL
     AND to_regclass('public.razorpay_webhook_events') IS NULL THEN
    ALTER TABLE "RazorpayWebhookEvent" RENAME TO "razorpay_webhook_events";
  END IF;
END $$;

DO $$
DECLARE
  rename_pair TEXT[];
BEGIN
  FOREACH rename_pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['providerEventId', 'provider_event_id'],
    ARRAY['eventType', 'event_type'],
    ARRAY['payloadHash', 'payload_hash'],
    ARRAY['processedAt', 'processed_at'],
    ARRAY['createdAt', 'created_at']
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'razorpay_webhook_events'
        AND column_name = rename_pair[1]
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'razorpay_webhook_events'
        AND column_name = rename_pair[2]
    ) THEN
      EXECUTE format(
        'ALTER TABLE "razorpay_webhook_events" RENAME COLUMN %I TO %I',
        rename_pair[1],
        rename_pair[2]
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  id_type TEXT;
  status_type TEXT;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'razorpay_webhook_events'
    AND column_name = 'id';

  IF id_type IS DISTINCT FROM 'uuid' THEN
    ALTER TABLE "razorpay_webhook_events"
      ALTER COLUMN "id" DROP DEFAULT,
      ALTER COLUMN "id" TYPE UUID USING gen_random_uuid();
  END IF;

  ALTER TABLE "razorpay_webhook_events"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

  SELECT udt_name INTO status_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'razorpay_webhook_events'
    AND column_name = 'status';

  IF status_type IS DISTINCT FROM 'RazorpayWebhookEventStatus' THEN
    ALTER TABLE "razorpay_webhook_events"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "RazorpayWebhookEventStatus"
        USING ("status"::"RazorpayWebhookEventStatus");
  END IF;

  ALTER TABLE "razorpay_webhook_events"
    ALTER COLUMN "status" SET DEFAULT 'PROCESSING';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'RazorpayWebhookEvent_pkey'
      AND conrelid = 'razorpay_webhook_events'::regclass
  ) THEN
    ALTER TABLE "razorpay_webhook_events"
      RENAME CONSTRAINT "RazorpayWebhookEvent_pkey" TO "razorpay_webhook_events_pkey";
  END IF;

  IF to_regclass('public."RazorpayWebhookEvent_provider_providerEventId_key"') IS NOT NULL
     AND to_regclass('public.razorpay_webhook_events_provider_provider_event_id_key') IS NULL THEN
    ALTER INDEX "RazorpayWebhookEvent_provider_providerEventId_key"
      RENAME TO "razorpay_webhook_events_provider_provider_event_id_key";
  END IF;
END $$;

-- Add typed CMS actor relations while preserving records whose historical actor no longer exists.
UPDATE "cms_media_assets" asset
SET "created_by_id" = NULL
WHERE "created_by_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" actor WHERE actor."id" = asset."created_by_id");

UPDATE "cms_revisions" revision
SET "actor_user_id" = NULL
WHERE "actor_user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" actor WHERE actor."id" = revision."actor_user_id");

CREATE INDEX IF NOT EXISTS "cms_media_assets_created_by_id_idx"
  ON "cms_media_assets"("created_by_id");
CREATE INDEX IF NOT EXISTS "cms_revisions_actor_user_id_idx"
  ON "cms_revisions"("actor_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cms_media_assets_created_by_id_fkey'
      AND conrelid = 'cms_media_assets'::regclass
  ) THEN
    ALTER TABLE "cms_media_assets"
      ADD CONSTRAINT "cms_media_assets_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cms_revisions_actor_user_id_fkey'
      AND conrelid = 'cms_revisions'::regclass
  ) THEN
    ALTER TABLE "cms_revisions"
      ADD CONSTRAINT "cms_revisions_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Preserve the original AI usage subject key and add an optional typed User relation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_ai_usage_summaries'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_ai_usage_summaries'
      AND column_name = 'subject_key'
  ) THEN
    ALTER TABLE "chat_ai_usage_summaries"
      RENAME COLUMN "user_id" TO "subject_key";
  END IF;

  IF to_regclass('public.chat_ai_usage_summaries_user_id_usage_date_provider_model_key') IS NOT NULL
     AND to_regclass('public.chat_ai_usage_summaries_subject_key_usage_date_provider_model_key') IS NULL THEN
    ALTER INDEX "chat_ai_usage_summaries_user_id_usage_date_provider_model_key"
      RENAME TO "chat_ai_usage_summaries_subject_key_usage_date_provider_model_key";
  END IF;

  IF to_regclass('public.chat_ai_usage_summaries_user_id_usage_date_idx') IS NOT NULL
     AND to_regclass('public.chat_ai_usage_summaries_subject_key_usage_date_idx') IS NULL THEN
    ALTER INDEX "chat_ai_usage_summaries_user_id_usage_date_idx"
      RENAME TO "chat_ai_usage_summaries_subject_key_usage_date_idx";
  END IF;
END $$;

ALTER TABLE "chat_ai_usage_summaries"
  ADD COLUMN IF NOT EXISTS "user_id" UUID;

UPDATE "chat_ai_usage_summaries" summary
SET "user_id" = summary."subject_key"::UUID
WHERE summary."subject_key" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM "users" actor WHERE actor."id" = summary."subject_key"::UUID
  );

CREATE INDEX IF NOT EXISTS "chat_ai_usage_summaries_user_id_usage_date_idx"
  ON "chat_ai_usage_summaries"("user_id", "usage_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_ai_usage_summaries_user_id_fkey'
      AND conrelid = 'chat_ai_usage_summaries'::regclass
  ) THEN
    ALTER TABLE "chat_ai_usage_summaries"
      ADD CONSTRAINT "chat_ai_usage_summaries_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Stage seller payout encryption. Existing plaintext columns remain read-only migration fallbacks;
-- application writes use the encrypted columns added here.
ALTER TABLE "seller_payout_profiles"
  ADD COLUMN IF NOT EXISTS "account_number_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "account_number_last4" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "ifsc_code_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "upi_id_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "upi_id_hint" TEXT;

-- Immutable seller-split assignment history, captured for every assignment state mutation.
CREATE TABLE IF NOT EXISTS "order_shipment_assignment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_shipment_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "previous_partner_user_id" UUID,
  "partner_user_id" UUID,
  "previous_status" "DeliveryAssignmentStatus",
  "status" "DeliveryAssignmentStatus" NOT NULL,
  "assignment_note" TEXT,
  "assigned_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "assignment_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_shipment_assignment_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_shipment_assignment_events"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS "order_shipment_assignment_events_order_shipment_id_created_at_idx"
  ON "order_shipment_assignment_events"("order_shipment_id", "created_at");
CREATE INDEX IF NOT EXISTS "order_shipment_assignment_events_order_id_created_at_idx"
  ON "order_shipment_assignment_events"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "order_shipment_assignment_events_previous_partner_user_id_idx"
  ON "order_shipment_assignment_events"("previous_partner_user_id");
CREATE INDEX IF NOT EXISTS "order_shipment_assignment_events_partner_user_id_status_created_at_idx"
  ON "order_shipment_assignment_events"("partner_user_id", "status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_shipment_assignment_events_order_shipment_id_fkey'
      AND conrelid = 'order_shipment_assignment_events'::regclass
  ) THEN
    ALTER TABLE "order_shipment_assignment_events"
      ADD CONSTRAINT "order_shipment_assignment_events_order_shipment_id_fkey"
      FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_shipment_assignment_events_order_id_fkey'
      AND conrelid = 'order_shipment_assignment_events'::regclass
  ) THEN
    ALTER TABLE "order_shipment_assignment_events"
      ADD CONSTRAINT "order_shipment_assignment_events_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_shipment_assignment_events_previous_partner_user_id_fkey'
      AND conrelid = 'order_shipment_assignment_events'::regclass
  ) THEN
    ALTER TABLE "order_shipment_assignment_events"
      ADD CONSTRAINT "order_shipment_assignment_events_previous_partner_user_id_fkey"
      FOREIGN KEY ("previous_partner_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_shipment_assignment_events_partner_user_id_fkey'
      AND conrelid = 'order_shipment_assignment_events'::regclass
  ) THEN
    ALTER TABLE "order_shipment_assignment_events"
      ADD CONSTRAINT "order_shipment_assignment_events_partner_user_id_fkey"
      FOREIGN KEY ("partner_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "order_shipment_assignment_events" (
  "id",
  "order_shipment_id",
  "order_id",
  "partner_user_id",
  "status",
  "assignment_note",
  "assigned_at",
  "accepted_at",
  "rejected_at",
  "assignment_expires_at",
  "created_at"
)
SELECT
  gen_random_uuid(),
  "id",
  "order_id",
  "delivery_partner_user_id",
  "assignment_status",
  "assignment_note",
  "assigned_at",
  "accepted_at",
  "rejected_at",
  "assignment_expires_at",
  COALESCE("updated_at", "created_at")
FROM "order_shipments"
WHERE (
  "delivery_partner_user_id" IS NOT NULL
  OR "assignment_status" <> 'UNASSIGNED'
)
AND NOT EXISTS (
  SELECT 1
  FROM "order_shipment_assignment_events" event
  WHERE event."order_shipment_id" = "order_shipments"."id"
);

CREATE OR REPLACE FUNCTION "record_order_shipment_assignment_event"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."delivery_partner_user_id" IS NOT NULL
       OR NEW."assignment_status" <> 'UNASSIGNED' THEN
      INSERT INTO "order_shipment_assignment_events" (
        "id",
        "order_shipment_id",
        "order_id",
        "partner_user_id",
        "status",
        "assignment_note",
        "assigned_at",
        "accepted_at",
        "rejected_at",
        "assignment_expires_at"
      ) VALUES (
        gen_random_uuid(),
        NEW."id",
        NEW."order_id",
        NEW."delivery_partner_user_id",
        NEW."assignment_status",
        NEW."assignment_note",
        NEW."assigned_at",
        NEW."accepted_at",
        NEW."rejected_at",
        NEW."assignment_expires_at"
      );
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(
    OLD."delivery_partner_user_id",
    OLD."assignment_status",
    OLD."assignment_note",
    OLD."assigned_at",
    OLD."accepted_at",
    OLD."rejected_at",
    OLD."assignment_expires_at"
  ) IS DISTINCT FROM ROW(
    NEW."delivery_partner_user_id",
    NEW."assignment_status",
    NEW."assignment_note",
    NEW."assigned_at",
    NEW."accepted_at",
    NEW."rejected_at",
    NEW."assignment_expires_at"
  ) THEN
    INSERT INTO "order_shipment_assignment_events" (
      "id",
      "order_shipment_id",
      "order_id",
      "previous_partner_user_id",
      "partner_user_id",
      "previous_status",
      "status",
      "assignment_note",
      "assigned_at",
      "accepted_at",
      "rejected_at",
      "assignment_expires_at"
    ) VALUES (
      gen_random_uuid(),
      NEW."id",
      NEW."order_id",
      OLD."delivery_partner_user_id",
      NEW."delivery_partner_user_id",
      OLD."assignment_status",
      NEW."assignment_status",
      NEW."assignment_note",
      NEW."assigned_at",
      NEW."accepted_at",
      NEW."rejected_at",
      NEW."assignment_expires_at"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "order_shipments_assignment_event_trigger" ON "order_shipments";
CREATE TRIGGER "order_shipments_assignment_event_trigger"
AFTER INSERT OR UPDATE OF
  "delivery_partner_user_id",
  "assignment_status",
  "assignment_note",
  "assigned_at",
  "accepted_at",
  "rejected_at",
  "assignment_expires_at"
ON "order_shipments"
FOR EACH ROW
EXECUTE FUNCTION "record_order_shipment_assignment_event"();

CREATE OR REPLACE FUNCTION "prevent_order_shipment_assignment_event_change"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Order shipment assignment history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "order_shipment_assignment_events_immutable"
  ON "order_shipment_assignment_events";
CREATE TRIGGER "order_shipment_assignment_events_immutable"
BEFORE UPDATE OR DELETE ON "order_shipment_assignment_events"
FOR EACH ROW
EXECUTE FUNCTION "prevent_order_shipment_assignment_event_change"();

-- Enforce the selected B2B fulfilment source and prevent dual procurement/production records.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "b2b_fulfilment_plans" plan
    JOIN "b2b_procurement_orders" procurement
      ON procurement."fulfilment_plan_id" = plan."id"
    WHERE plan."source" <> 'PROCURE'
  ) THEN
    RAISE EXCEPTION 'Existing procurement order does not match its fulfilment plan source';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "b2b_fulfilment_plans" plan
    JOIN "b2b_production_jobs" production
      ON production."fulfilment_plan_id" = plan."id"
    WHERE plan."source" <> 'PRODUCE'
  ) THEN
    RAISE EXCEPTION 'Existing production job does not match its fulfilment plan source';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "b2b_procurement_orders" procurement
    JOIN "b2b_production_jobs" production
      ON production."fulfilment_plan_id" = procurement."fulfilment_plan_id"
  ) THEN
    RAISE EXCEPTION 'Existing fulfilment plan has both procurement and production records';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "validate_b2b_fulfilment_child"()
RETURNS TRIGGER AS $$
DECLARE
  plan_source "B2BFulfilmentSource";
BEGIN
  SELECT "source"
  INTO plan_source
  FROM "b2b_fulfilment_plans"
  WHERE "id" = NEW."fulfilment_plan_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fulfilment plan % does not exist', NEW."fulfilment_plan_id";
  END IF;

  IF TG_TABLE_NAME = 'b2b_procurement_orders' THEN
    IF plan_source IS DISTINCT FROM 'PROCURE' THEN
      RAISE EXCEPTION 'Procurement order requires a PROCURE fulfilment plan';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "b2b_production_jobs"
      WHERE "fulfilment_plan_id" = NEW."fulfilment_plan_id"
    ) THEN
      RAISE EXCEPTION 'Fulfilment plan already has a production job';
    END IF;
  ELSE
    IF plan_source IS DISTINCT FROM 'PRODUCE' THEN
      RAISE EXCEPTION 'Production job requires a PRODUCE fulfilment plan';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "b2b_procurement_orders"
      WHERE "fulfilment_plan_id" = NEW."fulfilment_plan_id"
    ) THEN
      RAISE EXCEPTION 'Fulfilment plan already has a procurement order';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validate_b2b_fulfilment_plan_source"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."source" = OLD."source" THEN
    RETURN NEW;
  END IF;

  IF NEW."source" <> 'PROCURE' AND EXISTS (
    SELECT 1
    FROM "b2b_procurement_orders"
    WHERE "fulfilment_plan_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Fulfilment plan with a procurement order must remain PROCURE';
  END IF;

  IF NEW."source" <> 'PRODUCE' AND EXISTS (
    SELECT 1
    FROM "b2b_production_jobs"
    WHERE "fulfilment_plan_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Fulfilment plan with a production job must remain PRODUCE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "b2b_procurement_orders_fulfilment_guard"
  ON "b2b_procurement_orders";
CREATE TRIGGER "b2b_procurement_orders_fulfilment_guard"
BEFORE INSERT OR UPDATE OF "fulfilment_plan_id"
ON "b2b_procurement_orders"
FOR EACH ROW
EXECUTE FUNCTION "validate_b2b_fulfilment_child"();

DROP TRIGGER IF EXISTS "b2b_production_jobs_fulfilment_guard"
  ON "b2b_production_jobs";
CREATE TRIGGER "b2b_production_jobs_fulfilment_guard"
BEFORE INSERT OR UPDATE OF "fulfilment_plan_id"
ON "b2b_production_jobs"
FOR EACH ROW
EXECUTE FUNCTION "validate_b2b_fulfilment_child"();

DROP TRIGGER IF EXISTS "b2b_fulfilment_plans_source_guard"
  ON "b2b_fulfilment_plans";
CREATE TRIGGER "b2b_fulfilment_plans_source_guard"
BEFORE UPDATE OF "source"
ON "b2b_fulfilment_plans"
FOR EACH ROW
EXECUTE FUNCTION "validate_b2b_fulfilment_plan_source"();

-- Store new ERP exports in private object storage while retaining legacy DB bytes for readback.
ALTER TABLE "b2b_erp_export_jobs"
  ADD COLUMN IF NOT EXISTS "file_key" TEXT;

-- Consolidate legacy rows into the application singleton before enforcing one active config.
INSERT INTO "email_settings" (
  "id",
  "provider",
  "sender_name",
  "sender_email",
  "admin_recipients",
  "is_enabled",
  "provider_config",
  "created_at",
  "updated_at"
)
SELECT
  '00000000-0000-0000-0000-000000000001'::UUID,
  source."provider",
  source."sender_name",
  source."sender_email",
  source."admin_recipients",
  source."is_enabled",
  source."provider_config",
  source."created_at",
  source."updated_at"
FROM "email_settings" source
ORDER BY
  source."is_enabled" DESC,
  source."created_at",
  source."id"
LIMIT 1
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "email_settings" (
  "id",
  "provider",
  "sender_name",
  "sender_email",
  "admin_recipients",
  "is_enabled",
  "provider_config",
  "created_at",
  "updated_at"
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'smtp',
  '1HandIndia',
  'no-reply@example.com',
  NULL,
  FALSE,
  '{}'::JSONB,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

WITH preferred_enabled AS (
  SELECT
    "provider",
    "sender_name",
    "sender_email",
    "admin_recipients",
    "provider_config"
  FROM "email_settings"
  WHERE "is_enabled" = TRUE
  ORDER BY
    CASE WHEN "id" = '00000000-0000-0000-0000-000000000001'::UUID THEN 0 ELSE 1 END,
    "created_at",
    "id"
  LIMIT 1
)
UPDATE "email_settings" singleton
SET
  "provider" = active."provider",
  "sender_name" = active."sender_name",
  "sender_email" = active."sender_email",
  "admin_recipients" = active."admin_recipients",
  "provider_config" = active."provider_config",
  "is_enabled" = TRUE,
  "updated_at" = CURRENT_TIMESTAMP
FROM preferred_enabled active
WHERE singleton."id" = '00000000-0000-0000-0000-000000000001'::UUID;

UPDATE "email_settings"
SET "is_enabled" = FALSE
WHERE "id" <> '00000000-0000-0000-0000-000000000001'::UUID
  AND "is_enabled" = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS "email_settings_single_enabled_key"
  ON "email_settings" (("is_enabled"))
  WHERE "is_enabled" = TRUE;

COMMENT ON TABLE "delivery_details" IS
  'Order-level delivery aggregate retained for compatibility. order_shipments is authoritative per seller split.';
COMMENT ON TABLE "courier_shipments" IS
  'Single-shipment provider booking compatibility record. Consignment/package tables are authoritative for multi-package tracking.';
COMMENT ON COLUMN "private_uploads"."actor_user_id" IS
  'Polymorphic audit subject containing either users.id or business_buyers.id.';
COMMENT ON COLUMN "marketplace_tax_documents"."source_id" IS
  'Intentional polymorphic source reference interpreted with source_type.';
COMMENT ON COLUMN "courier_webhook_events"."order_shipment_id" IS
  'Loose provider event correlation; application reconciliation validates the shipment reference.';
