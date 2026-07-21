import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function fromMarker(relativePath, marker) {
  const sql = read(relativePath);
  const index = sql.indexOf(marker);
  if (index < 0) {
    throw new Error(`Marker not found in ${relativePath}: ${marker}`);
  }
  return sql.slice(index).trim();
}

const sections = [
  `-- PostgreSQL-only objects that Prisma schema diff cannot represent.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,

  read("prisma/migrations/20260601090000_production_ecommerce_optimizations/migration.sql"),

  `-- Preserve the filtered search indexes used by public catalogue queries.
CREATE INDEX IF NOT EXISTS "idx_search_documents_visible_vector"
  ON "search_documents" USING GIN ("search_vector")
  WHERE "visibility_status" = 'VISIBLE';
CREATE INDEX IF NOT EXISTS "idx_search_documents_visible_title_trgm"
  ON "search_documents" USING GIN ("normalized_title" gin_trgm_ops)
  WHERE "visibility_status" = 'VISIBLE';
CREATE INDEX IF NOT EXISTS "idx_search_documents_visible_subtitle_trgm"
  ON "search_documents" USING GIN ("normalized_subtitle" gin_trgm_ops)
  WHERE "visibility_status" = 'VISIBLE';
CREATE INDEX IF NOT EXISTS "idx_search_documents_visible_search_text_trgm"
  ON "search_documents" USING GIN ("search_text" gin_trgm_ops)
  WHERE "visibility_status" = 'VISIBLE';`,

  `-- Constraints and routing invariant for FX provider settings.
ALTER TABLE "fx_provider_settings"
  ADD CONSTRAINT "fx_provider_settings_priority_check"
    CHECK ("priority" BETWEEN 1 AND 1000),
  ADD CONSTRAINT "fx_provider_settings_timeout_ms_check"
    CHECK ("timeout_ms" BETWEEN 1000 AND 30000),
  ADD CONSTRAINT "fx_provider_settings_cache_ttl_minutes_check"
    CHECK ("cache_ttl_minutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "fx_provider_settings_primary_enabled_check"
    CHECK (NOT "is_primary" OR "is_enabled");
CREATE UNIQUE INDEX "fx_provider_settings_single_primary_key"
  ON "fx_provider_settings"("is_primary")
  WHERE "is_primary" = true;`,

  fromMarker(
    "prisma/migrations/20260720130000_gst_tax_documents/migration.sql",
    'CREATE OR REPLACE FUNCTION "prevent_order_item_tax_snapshot_mutation"',
  ),

  fromMarker(
    "prisma/migrations/20260720190000_advanced_gst_compliance/migration.sql",
    'CREATE OR REPLACE FUNCTION "prevent_locked_gst_filing_snapshot_mutation"',
  ),

  fromMarker(
    "prisma/migrations/20260720203000_separate_seller_registration_and_supply_tax/migration.sql",
    'CREATE OR REPLACE FUNCTION "prevent_order_item_tax_snapshot_mutation"',
  ),

  fromMarker(
    "prisma/migrations/20260721120000_complete_b2b_order_to_cash/migration.sql",
    'CREATE OR REPLACE FUNCTION "prevent_b2b_verified_payment_core_update"',
  ),

  fromMarker(
    "prisma/migrations/20260721160000_schema_audit_hardening/migration.sql",
    'CREATE OR REPLACE FUNCTION "record_order_shipment_assignment_event"',
  ),

  `-- Prisma does not emit these B2B accounting checks in an empty-schema diff.
ALTER TABLE "b2b_dispute_resolutions"
  ADD CONSTRAINT "b2b_dispute_resolutions_quantities_nonnegative"
    CHECK (
      "accepted_quantity" >= 0 AND
      "rejected_quantity" >= 0 AND
      "return_quantity" >= 0 AND
      "replacement_quantity" >= 0
    ),
  ADD CONSTRAINT "b2b_dispute_resolutions_amounts_nonnegative"
    CHECK (
      "refund_amount_paise" >= 0 AND
      "receivable_adjustment_paise" >= 0
    );
ALTER TABLE "b2b_financial_reconciliations"
  ADD CONSTRAINT "b2b_financial_reconciliations_amounts_nonnegative"
    CHECK (
      "expected_paid_amount_paise" >= 0 AND
      "actual_paid_amount_paise" >= 0 AND
      "expected_outstanding_paise" >= 0 AND
      ("actual_outstanding_paise" IS NULL OR "actual_outstanding_paise" >= 0)
    );`,

  fromMarker(
    "prisma/migrations/20260721190000_b2b_exception_path_hardening/migration.sql",
    'CREATE OR REPLACE FUNCTION "prevent_final_b2b_amendment_change"',
  ),
];

process.stdout.write(`${sections.join("\n\n")}\n`);
