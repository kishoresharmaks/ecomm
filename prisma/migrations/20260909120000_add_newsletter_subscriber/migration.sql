-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "source" VARCHAR(50) NOT NULL DEFAULT 'footer',
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_subscribed_at_idx" ON "newsletter_subscribers"("status", "subscribed_at");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_source_idx" ON "newsletter_subscribers"("source");
