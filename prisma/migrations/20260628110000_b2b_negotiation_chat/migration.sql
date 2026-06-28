ALTER TYPE "B2BEnquiryStatus" ADD VALUE IF NOT EXISTS 'NEGOTIATING';
ALTER TYPE "PushNotificationType" ADD VALUE IF NOT EXISTS 'B2B_ENQUIRY_MESSAGE';

CREATE TABLE IF NOT EXISTS "b2b_enquiry_messages" (
  "id" UUID NOT NULL,
  "enquiry_id" UUID NOT NULL,
  "sender_user_id" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "b2b_enquiry_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "b2b_enquiry_messages_enquiry_id_created_at_idx"
ON "b2b_enquiry_messages"("enquiry_id", "created_at");

CREATE INDEX IF NOT EXISTS "b2b_enquiry_messages_sender_user_id_idx"
ON "b2b_enquiry_messages"("sender_user_id");

ALTER TABLE "b2b_enquiry_messages"
ADD CONSTRAINT "b2b_enquiry_messages_enquiry_id_fkey"
FOREIGN KEY ("enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "b2b_enquiry_messages"
ADD CONSTRAINT "b2b_enquiry_messages_sender_user_id_fkey"
FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "b2b_orders"
ADD COLUMN IF NOT EXISTS "commission_rate_bps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "commission_amount_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "seller_payout_amount_paise" INTEGER NOT NULL DEFAULT 0;
