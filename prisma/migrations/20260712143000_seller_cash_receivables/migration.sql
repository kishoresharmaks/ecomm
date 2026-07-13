-- CreateEnum
CREATE TYPE "SellerCashReceivableSource" AS ENUM ('STORE_PICKUP_COD', 'MANUAL_TRANSPORT_COD');

-- CreateEnum
CREATE TYPE "SellerCashReceivableStatus" AS ENUM ('OPEN', 'PARTIALLY_OFFSET', 'OFFSET_SCHEDULED', 'SETTLED', 'WAIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SELLER_CASH_RECEIVABLE_OPENED';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SELLER_CASH_RECEIVABLE_OFFSET';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SELLER_CASH_RECEIVABLE_SETTLED';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE IF NOT EXISTS 'SELLER_CASH_RECEIVABLE_WAIVED';

-- AlterTable
ALTER TABLE "seller_ledger_entries"
  ADD COLUMN "seller_cash_receivable_id" UUID;

-- CreateTable
CREATE TABLE "seller_cash_receivables" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receivable_number" TEXT NOT NULL,
  "seller_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "order_seller_split_id" UUID NOT NULL,
  "order_shipment_id" UUID,
  "payment_id" UUID,
  "payout_offset_id" UUID,
  "source" "SellerCashReceivableSource" NOT NULL,
  "status" "SellerCashReceivableStatus" NOT NULL DEFAULT 'OPEN',
  "gross_cash_collected_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_due_paise" INTEGER NOT NULL DEFAULT 0,
  "offset_paise" INTEGER NOT NULL DEFAULT 0,
  "settled_paise" INTEGER NOT NULL DEFAULT 0,
  "waived_paise" INTEGER NOT NULL DEFAULT 0,
  "outstanding_paise" INTEGER NOT NULL DEFAULT 0,
  "commission_paise" INTEGER NOT NULL DEFAULT 0,
  "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
  "tds_paise" INTEGER NOT NULL DEFAULT 0,
  "tcs_paise" INTEGER NOT NULL DEFAULT 0,
  "seller_platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
  "buyer_platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "idempotency_key" TEXT NOT NULL,
  "note" TEXT,
  "finance_snapshot" JSONB,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "offset_scheduled_at" TIMESTAMP(3),
  "offset_applied_at" TIMESTAMP(3),
  "settled_at" TIMESTAMP(3),
  "settled_by" UUID,
  "waived_at" TIMESTAMP(3),
  "waived_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seller_cash_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_cash_receivable_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receivable_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "old_status" "SellerCashReceivableStatus",
  "new_status" "SellerCashReceivableStatus",
  "amount_delta_paise" INTEGER,
  "old_outstanding_paise" INTEGER,
  "new_outstanding_paise" INTEGER,
  "note" TEXT,
  "actor_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_cash_receivable_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_receivable_number_key"
  ON "seller_cash_receivables"("receivable_number");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_order_shipment_id_key"
  ON "seller_cash_receivables"("order_shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_order_seller_split_id_source_key"
  ON "seller_cash_receivables"("order_seller_split_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_seller_split_idempotency_key_key"
  ON "seller_cash_receivables"("seller_id", "order_seller_split_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_seller_id_status_created_at_idx"
  ON "seller_cash_receivables"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_order_id_status_idx"
  ON "seller_cash_receivables"("order_id", "status");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_order_seller_split_id_idx"
  ON "seller_cash_receivables"("order_seller_split_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_payment_id_idx"
  ON "seller_cash_receivables"("payment_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_payout_offset_id_status_idx"
  ON "seller_cash_receivables"("payout_offset_id", "status");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_source_created_at_idx"
  ON "seller_cash_receivables"("source", "created_at");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_settled_by_idx"
  ON "seller_cash_receivables"("settled_by");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_waived_by_idx"
  ON "seller_cash_receivables"("waived_by");

-- CreateIndex
CREATE INDEX "seller_cash_receivable_events_receivable_id_idx"
  ON "seller_cash_receivable_events"("receivable_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivable_events_actor_user_id_idx"
  ON "seller_cash_receivable_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivable_events_created_at_idx"
  ON "seller_cash_receivable_events"("created_at");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_seller_cash_receivable_id_idx"
  ON "seller_ledger_entries"("seller_cash_receivable_id");

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_order_seller_split_id_fkey"
  FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_order_shipment_id_fkey"
  FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_payout_offset_id_fkey"
  FOREIGN KEY ("payout_offset_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_settled_by_fkey"
  FOREIGN KEY ("settled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables"
  ADD CONSTRAINT "seller_cash_receivables_waived_by_fkey"
  FOREIGN KEY ("waived_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivable_events"
  ADD CONSTRAINT "seller_cash_receivable_events_receivable_id_fkey"
  FOREIGN KEY ("receivable_id") REFERENCES "seller_cash_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivable_events"
  ADD CONSTRAINT "seller_cash_receivable_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries"
  ADD CONSTRAINT "seller_ledger_entries_seller_cash_receivable_id_fkey"
  FOREIGN KEY ("seller_cash_receivable_id") REFERENCES "seller_cash_receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
