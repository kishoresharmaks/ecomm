CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "private_uploads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "asset_key" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "upload_kind" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "content_type" TEXT,
  "size_bytes" INTEGER,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "private_uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "private_uploads_asset_key_key" ON "private_uploads"("asset_key");
CREATE INDEX "private_uploads_provider_created_at_idx" ON "private_uploads"("provider", "created_at");
CREATE INDEX "private_uploads_upload_kind_created_at_idx" ON "private_uploads"("upload_kind", "created_at");
CREATE INDEX "private_uploads_deleted_at_created_at_idx" ON "private_uploads"("deleted_at", "created_at");
