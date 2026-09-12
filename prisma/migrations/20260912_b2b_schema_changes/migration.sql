-- B2B Order-to-Cash V2 schema changes.
-- Generated from unapplied schema changes blocked by a broken prior migration.
-- Apply with: psql <connection-string> -f prisma/migrations/20260912_b2b_schema_changes/migration.sql

-- 1. Add CANCELLED to B2BPaymentStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CANCELLED'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'B2BPaymentStatus')
  ) THEN
    ALTER TYPE "B2BPaymentStatus" ADD VALUE 'CANCELLED';
  END IF;
END $$;

-- 2. Add CANCEL_ORDER and UPDATE_ORDER_STATUS to B2BAdminAction enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'CANCEL_ORDER'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'B2BAdminAction')
  ) THEN
    ALTER TYPE "B2BAdminAction" ADD VALUE 'CANCEL_ORDER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'UPDATE_ORDER_STATUS'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'B2BAdminAction')
  ) THEN
    ALTER TYPE "B2BAdminAction" ADD VALUE 'UPDATE_ORDER_STATUS';
  END IF;
END $$;

-- 3. Add composite unique index on B2BOrder(sellerId, taxInvoiceNumber)
-- Uses IF NOT EXISTS so re-running this migration is safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_orders_seller_tax_invoice
ON b2b_orders (seller_id, tax_invoice_number)
WHERE tax_invoice_number IS NOT NULL;

-- 4. Change BusinessBuyer.user FK from CASCADE to SET NULL
-- Drop old constraint and recreate with SET NULL.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'business_buyers'::regclass
    AND confrelid = 'users'::regclass
    AND contype = 'f'
    AND conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'business_buyers'::regclass AND attname = 'user_id')
    ]::smallint[]
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE business_buyers DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE business_buyers
    ADD CONSTRAINT business_buyers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  $inner$;
END $$;

-- 5. Change B2BOrder.businessBuyer FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_orders'::regclass
    AND confrelid = 'business_buyers'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_orders DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_orders
    ADD CONSTRAINT b2b_orders_business_buyer_id_fkey
    FOREIGN KEY (business_buyer_id) REFERENCES business_buyers(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 6. Change B2BPaymentProof.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_payment_proofs'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_payment_proofs DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_payment_proofs
    ADD CONSTRAINT b2b_payment_proofs_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 7. Change B2BOrderAmendment.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_order_amendments'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_order_amendments DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_order_amendments
    ADD CONSTRAINT b2b_order_amendments_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 8. Change B2BDisputeResolution.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_dispute_resolutions'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_dispute_resolutions DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_dispute_resolutions
    ADD CONSTRAINT b2b_dispute_resolutions_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;

-- 9. Change B2BFinancialReconciliation.order FK from CASCADE to RESTRICT
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'b2b_financial_reconciliations'::regclass
    AND confrelid = 'b2b_orders'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE b2b_financial_reconciliations DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE $inner$
    ALTER TABLE b2b_financial_reconciliations
    ADD CONSTRAINT b2b_financial_reconciliations_b2b_order_id_fkey
    FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE RESTRICT
  $inner$;
END $$;
