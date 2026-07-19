CREATE TABLE "delivery_push_tokens" (
    "id" UUID NOT NULL,
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

    CONSTRAINT "delivery_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_push_tokens_token_key" ON "delivery_push_tokens"("token");
CREATE INDEX "delivery_push_tokens_user_id_enabled_idx" ON "delivery_push_tokens"("user_id", "enabled");
CREATE INDEX "delivery_push_tokens_last_seen_at_idx" ON "delivery_push_tokens"("last_seen_at");

ALTER TABLE "delivery_push_tokens"
ADD CONSTRAINT "delivery_push_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
