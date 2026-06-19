CREATE TYPE "PushNotificationType" AS ENUM (
  'DEAL_PUBLISHED',
  'ORDER_PLACED',
  'ORDER_DELIVERED',
  'CAMPAIGN'
);

CREATE TYPE "PushNotificationCampaignStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'CANCELLED'
);

CREATE TYPE "PushNotificationBatchStatus" AS ENUM (
  'PENDING',
  'CLAIMED',
  'DONE'
);

CREATE TYPE "PushNotificationReceiptStatus" AS ENUM (
  'PENDING',
  'CHECKED',
  'FAILED',
  'SKIPPED'
);

ALTER TABLE "customers"
ADD COLUMN "deal_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "marketing_campaigns_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "customer_push_tokens" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "device_id" TEXT,
  "app_version" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_notifications" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "type" "PushNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image_url" TEXT,
  "href" TEXT,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "metadata" JSONB,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_notification_campaigns" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image_asset_key" TEXT,
  "image_url" TEXT,
  "href" TEXT,
  "segment_filter" JSONB NOT NULL,
  "status" "PushNotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "preview_count" INTEGER NOT NULL DEFAULT 0,
  "targeted_count" INTEGER NOT NULL DEFAULT 0,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "revoked_count" INTEGER NOT NULL DEFAULT 0,
  "scheduled_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_notification_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_notification_campaign_batches" (
  "id" UUID NOT NULL,
  "campaign_id" UUID NOT NULL,
  "status" "PushNotificationBatchStatus" NOT NULL DEFAULT 'PENDING',
  "recipient_token_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "ticket_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ticket_errors" JSONB,
  "claimed_by" TEXT,
  "claimed_at" TIMESTAMP(3),
  "done_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_notification_campaign_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_notification_receipts" (
  "id" UUID NOT NULL,
  "notification_log_id" UUID NOT NULL,
  "customer_push_token_id" UUID,
  "campaign_batch_id" UUID,
  "ticket_id" TEXT,
  "receipt_id" TEXT,
  "status" "PushNotificationReceiptStatus" NOT NULL DEFAULT 'PENDING',
  "provider_status" TEXT,
  "provider_details" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "check_after" TIMESTAMP(3),
  "checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_notification_receipts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notification_logs"
ADD COLUMN "customer_notification_id" UUID,
ADD COLUMN "customer_push_token_id" UUID,
ADD COLUMN "push_campaign_batch_id" UUID;

CREATE UNIQUE INDEX "customer_push_tokens_token_key" ON "customer_push_tokens"("token");
CREATE INDEX "customer_push_tokens_customer_id_enabled_idx" ON "customer_push_tokens"("customer_id", "enabled");
CREATE INDEX "customer_push_tokens_user_id_enabled_idx" ON "customer_push_tokens"("user_id", "enabled");
CREATE INDEX "customer_push_tokens_last_seen_at_idx" ON "customer_push_tokens"("last_seen_at");
CREATE UNIQUE INDEX "customer_notifications_customer_id_type_source_type_source_id_key" ON "customer_notifications"("customer_id", "type", "source_type", "source_id");
CREATE INDEX "customer_notifications_customer_id_read_at_created_at_idx" ON "customer_notifications"("customer_id", "read_at", "created_at");
CREATE INDEX "customer_notifications_customer_id_created_at_idx" ON "customer_notifications"("customer_id", "created_at");
CREATE INDEX "customer_notifications_type_created_at_idx" ON "customer_notifications"("type", "created_at");
CREATE INDEX "customer_notifications_source_type_source_id_idx" ON "customer_notifications"("source_type", "source_id");
CREATE INDEX "push_notification_campaigns_status_scheduled_at_idx" ON "push_notification_campaigns"("status", "scheduled_at");
CREATE INDEX "push_notification_campaigns_created_at_idx" ON "push_notification_campaigns"("created_at");
CREATE INDEX "push_notification_campaigns_created_by_id_idx" ON "push_notification_campaigns"("created_by_id");
CREATE INDEX "push_notification_campaign_batches_campaign_id_status_idx" ON "push_notification_campaign_batches"("campaign_id", "status");
CREATE INDEX "push_notification_campaign_batches_status_claimed_at_idx" ON "push_notification_campaign_batches"("status", "claimed_at");
CREATE INDEX "push_notification_campaign_batches_created_at_idx" ON "push_notification_campaign_batches"("created_at");
CREATE UNIQUE INDEX "push_notification_receipts_notification_log_id_key" ON "push_notification_receipts"("notification_log_id");
CREATE INDEX "push_notification_receipts_status_check_after_idx" ON "push_notification_receipts"("status", "check_after");
CREATE INDEX "push_notification_receipts_ticket_id_idx" ON "push_notification_receipts"("ticket_id");
CREATE INDEX "push_notification_receipts_customer_push_token_id_idx" ON "push_notification_receipts"("customer_push_token_id");
CREATE INDEX "push_notification_receipts_campaign_batch_id_idx" ON "push_notification_receipts"("campaign_batch_id");
CREATE INDEX "notification_logs_customer_notification_id_idx" ON "notification_logs"("customer_notification_id");
CREATE INDEX "notification_logs_customer_push_token_id_idx" ON "notification_logs"("customer_push_token_id");
CREATE INDEX "notification_logs_push_campaign_batch_id_idx" ON "notification_logs"("push_campaign_batch_id");
CREATE INDEX "customers_deal_alerts_enabled_idx" ON "customers"("deal_alerts_enabled");
CREATE INDEX "customers_marketing_campaigns_enabled_idx" ON "customers"("marketing_campaigns_enabled");

ALTER TABLE "customer_push_tokens"
ADD CONSTRAINT "customer_push_tokens_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_push_tokens"
ADD CONSTRAINT "customer_push_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_notifications"
ADD CONSTRAINT "customer_notifications_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_notification_campaigns"
ADD CONSTRAINT "push_notification_campaigns_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_notification_campaigns"
ADD CONSTRAINT "push_notification_campaigns_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_notification_campaign_batches"
ADD CONSTRAINT "push_notification_campaign_batches_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "push_notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
ADD CONSTRAINT "notification_logs_customer_notification_id_fkey"
FOREIGN KEY ("customer_notification_id") REFERENCES "customer_notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
ADD CONSTRAINT "notification_logs_customer_push_token_id_fkey"
FOREIGN KEY ("customer_push_token_id") REFERENCES "customer_push_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
ADD CONSTRAINT "notification_logs_push_campaign_batch_id_fkey"
FOREIGN KEY ("push_campaign_batch_id") REFERENCES "push_notification_campaign_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_notification_receipts"
ADD CONSTRAINT "push_notification_receipts_notification_log_id_fkey"
FOREIGN KEY ("notification_log_id") REFERENCES "notification_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_notification_receipts"
ADD CONSTRAINT "push_notification_receipts_customer_push_token_id_fkey"
FOREIGN KEY ("customer_push_token_id") REFERENCES "customer_push_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_notification_receipts"
ADD CONSTRAINT "push_notification_receipts_campaign_batch_id_fkey"
FOREIGN KEY ("campaign_batch_id") REFERENCES "push_notification_campaign_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
