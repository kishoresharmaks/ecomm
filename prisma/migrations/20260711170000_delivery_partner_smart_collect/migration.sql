ALTER TABLE "delivery_partner_profiles"
ADD COLUMN "deposit_wallet_balance_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "razorpay_customer_id" TEXT,
ADD COLUMN "razorpay_virtual_account_id" TEXT,
ADD COLUMN "razorpay_virtual_upi_id" TEXT,
ADD COLUMN "razorpay_virtual_account_provisioning_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "delivery_partner_profiles_razorpay_virtual_account_id_key"
ON "delivery_partner_profiles"("razorpay_virtual_account_id");
