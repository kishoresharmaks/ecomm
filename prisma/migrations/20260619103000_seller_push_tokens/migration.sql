CREATE TABLE "seller_push_tokens" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
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

    CONSTRAINT "seller_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_push_tokens_token_key" ON "seller_push_tokens"("token");
CREATE INDEX "seller_push_tokens_seller_id_enabled_idx" ON "seller_push_tokens"("seller_id", "enabled");
CREATE INDEX "seller_push_tokens_user_id_enabled_idx" ON "seller_push_tokens"("user_id", "enabled");
CREATE INDEX "seller_push_tokens_last_seen_at_idx" ON "seller_push_tokens"("last_seen_at");

ALTER TABLE "seller_push_tokens"
ADD CONSTRAINT "seller_push_tokens_seller_id_fkey"
FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_push_tokens"
ADD CONSTRAINT "seller_push_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
