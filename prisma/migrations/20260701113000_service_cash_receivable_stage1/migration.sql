DO $$
BEGIN
  CREATE TYPE "ServicePaymentCollectionType" AS ENUM ('PLATFORM_ONLINE', 'PLATFORM_OFFLINE', 'PROVIDER_CASH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServicePaymentSettlementTreatment" AS ENUM ('PAYOUT_ELIGIBLE', 'PLATFORM_RECEIVABLE', 'TRACK_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceCashCollectionStatus" AS ENUM (
    'NOT_APPLICABLE',
    'RECORDED',
    'CUSTOMER_CONFIRMED',
    'CUSTOMER_DISPUTED',
    'ADMIN_VERIFIED',
    'ADMIN_PARTIALLY_VERIFIED',
    'REJECTED',
    'REOPENED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceCashDisputeResolution" AS ENUM (
    'CUSTOMER_CONFIRMED',
    'ADMIN_FORCE_CONFIRMED',
    'PARTIALLY_ACCEPTED',
    'REJECTED',
    'REOPENED_FOR_EVIDENCE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceSellerReceivableStatus" AS ENUM (
    'PROVISIONAL',
    'OPEN',
    'PARTIALLY_SETTLED',
    'SETTLED',
    'WAIVER_REQUESTED',
    'WAIVED',
    'DISPUTED',
    'REVERSED',
    'OFFSET_SCHEDULED',
    'OFFSET_APPLIED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceSellerReceivableSource" AS ENUM (
    'PROVIDER_CASH_COLLECTION',
    'ADMIN_ADJUSTMENT',
    'REVERSAL',
    'PAYOUT_OFFSET'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceReceivableOffsetPolicy" AS ENUM (
    'MANUAL_ONLY',
    'AUTO_OFFSET_NEXT_PAYOUT',
    'HOLD_PAYOUT_UNTIL_SETTLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceReceivableTaxAccrualStatus" AS ENUM (
    'PROVISIONAL',
    'ACCRUED',
    'REVERSED',
    'NOT_APPLICABLE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ServiceReceivableWaiverApprovalStatus" AS ENUM (
    'NOT_REQUESTED',
    'PENDING',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "service_payments"
  ADD COLUMN IF NOT EXISTS "collection_type" "ServicePaymentCollectionType" NOT NULL DEFAULT 'PLATFORM_ONLINE',
  ADD COLUMN IF NOT EXISTS "settlement_treatment" "ServicePaymentSettlementTreatment" NOT NULL DEFAULT 'PAYOUT_ELIGIBLE',
  ADD COLUMN IF NOT EXISTS "cash_collection_status" "ServiceCashCollectionStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "cash_collection_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "attempt_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "cash_collected_by" UUID,
  ADD COLUMN IF NOT EXISTS "cash_collected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "customer_cash_confirmed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "admin_cash_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cash_disputed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cash_dispute_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cash_dispute_resolution" "ServiceCashDisputeResolution",
  ADD COLUMN IF NOT EXISTS "cash_resolution_note" TEXT;

CREATE TABLE IF NOT EXISTS "service_seller_receivables" (
  "id" UUID NOT NULL,
  "receivable_number" TEXT NOT NULL,
  "seller_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "service_payment_id" UUID,
  "payout_offset_id" UUID,
  "source" "ServiceSellerReceivableSource" NOT NULL,
  "status" "ServiceSellerReceivableStatus" NOT NULL DEFAULT 'PROVISIONAL',
  "offset_policy" "ServiceReceivableOffsetPolicy" NOT NULL DEFAULT 'MANUAL_ONLY',
  "tax_accrual_status" "ServiceReceivableTaxAccrualStatus" NOT NULL DEFAULT 'PROVISIONAL',
  "waiver_approval_status" "ServiceReceivableWaiverApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "gross_cash_collected_paise" INTEGER NOT NULL DEFAULT 0,
  "commission_paise" INTEGER NOT NULL DEFAULT 0,
  "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
  "tds_paise" INTEGER NOT NULL DEFAULT 0,
  "tcs_paise" INTEGER NOT NULL DEFAULT 0,
  "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
  "reversal_paise" INTEGER NOT NULL DEFAULT 0,
  "waived_paise" INTEGER NOT NULL DEFAULT 0,
  "settled_paise" INTEGER NOT NULL DEFAULT 0,
  "offset_paise" INTEGER NOT NULL DEFAULT 0,
  "amount_due_to_platform_paise" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "idempotency_key" TEXT,
  "cash_collection_event_id" TEXT,
  "provisional_until" TIMESTAMP(3),
  "verified_by" UUID,
  "verified_at" TIMESTAMP(3),
  "tax_accrued_at" TIMESTAMP(3),
  "tax_reversed_at" TIMESTAMP(3),
  "disputed_by" UUID,
  "disputed_at" TIMESTAMP(3),
  "dispute_reason" TEXT,
  "resolution" "ServiceCashDisputeResolution",
  "resolved_by" UUID,
  "resolved_at" TIMESTAMP(3),
  "resolution_note" TEXT,
  "waiver_requested_by" UUID,
  "waiver_requested_at" TIMESTAMP(3),
  "waiver_requested_paise" INTEGER NOT NULL DEFAULT 0,
  "waiver_approved_by" UUID,
  "waiver_approved_at" TIMESTAMP(3),
  "waiver_limit_paise" INTEGER,
  "waiver_reason" TEXT,
  "waived_at" TIMESTAMP(3),
  "offset_scheduled_at" TIMESTAMP(3),
  "offset_applied_at" TIMESTAMP(3),
  "note" TEXT,
  "finance_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_seller_receivables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "service_seller_receivable_events" (
  "id" UUID NOT NULL,
  "receivable_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "old_status" "ServiceSellerReceivableStatus",
  "new_status" "ServiceSellerReceivableStatus",
  "resolution" "ServiceCashDisputeResolution",
  "amount_delta_paise" INTEGER,
  "old_amount_due_paise" INTEGER,
  "new_amount_due_paise" INTEGER,
  "note" TEXT,
  "actor_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_seller_receivable_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_seller_receivables_receivable_number_key"
  ON "service_seller_receivables"("receivable_number");

CREATE UNIQUE INDEX IF NOT EXISTS "service_receivables_seller_booking_idempotency_key_key"
  ON "service_seller_receivables"("seller_id", "booking_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_seller_id_status_created_at_idx"
  ON "service_seller_receivables"("seller_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_booking_id_status_idx"
  ON "service_seller_receivables"("booking_id", "status");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_service_payment_id_idx"
  ON "service_seller_receivables"("service_payment_id");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_status_created_at_idx"
  ON "service_seller_receivables"("status", "created_at");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_payout_offset_id_status_idx"
  ON "service_seller_receivables"("payout_offset_id", "status");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_cash_collection_event_id_idx"
  ON "service_seller_receivables"("cash_collection_event_id");

CREATE INDEX IF NOT EXISTS "service_seller_receivables_source_created_at_idx"
  ON "service_seller_receivables"("source", "created_at");

CREATE INDEX IF NOT EXISTS "service_seller_receivable_events_receivable_id_idx"
  ON "service_seller_receivable_events"("receivable_id");

CREATE INDEX IF NOT EXISTS "service_seller_receivable_events_actor_user_id_idx"
  ON "service_seller_receivable_events"("actor_user_id");

CREATE INDEX IF NOT EXISTS "service_seller_receivable_events_created_at_idx"
  ON "service_seller_receivable_events"("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "service_payments_booking_seller_idempotency_key_key"
  ON "service_payments"("booking_id", "seller_id", "idempotency_key");

CREATE UNIQUE INDEX IF NOT EXISTS "service_payments_booking_seller_cash_event_key"
  ON "service_payments"("booking_id", "seller_id", "cash_collection_event_id");

CREATE INDEX IF NOT EXISTS "service_payments_collection_type_status_created_at_idx"
  ON "service_payments"("collection_type", "status", "created_at");

CREATE INDEX IF NOT EXISTS "service_payments_settlement_treatment_status_created_at_idx"
  ON "service_payments"("settlement_treatment", "status", "created_at");

CREATE INDEX IF NOT EXISTS "service_payments_cash_collection_status_created_at_idx"
  ON "service_payments"("cash_collection_status", "created_at");

CREATE INDEX IF NOT EXISTS "service_payments_cash_collected_by_created_at_idx"
  ON "service_payments"("cash_collected_by", "created_at");

DO $$
BEGIN
  ALTER TABLE "service_payments"
    ADD CONSTRAINT "service_payments_cash_collected_by_fkey"
    FOREIGN KEY ("cash_collected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_service_payment_id_fkey"
    FOREIGN KEY ("service_payment_id") REFERENCES "service_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_payout_offset_id_fkey"
    FOREIGN KEY ("payout_offset_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_verified_by_fkey"
    FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_disputed_by_fkey"
    FOREIGN KEY ("disputed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_resolved_by_fkey"
    FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_waiver_requested_by_fkey"
    FOREIGN KEY ("waiver_requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivables"
    ADD CONSTRAINT "service_seller_receivables_waiver_approved_by_fkey"
    FOREIGN KEY ("waiver_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivable_events"
    ADD CONSTRAINT "service_seller_receivable_events_receivable_id_fkey"
    FOREIGN KEY ("receivable_id") REFERENCES "service_seller_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_seller_receivable_events"
    ADD CONSTRAINT "service_seller_receivable_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
