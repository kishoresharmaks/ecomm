CREATE TYPE "SupportRequestTopic" AS ENUM (
  'ORDER',
  'PAYMENT',
  'DELIVERY',
  'SELLER',
  'B2B',
  'DOWNLOAD_APP',
  'GENERAL'
);

CREATE TYPE "SupportRequesterType" AS ENUM (
  'CUSTOMER',
  'SELLER',
  'BUSINESS_BUYER',
  'DELIVERY_PARTNER',
  'GUEST'
);

CREATE TYPE "SupportContactChannel" AS ENUM (
  'EMAIL',
  'PHONE',
  'WHATSAPP'
);

CREATE TYPE "SupportRequestSource" AS ENUM (
  'WEB_CONTACT',
  'WEB_ACCOUNT_SUPPORT',
  'WEB_SELLER_SUPPORT',
  'WEB_B2B_SUPPORT',
  'API',
  'MOBILE_APP'
);

ALTER TABLE "support_requests"
  ADD COLUMN "topic" "SupportRequestTopic" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "requester_type" "SupportRequesterType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "preferred_contact_channel" "SupportContactChannel" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "source" "SupportRequestSource" NOT NULL DEFAULT 'WEB_CONTACT',
  ADD COLUMN "order_number" TEXT,
  ADD COLUMN "response_message" TEXT,
  ADD COLUMN "responded_at" TIMESTAMP(3);

CREATE INDEX "support_requests_topic_status_idx" ON "support_requests"("topic", "status");
CREATE INDEX "support_requests_source_created_at_idx" ON "support_requests"("source", "created_at");
CREATE INDEX "support_requests_order_number_idx" ON "support_requests"("order_number");
