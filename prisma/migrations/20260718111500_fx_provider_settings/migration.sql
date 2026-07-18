-- CreateTable
CREATE TABLE "fx_provider_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_code" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "adapter_code" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT false,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "api_base_url" TEXT,
  "api_key_encrypted" TEXT,
  "credentials_configured" BOOLEAN NOT NULL DEFAULT false,
  "timeout_ms" INTEGER NOT NULL DEFAULT 5000,
  "cache_ttl_minutes" INTEGER NOT NULL DEFAULT 60,
  "notes" TEXT,
  "last_health_status" TEXT NOT NULL DEFAULT 'NEVER_TESTED',
  "last_checked_at" TIMESTAMP(3),
  "last_success_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fx_provider_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fx_provider_settings_priority_check" CHECK ("priority" BETWEEN 1 AND 1000),
  CONSTRAINT "fx_provider_settings_timeout_ms_check" CHECK ("timeout_ms" BETWEEN 1000 AND 30000),
  CONSTRAINT "fx_provider_settings_cache_ttl_minutes_check" CHECK ("cache_ttl_minutes" BETWEEN 1 AND 1440),
  CONSTRAINT "fx_provider_settings_primary_enabled_check" CHECK (NOT "is_primary" OR "is_enabled")
);

-- CreateIndex
CREATE UNIQUE INDEX "fx_provider_settings_provider_code_key"
  ON "fx_provider_settings"("provider_code");

-- CreateIndex
CREATE UNIQUE INDEX "fx_provider_settings_adapter_code_key"
  ON "fx_provider_settings"("adapter_code");

-- CreateIndex
CREATE INDEX "fx_provider_settings_is_enabled_priority_idx"
  ON "fx_provider_settings"("is_enabled", "priority");

-- CreateIndex
CREATE INDEX "fx_provider_settings_is_primary_is_enabled_idx"
  ON "fx_provider_settings"("is_primary", "is_enabled");

-- Only one provider may be the active primary routing source.
CREATE UNIQUE INDEX "fx_provider_settings_single_primary_key"
  ON "fx_provider_settings"("is_primary")
  WHERE "is_primary" = true;
