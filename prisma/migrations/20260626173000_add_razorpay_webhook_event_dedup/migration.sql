CREATE TABLE "RazorpayWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "payloadHash" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RazorpayWebhookEvent_provider_providerEventId_key"
ON "RazorpayWebhookEvent"("provider", "providerEventId");

CREATE INDEX "RazorpayWebhookEvent_provider_providerEventId_idx"
ON "RazorpayWebhookEvent"("provider", "providerEventId");
