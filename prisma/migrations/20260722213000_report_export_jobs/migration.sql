CREATE TYPE "ReportExportAudience" AS ENUM ('ADMIN', 'FINANCE', 'SELLER');

CREATE TYPE "ReportExportStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TYPE "ReportExportType" AS ENUM (
  'ADMIN_SALES',
  'ADMIN_SELLERS',
  'ADMIN_PRODUCTS',
  'ADMIN_ENQUIRIES',
  'FINANCE_PAYMENTS',
  'FINANCE_COD_COLLECTIONS',
  'FINANCE_ORDER_SETTLEMENTS',
  'FINANCE_SERVICE_SETTLEMENTS',
  'FINANCE_PAYOUTS',
  'FINANCE_SERVICE_RECEIVABLES',
  'SELLER_SALES',
  'SELLER_INVENTORY',
  'SELLER_FINANCE',
  'SELLER_TAX',
  'SELLER_RETURNS'
);

CREATE TABLE "report_export_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "audience" "ReportExportAudience" NOT NULL,
  "export_type" "ReportExportType" NOT NULL,
  "status" "ReportExportStatus" NOT NULL DEFAULT 'PENDING',
  "actor_user_id" UUID NOT NULL,
  "seller_id" UUID,
  "filters" JSONB NOT NULL,
  "file_name" TEXT,
  "content_type" TEXT,
  "storage_key" TEXT,
  "sha256" TEXT,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "byte_size" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "error_message" TEXT,
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "report_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_export_jobs_status_available_at_idx"
  ON "report_export_jobs"("status", "available_at");

CREATE INDEX "report_export_jobs_audience_created_at_idx"
  ON "report_export_jobs"("audience", "created_at");

CREATE INDEX "report_export_jobs_actor_user_id_created_at_idx"
  ON "report_export_jobs"("actor_user_id", "created_at");

CREATE INDEX "report_export_jobs_seller_id_created_at_idx"
  ON "report_export_jobs"("seller_id", "created_at");

CREATE INDEX "report_export_jobs_expires_at_status_idx"
  ON "report_export_jobs"("expires_at", "status");

ALTER TABLE "report_export_jobs"
  ADD CONSTRAINT "report_export_jobs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_export_jobs"
  ADD CONSTRAINT "report_export_jobs_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
