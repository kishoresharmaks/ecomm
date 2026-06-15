-- PostgreSQL-backed advanced search for 1HandIndia.
-- This keeps search indexing, suggestions, and ranking inside PostgreSQL.
-- Redis/BullMQ are intentionally not used for this search flow.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "SearchDocumentEntityType" AS ENUM ('PRODUCT', 'STORE', 'CATEGORY');

-- CreateEnum
CREATE TYPE "SearchDocumentVisibilityStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SearchIndexJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "search_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_type" "SearchDocumentEntityType" NOT NULL,
  "entity_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "normalized_title" TEXT NOT NULL,
  "subtitle" TEXT,
  "normalized_subtitle" TEXT,
  "search_text" TEXT NOT NULL,
  "slug" TEXT,
  "image_url" TEXT,
  "category_id" UUID,
  "seller_id" UUID,
  "min_price_paise" INTEGER,
  "max_price_paise" INTEGER,
  "rating_average" DECIMAL(3, 2),
  "review_count" INTEGER NOT NULL DEFAULT 0,
  "in_stock" BOOLEAN NOT NULL DEFAULT false,
  "has_deal" BOOLEAN NOT NULL DEFAULT false,
  "deal_discount_bps" INTEGER NOT NULL DEFAULT 0,
  "rank_boost" INTEGER NOT NULL DEFAULT 0,
  "visibility_status" "SearchDocumentVisibilityStatus" NOT NULL DEFAULT 'HIDDEN',
  "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("normalized_title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("normalized_subtitle", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("search_text", '')), 'C')
  ) STORED,
  "source_updated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_index_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "entity_type" "SearchDocumentEntityType" NOT NULL,
  "entity_id" UUID NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "status" "SearchIndexJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "search_index_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_entity_type_entity_id_key" ON "search_documents"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "search_documents_entity_type_visibility_status_updated_at_idx" ON "search_documents"("entity_type", "visibility_status", "updated_at");

-- CreateIndex
CREATE INDEX "search_documents_category_id_entity_type_visibility_status_idx" ON "search_documents"("category_id", "entity_type", "visibility_status");

-- CreateIndex
CREATE INDEX "search_documents_seller_id_entity_type_visibility_status_idx" ON "search_documents"("seller_id", "entity_type", "visibility_status");

-- CreateIndex
CREATE INDEX "search_documents_visibility_status_rank_boost_updated_at_idx" ON "search_documents"("visibility_status", "rank_boost", "updated_at");

-- CreateIndex
CREATE INDEX "idx_search_documents_visible_vector" ON "search_documents" USING GIN ("search_vector")
WHERE "visibility_status" = 'VISIBLE';

-- CreateIndex
CREATE INDEX "idx_search_documents_visible_title_trgm" ON "search_documents" USING GIN ("normalized_title" gin_trgm_ops)
WHERE "visibility_status" = 'VISIBLE';

-- CreateIndex
CREATE INDEX "idx_search_documents_visible_subtitle_trgm" ON "search_documents" USING GIN ("normalized_subtitle" gin_trgm_ops)
WHERE "visibility_status" = 'VISIBLE';

-- CreateIndex
CREATE INDEX "idx_search_documents_visible_search_text_trgm" ON "search_documents" USING GIN ("search_text" gin_trgm_ops)
WHERE "visibility_status" = 'VISIBLE';

-- CreateIndex
CREATE UNIQUE INDEX "search_index_jobs_dedupe_key_key" ON "search_index_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "search_index_jobs_status_available_at_created_at_idx" ON "search_index_jobs"("status", "available_at", "created_at");

-- CreateIndex
CREATE INDEX "search_index_jobs_entity_type_entity_id_idx" ON "search_index_jobs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "search_index_jobs_locked_at_idx" ON "search_index_jobs"("locked_at");
