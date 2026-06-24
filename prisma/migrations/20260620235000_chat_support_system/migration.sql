ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'CHAT_SUPPORT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatConversationStatus') THEN
    CREATE TYPE "ChatConversationStatus" AS ENUM ('OPEN', 'WAITING_FOR_STAFF', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatConversationPriority') THEN
    CREATE TYPE "ChatConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatConversationSensitivity') THEN
    CREATE TYPE "ChatConversationSensitivity" AS ENUM ('NORMAL', 'DISPUTE', 'FRAUD_REVIEW', 'LEGAL_HOLD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatRequesterType') THEN
    CREATE TYPE "ChatRequesterType" AS ENUM ('CUSTOMER', 'SELLER', 'BUSINESS_BUYER', 'DELIVERY_PARTNER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatMessageSenderType') THEN
    CREATE TYPE "ChatMessageSenderType" AS ENUM ('USER', 'BOT', 'SUPPORT_AGENT', 'ADMIN', 'SYSTEM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatMessageType') THEN
    CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'GUIDED_ACTION', 'STAFF_HANDOVER', 'INTERNAL_NOTE', 'SYSTEM_EVENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatEscalationReason') THEN
    CREATE TYPE "ChatEscalationReason" AS ENUM ('USER_REQUESTED_STAFF', 'BOT_UNCERTAIN', 'AI_UNAVAILABLE', 'RATE_LIMITED', 'SLA_RISK', 'SENSITIVE_TOPIC', 'ADMIN_ESCALATED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatAiRunStatus') THEN
    CREATE TYPE "ChatAiRunStatus" AS ENUM ('NOT_USED', 'SKIPPED', 'SUCCEEDED', 'FAILED', 'ESCALATED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatRateLimitAction') THEN
    CREATE TYPE "ChatRateLimitAction" AS ENUM ('MESSAGE_SEND', 'CONVERSATION_CREATE', 'AI_CALL', 'BOT_TURN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_to_user_id" UUID,
  "order_id" UUID,
  "product_id" UUID,
  "b2b_enquiry_id" UUID,
  "support_request_id" UUID,
  "requester_type" "ChatRequesterType" NOT NULL,
  "topic" "SupportRequestTopic" NOT NULL DEFAULT 'GENERAL',
  "subject" TEXT NOT NULL,
  "status" "ChatConversationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ChatConversationPriority" NOT NULL DEFAULT 'NORMAL',
  "sensitivity" "ChatConversationSensitivity" NOT NULL DEFAULT 'NORMAL',
  "escalation_reason" "ChatEscalationReason",
  "handover_requested_at" TIMESTAMP(3),
  "first_response_due_at" TIMESTAMP(3),
  "next_response_due_at" TIMESTAMP(3),
  "sla_breached_at" TIMESTAMP(3),
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_user_message_at" TIMESTAMP(3),
  "last_staff_message_at" TIMESTAMP(3),
  "user_unread_count" INTEGER NOT NULL DEFAULT 0,
  "staff_unread_count" INTEGER NOT NULL DEFAULT 0,
  "retention_until" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "sender_user_id" UUID,
  "sender_type" "ChatMessageSenderType" NOT NULL,
  "message_type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
  "body" TEXT NOT NULL,
  "visible_to_user" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "read_by_user_at" TIMESTAMP(3),
  "read_by_staff_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_assignments" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "assigned_to_id" UUID,
  "created_by_id" UUID,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_conversation_events" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "event_type" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_conversation_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_bot_runs" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID,
  "provider" TEXT,
  "model" TEXT,
  "prompt_version" TEXT,
  "source_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "ChatAiRunStatus" NOT NULL DEFAULT 'NOT_USED',
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "error_class" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_bot_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_rate_limit_buckets" (
  "id" UUID NOT NULL,
  "scope_key" TEXT NOT NULL,
  "action" "ChatRateLimitAction" NOT NULL,
  "bucket_key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_ai_usage_summaries" (
  "id" UUID NOT NULL,
  "user_id" TEXT NOT NULL,
  "usage_date" DATE NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'disabled',
  "model" TEXT NOT NULL DEFAULT 'none',
  "call_count" INTEGER NOT NULL DEFAULT 0,
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_ai_usage_summaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_conversations_user_id_last_message_at_idx" ON "chat_conversations"("user_id", "last_message_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_assigned_to_user_id_status_last_message_at_idx" ON "chat_conversations"("assigned_to_user_id", "status", "last_message_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_status_sensitivity_last_message_at_idx" ON "chat_conversations"("status", "sensitivity", "last_message_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_requester_type_status_last_message_at_idx" ON "chat_conversations"("requester_type", "status", "last_message_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_priority_status_last_message_at_idx" ON "chat_conversations"("priority", "status", "last_message_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_sensitivity_status_last_message_at_idx" ON "chat_conversations"("sensitivity", "status", "last_message_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_first_response_due_at_idx" ON "chat_conversations"("first_response_due_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_sla_breached_at_idx" ON "chat_conversations"("sla_breached_at");
CREATE INDEX IF NOT EXISTS "chat_conversations_order_id_idx" ON "chat_conversations"("order_id");
CREATE INDEX IF NOT EXISTS "chat_conversations_product_id_idx" ON "chat_conversations"("product_id");
CREATE INDEX IF NOT EXISTS "chat_conversations_b2b_enquiry_id_idx" ON "chat_conversations"("b2b_enquiry_id");
CREATE INDEX IF NOT EXISTS "chat_conversations_support_request_id_idx" ON "chat_conversations"("support_request_id");

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_messages_sender_user_id_created_at_idx" ON "chat_messages"("sender_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_messages_sender_type_created_at_idx" ON "chat_messages"("sender_type", "created_at");

CREATE INDEX IF NOT EXISTS "chat_assignments_conversation_id_created_at_idx" ON "chat_assignments"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_assignments_assigned_to_id_created_at_idx" ON "chat_assignments"("assigned_to_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_assignments_created_by_id_created_at_idx" ON "chat_assignments"("created_by_id", "created_at");

CREATE INDEX IF NOT EXISTS "chat_conversation_events_conversation_id_created_at_idx" ON "chat_conversation_events"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_conversation_events_actor_user_id_created_at_idx" ON "chat_conversation_events"("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_conversation_events_event_type_created_at_idx" ON "chat_conversation_events"("event_type", "created_at");

CREATE INDEX IF NOT EXISTS "chat_bot_runs_conversation_id_created_at_idx" ON "chat_bot_runs"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_bot_runs_user_id_created_at_idx" ON "chat_bot_runs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_bot_runs_status_created_at_idx" ON "chat_bot_runs"("status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "chat_rate_limit_buckets_scope_key_action_bucket_key_key" ON "chat_rate_limit_buckets"("scope_key", "action", "bucket_key");
CREATE INDEX IF NOT EXISTS "chat_rate_limit_buckets_action_expires_at_idx" ON "chat_rate_limit_buckets"("action", "expires_at");
CREATE INDEX IF NOT EXISTS "chat_rate_limit_buckets_expires_at_idx" ON "chat_rate_limit_buckets"("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "chat_ai_usage_summaries_user_id_usage_date_provider_model_key" ON "chat_ai_usage_summaries"("user_id", "usage_date", "provider", "model");
CREATE INDEX IF NOT EXISTS "chat_ai_usage_summaries_usage_date_idx" ON "chat_ai_usage_summaries"("usage_date");
CREATE INDEX IF NOT EXISTS "chat_ai_usage_summaries_user_id_usage_date_idx" ON "chat_ai_usage_summaries"("user_id", "usage_date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_user_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_assigned_to_user_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_order_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_product_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_b2b_enquiry_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_b2b_enquiry_id_fkey" FOREIGN KEY ("b2b_enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_support_request_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_support_request_id_fkey" FOREIGN KEY ("support_request_id") REFERENCES "support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_conversation_id_fkey') THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_sender_user_id_fkey') THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_assignments_conversation_id_fkey') THEN
    ALTER TABLE "chat_assignments" ADD CONSTRAINT "chat_assignments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_assignments_assigned_to_id_fkey') THEN
    ALTER TABLE "chat_assignments" ADD CONSTRAINT "chat_assignments_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_assignments_created_by_id_fkey') THEN
    ALTER TABLE "chat_assignments" ADD CONSTRAINT "chat_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversation_events_conversation_id_fkey') THEN
    ALTER TABLE "chat_conversation_events" ADD CONSTRAINT "chat_conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversation_events_actor_user_id_fkey') THEN
    ALTER TABLE "chat_conversation_events" ADD CONSTRAINT "chat_conversation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_bot_runs_conversation_id_fkey') THEN
    ALTER TABLE "chat_bot_runs" ADD CONSTRAINT "chat_bot_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_bot_runs_user_id_fkey') THEN
    ALTER TABLE "chat_bot_runs" ADD CONSTRAINT "chat_bot_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
