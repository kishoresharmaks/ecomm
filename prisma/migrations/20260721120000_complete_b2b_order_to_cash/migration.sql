-- Complete B2B order-to-cash V2.
-- Additive migration only. Test on a disposable PostgreSQL database before deployment.

ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PO_UNDER_REVIEW';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'CREDIT_CLEARANCE_PENDING';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PROCUREMENT_IN_PROGRESS';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PRODUCTION_IN_PROGRESS';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'STOCK_READY';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PACKING';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'QC_PENDING';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PACKED_AND_QC_PASSED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'TAX_INVOICE_ISSUED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'E_WAY_READY';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'E_WAY_NOT_REQUIRED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_ACCEPTED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_DISPUTED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_OVERDUE';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'FULFILMENT_REVIEW_REQUIRED';
ALTER TYPE "B2BOrderStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "B2BPaymentMethod" ADD VALUE IF NOT EXISTS 'UPI';
ALTER TYPE "B2BPaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';
-- CreateEnum
CREATE TYPE "B2BPoReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUIRED');

-- CreateEnum
CREATE TYPE "B2BPaymentTermType" AS ENUM ('PREPAID_FULL', 'ADVANCE_PERCENT', 'MILESTONE', 'NET_7', 'NET_15', 'NET_30', 'NET_45');

-- CreateEnum
CREATE TYPE "B2BCreditDecisionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'HELD', 'REJECTED', 'OVERRIDDEN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "B2BPaymentScheduleStatus" AS ENUM ('PENDING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BFulfilmentSource" AS ENUM ('AVAILABLE_STOCK', 'PROCURE', 'PRODUCE');

-- CreateEnum
CREATE TYPE "B2BFulfilmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BInventoryReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BProcurementStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BProductionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BWarehouseTaskType" AS ENUM ('PICK', 'PACK');

-- CreateEnum
CREATE TYPE "B2BWarehouseTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BQcStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'HELD');

-- CreateEnum
CREATE TYPE "B2BShipmentStatus" AS ENUM ('DRAFT', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BDeliveryAcceptanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISPUTED', 'AUTO_ACCEPTED');

-- CreateEnum
CREATE TYPE "B2BReceivableStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED', 'WRITTEN_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BAgeingBucket" AS ENUM ('CURRENT', 'DAYS_1_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90_PLUS');

-- CreateEnum
CREATE TYPE "B2BPaymentRecordStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'CLEARED', 'BOUNCED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "B2BCollectionTaskStatus" AS ENUM ('OPEN', 'PROMISED', 'PAID', 'ESCALATED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BSupportCaseType" AS ENUM ('WARRANTY', 'SHORTAGE', 'DAMAGE', 'REPLACEMENT', 'RETURN', 'BILLING', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "B2BSupportCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BErpConnectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "B2BIntegrationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BErpExportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "B2BErpExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "SellerStaffPermission" AS ENUM ('B2B_SALES', 'B2B_PROCUREMENT', 'B2B_PRODUCTION', 'B2B_WAREHOUSE', 'B2B_DISPATCH', 'B2B_FINANCE_VIEW');

ALTER TABLE "b2b_orders"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "payment_term_type" "B2BPaymentTermType" NOT NULL DEFAULT 'PREPAID_FULL',
  ADD COLUMN "legacy_migration_review_required" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "seller_staff_memberships" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permissions" "SellerStaffPermission"[] DEFAULT ARRAY[]::"SellerStaffPermission"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_staff_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_enquiry_lines" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "target_price_paise" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_enquiry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_quotation_lines" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "enquiry_line_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,
    "subtotal_paise" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_order_lines" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "hsn_sac_code" TEXT,
    "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "quantity" INTEGER NOT NULL,
    "uqc" TEXT NOT NULL DEFAULT 'NOS',
    "unit_price_paise" INTEGER NOT NULL,
    "gross_value_paise" INTEGER NOT NULL,
    "discount_paise" INTEGER NOT NULL DEFAULT 0,
    "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_rate_percent" DECIMAL(5,2),
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "cess_paise" INTEGER NOT NULL DEFAULT 0,
    "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
    "line_value_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_po_reviews" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "status" "B2BPoReviewStatus" NOT NULL DEFAULT 'PENDING',
    "document_matched" BOOLEAN NOT NULL DEFAULT false,
    "price_matched" BOOLEAN NOT NULL DEFAULT false,
    "quantity_matched" BOOLEAN NOT NULL DEFAULT false,
    "delivery_terms_matched" BOOLEAN NOT NULL DEFAULT false,
    "stock_checked" BOOLEAN NOT NULL DEFAULT false,
    "tax_data_checked" BOOLEAN NOT NULL DEFAULT false,
    "credit_checked" BOOLEAN NOT NULL DEFAULT false,
    "exception_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_po_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_buyer_credit_profiles" (
    "id" UUID NOT NULL,
    "business_buyer_id" UUID NOT NULL,
    "credit_limit_paise" INTEGER NOT NULL DEFAULT 0,
    "current_exposure_paise" INTEGER NOT NULL DEFAULT 0,
    "allowed_terms" "B2BPaymentTermType"[] DEFAULT ARRAY['PREPAID_FULL']::"B2BPaymentTermType"[],
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "hold_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_buyer_credit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_credit_decisions" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "status" "B2BCreditDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "payment_term_type" "B2BPaymentTermType" NOT NULL,
    "requested_amount_paise" INTEGER NOT NULL,
    "approved_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "exposure_before_paise" INTEGER NOT NULL DEFAULT 0,
    "available_credit_paise" INTEGER NOT NULL DEFAULT 0,
    "due_days" INTEGER NOT NULL DEFAULT 0,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "override_expires_at" TIMESTAMP(3),
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_credit_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_payment_schedules" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "payment_term_type" "B2BPaymentTermType" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "paid_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMP(3) NOT NULL,
    "fulfilment_gate" BOOLEAN NOT NULL DEFAULT false,
    "dispatch_gate" BOOLEAN NOT NULL DEFAULT false,
    "status" "B2BPaymentScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_inventory_reservations" (
    "id" UUID NOT NULL,
    "b2b_order_line_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "B2BInventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,

    CONSTRAINT "b2b_inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_fulfilment_plans" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "b2b_order_line_id" UUID NOT NULL,
    "source" "B2BFulfilmentSource" NOT NULL,
    "status" "B2BFulfilmentStatus" NOT NULL DEFAULT 'PENDING',
    "planned_quantity" INTEGER NOT NULL,
    "ready_quantity" INTEGER NOT NULL DEFAULT 0,
    "expected_ready_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_fulfilment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_procurement_orders" (
    "id" UUID NOT NULL,
    "procurement_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "fulfilment_plan_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "supplier_name" TEXT,
    "supplier_reference" TEXT,
    "ordered_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "rejected_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "B2BProcurementStatus" NOT NULL DEFAULT 'DRAFT',
    "expected_at" TIMESTAMP(3),
    "ordered_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_procurement_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_production_jobs" (
    "id" UUID NOT NULL,
    "production_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "fulfilment_plan_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "planned_quantity" INTEGER NOT NULL,
    "completed_quantity" INTEGER NOT NULL DEFAULT 0,
    "rejected_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "B2BProductionStatus" NOT NULL DEFAULT 'PLANNED',
    "expected_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "material_notes" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_production_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_warehouse_tasks" (
    "id" UUID NOT NULL,
    "task_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "task_type" "B2BWarehouseTaskType" NOT NULL,
    "status" "B2BWarehouseTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to_user_id" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_warehouse_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_warehouse_task_items" (
    "id" UUID NOT NULL,
    "warehouse_task_id" UUID NOT NULL,
    "b2b_order_line_id" UUID NOT NULL,
    "requested_quantity" INTEGER NOT NULL,
    "completed_quantity" INTEGER NOT NULL DEFAULT 0,
    "exception_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_warehouse_task_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_packages" (
    "id" UUID NOT NULL,
    "package_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "shipment_id" UUID,
    "sequence" INTEGER NOT NULL,
    "weight_grams" INTEGER,
    "length_cm" INTEGER,
    "breadth_cm" INTEGER,
    "height_cm" INTEGER,
    "declared_value_paise" INTEGER NOT NULL DEFAULT 0,
    "item_allocations" JSONB NOT NULL,
    "sealed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_qc_inspections" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "package_id" UUID,
    "status" "B2BQcStatus" NOT NULL DEFAULT 'PENDING',
    "checklist_snapshot" JSONB NOT NULL,
    "evidence_file_keys" JSONB,
    "failure_reason" TEXT,
    "inspected_by_id" UUID,
    "inspected_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_qc_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_shipments" (
    "id" UUID NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "assigned_delivery_user_id" UUID,
    "status" "B2BShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "acceptance_status" "B2BDeliveryAcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "transporter_name" TEXT,
    "transporter_gstin" TEXT,
    "lr_number" TEXT,
    "awb_number" TEXT,
    "vehicle_number" TEXT,
    "delivery_address_snapshot" JSONB NOT NULL,
    "dispatched_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "acceptance_due_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "dispute_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_shipment_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "B2BShipmentStatus" NOT NULL,
    "note" TEXT,
    "location" TEXT,
    "payload" JSONB,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_proofs_of_delivery" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "receiver_name" TEXT NOT NULL,
    "receiver_phone" TEXT,
    "delivered_at" TIMESTAMP(3) NOT NULL,
    "proof_file_keys" JSONB NOT NULL,
    "signature_file_key" TEXT,
    "note" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_proofs_of_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_receivables" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "tax_document_id" UUID,
    "original_amount_paise" INTEGER NOT NULL,
    "outstanding_amount_paise" INTEGER NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "B2BReceivableStatus" NOT NULL DEFAULT 'OPEN',
    "ageing_bucket" "B2BAgeingBucket" NOT NULL DEFAULT 'CURRENT',
    "disputed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_receivable_entries" (
    "id" UUID NOT NULL,
    "receivable_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debit_paise" INTEGER NOT NULL DEFAULT 0,
    "credit_paise" INTEGER NOT NULL DEFAULT 0,
    "balance_after_paise" INTEGER NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_receivable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_payment_records" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "legacy_proof_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "requested_schedule_id" UUID,
    "method" "B2BPaymentMethod" NOT NULL,
    "status" "B2BPaymentRecordStatus" NOT NULL DEFAULT 'SUBMITTED',
    "amount_paise" INTEGER NOT NULL,
    "unallocated_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reference_number" TEXT,
    "proof_file_key" TEXT,
    "provider_order_id" TEXT,
    "provider_payment_id" TEXT,
    "provider_order_creation_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "provider_order_created_at" TIMESTAMP(3),
    "provider_method" TEXT,
    "provider_payload" JSONB,
    "cheque_number" TEXT,
    "cheque_bank_name" TEXT,
    "cheque_date" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_payment_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "b2b_payment_records"
  ADD CONSTRAINT "b2b_payment_records_amount_positive"
  CHECK ("amount_paise" > 0);

ALTER TABLE "b2b_payment_records"
  ADD CONSTRAINT "b2b_payment_records_unallocated_valid"
  CHECK ("unallocated_amount_paise" >= 0 AND "unallocated_amount_paise" <= "amount_paise");

-- CreateTable
CREATE TABLE "b2b_payment_allocations" (
    "id" UUID NOT NULL,
    "payment_record_id" UUID NOT NULL,
    "payment_schedule_id" UUID,
    "receivable_id" UUID,
    "amount_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_receipt_vouchers" (
    "id" UUID NOT NULL,
    "voucher_number" TEXT NOT NULL,
    "payment_record_id" UUID NOT NULL,
    "file_key" TEXT,
    "issued_by_id" UUID,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_receipt_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_collection_tasks" (
    "id" UUID NOT NULL,
    "receivable_id" UUID NOT NULL,
    "status" "B2BCollectionTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_user_id" UUID,
    "due_at" TIMESTAMP(3) NOT NULL,
    "promise_to_pay_at" TIMESTAMP(3),
    "last_reminder_at" TIMESTAMP(3),
    "next_reminder_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_collection_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_support_cases" (
    "id" UUID NOT NULL,
    "case_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "b2b_order_line_id" UUID,
    "shipment_id" UUID,
    "tax_document_id" UUID,
    "receivable_id" UUID,
    "payment_record_id" UUID,
    "case_type" "B2BSupportCaseType" NOT NULL,
    "status" "B2BSupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_file_keys" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "assigned_to_user_id" UUID,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_erp_connections" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "B2BErpConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "base_url" TEXT NOT NULL,
    "encrypted_auth_config" TEXT NOT NULL,
    "encrypted_signing_secret" TEXT NOT NULL,
    "subscribed_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_verified_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_erp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_integration_outbox" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "connection_id" UUID,
    "b2b_order_id" UUID,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "B2BIntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "claimed_by" TEXT,
    "response_code" INTEGER,
    "response_body" TEXT,
    "delivered_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_integration_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_erp_export_jobs" (
    "id" UUID NOT NULL,
    "export_number" TEXT NOT NULL,
    "export_type" TEXT NOT NULL DEFAULT 'ORDERS',
    "format" "B2BErpExportFormat" NOT NULL,
    "status" "B2BErpExportStatus" NOT NULL DEFAULT 'PROCESSING',
    "filters" JSONB,
    "file_name" TEXT,
    "content_type" TEXT,
    "content" BYTEA,
    "content_hash" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_by_id" UUID,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_erp_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_mutation_records" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "b2b_order_id" UUID,
    "scope" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_mutation_records_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "seller_staff_memberships_seller_id_is_active_idx" ON "seller_staff_memberships"("seller_id", "is_active");

-- CreateIndex
CREATE INDEX "seller_staff_memberships_user_id_is_active_idx" ON "seller_staff_memberships"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "seller_staff_memberships_permissions_idx" ON "seller_staff_memberships" USING GIN ("permissions");

-- CreateIndex
CREATE UNIQUE INDEX "seller_staff_memberships_seller_id_user_id_key" ON "seller_staff_memberships"("seller_id", "user_id");

-- CreateIndex
CREATE INDEX "b2b_enquiry_lines_enquiry_id_created_at_idx" ON "b2b_enquiry_lines"("enquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_enquiry_lines_product_id_idx" ON "b2b_enquiry_lines"("product_id");

-- CreateIndex
CREATE INDEX "b2b_enquiry_lines_product_variant_id_idx" ON "b2b_enquiry_lines"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_enquiry_lines_enquiry_id_line_number_key" ON "b2b_enquiry_lines"("enquiry_id", "line_number");

-- CreateIndex
CREATE INDEX "b2b_quotation_lines_response_id_idx" ON "b2b_quotation_lines"("response_id");

-- CreateIndex
CREATE INDEX "b2b_quotation_lines_enquiry_line_id_idx" ON "b2b_quotation_lines"("enquiry_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_quotation_lines_response_id_enquiry_line_id_key" ON "b2b_quotation_lines"("response_id", "enquiry_line_id");

-- CreateIndex
CREATE INDEX "b2b_order_lines_b2b_order_id_created_at_idx" ON "b2b_order_lines"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_order_lines_product_id_idx" ON "b2b_order_lines"("product_id");

-- CreateIndex
CREATE INDEX "b2b_order_lines_product_variant_id_idx" ON "b2b_order_lines"("product_variant_id");

-- CreateIndex
CREATE INDEX "b2b_order_lines_tax_classification_created_at_idx" ON "b2b_order_lines"("tax_classification", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_order_lines_b2b_order_id_line_number_key" ON "b2b_order_lines"("b2b_order_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_po_reviews_b2b_order_id_key" ON "b2b_po_reviews"("b2b_order_id");

-- CreateIndex
CREATE INDEX "b2b_po_reviews_status_created_at_idx" ON "b2b_po_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_po_reviews_reviewed_by_id_idx" ON "b2b_po_reviews"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_buyer_credit_profiles_business_buyer_id_key" ON "business_buyer_credit_profiles"("business_buyer_id");

-- CreateIndex
CREATE INDEX "business_buyer_credit_profiles_is_active_updated_at_idx" ON "business_buyer_credit_profiles"("is_active", "updated_at");

-- CreateIndex
CREATE INDEX "business_buyer_credit_profiles_reviewed_by_id_idx" ON "business_buyer_credit_profiles"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "b2b_credit_decisions_b2b_order_id_is_current_created_at_idx" ON "b2b_credit_decisions"("b2b_order_id", "is_current", "created_at");

-- CreateIndex
CREATE INDEX "b2b_credit_decisions_status_created_at_idx" ON "b2b_credit_decisions"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_credit_decisions_decided_by_id_idx" ON "b2b_credit_decisions"("decided_by_id");

-- CreateIndex
CREATE INDEX "b2b_payment_schedules_b2b_order_id_status_due_at_idx" ON "b2b_payment_schedules"("b2b_order_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "b2b_payment_schedules_status_due_at_idx" ON "b2b_payment_schedules"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_payment_schedules_b2b_order_id_installment_number_key" ON "b2b_payment_schedules"("b2b_order_id", "installment_number");

-- CreateIndex
CREATE INDEX "b2b_inventory_reservations_b2b_order_line_id_status_idx" ON "b2b_inventory_reservations"("b2b_order_line_id", "status");

-- CreateIndex
CREATE INDEX "b2b_inventory_reservations_product_variant_id_status_idx" ON "b2b_inventory_reservations"("product_variant_id", "status");

-- CreateIndex
CREATE INDEX "b2b_inventory_reservations_status_reserved_at_idx" ON "b2b_inventory_reservations"("status", "reserved_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_fulfilment_plans_b2b_order_line_id_key" ON "b2b_fulfilment_plans"("b2b_order_line_id");

-- CreateIndex
CREATE INDEX "b2b_fulfilment_plans_b2b_order_id_status_idx" ON "b2b_fulfilment_plans"("b2b_order_id", "status");

-- CreateIndex
CREATE INDEX "b2b_fulfilment_plans_source_status_expected_ready_at_idx" ON "b2b_fulfilment_plans"("source", "status", "expected_ready_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_procurement_orders_procurement_number_key" ON "b2b_procurement_orders"("procurement_number");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_procurement_orders_fulfilment_plan_id_key" ON "b2b_procurement_orders"("fulfilment_plan_id");

-- CreateIndex
CREATE INDEX "b2b_procurement_orders_b2b_order_id_status_idx" ON "b2b_procurement_orders"("b2b_order_id", "status");

-- CreateIndex
CREATE INDEX "b2b_procurement_orders_seller_id_status_expected_at_idx" ON "b2b_procurement_orders"("seller_id", "status", "expected_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_production_jobs_production_number_key" ON "b2b_production_jobs"("production_number");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_production_jobs_fulfilment_plan_id_key" ON "b2b_production_jobs"("fulfilment_plan_id");

-- CreateIndex
CREATE INDEX "b2b_production_jobs_b2b_order_id_status_idx" ON "b2b_production_jobs"("b2b_order_id", "status");

-- CreateIndex
CREATE INDEX "b2b_production_jobs_seller_id_status_expected_at_idx" ON "b2b_production_jobs"("seller_id", "status", "expected_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_warehouse_tasks_task_number_key" ON "b2b_warehouse_tasks"("task_number");

-- CreateIndex
CREATE INDEX "b2b_warehouse_tasks_b2b_order_id_task_type_status_idx" ON "b2b_warehouse_tasks"("b2b_order_id", "task_type", "status");

-- CreateIndex
CREATE INDEX "b2b_warehouse_tasks_seller_id_status_created_at_idx" ON "b2b_warehouse_tasks"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_warehouse_tasks_assigned_to_user_id_status_idx" ON "b2b_warehouse_tasks"("assigned_to_user_id", "status");

-- CreateIndex
CREATE INDEX "b2b_warehouse_task_items_warehouse_task_id_idx" ON "b2b_warehouse_task_items"("warehouse_task_id");

-- CreateIndex
CREATE INDEX "b2b_warehouse_task_items_b2b_order_line_id_idx" ON "b2b_warehouse_task_items"("b2b_order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_warehouse_task_items_warehouse_task_id_b2b_order_line_i_key" ON "b2b_warehouse_task_items"("warehouse_task_id", "b2b_order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_packages_package_number_key" ON "b2b_packages"("package_number");

-- CreateIndex
CREATE INDEX "b2b_packages_b2b_order_id_created_at_idx" ON "b2b_packages"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_packages_seller_id_created_at_idx" ON "b2b_packages"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_packages_shipment_id_idx" ON "b2b_packages"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_packages_b2b_order_id_sequence_key" ON "b2b_packages"("b2b_order_id", "sequence");

-- CreateIndex
CREATE INDEX "b2b_qc_inspections_b2b_order_id_status_created_at_idx" ON "b2b_qc_inspections"("b2b_order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_qc_inspections_package_id_idx" ON "b2b_qc_inspections"("package_id");

-- CreateIndex
CREATE INDEX "b2b_qc_inspections_inspected_by_id_idx" ON "b2b_qc_inspections"("inspected_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_shipments_shipment_number_key" ON "b2b_shipments"("shipment_number");

-- CreateIndex
CREATE INDEX "b2b_shipments_b2b_order_id_status_created_at_idx" ON "b2b_shipments"("b2b_order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_shipments_seller_id_status_created_at_idx" ON "b2b_shipments"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_shipments_assigned_delivery_user_id_status_created_at_idx" ON "b2b_shipments"("assigned_delivery_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_shipments_acceptance_status_acceptance_due_at_idx" ON "b2b_shipments"("acceptance_status", "acceptance_due_at");

-- CreateIndex
CREATE INDEX "b2b_shipments_lr_number_idx" ON "b2b_shipments"("lr_number");

-- CreateIndex
CREATE INDEX "b2b_shipments_awb_number_idx" ON "b2b_shipments"("awb_number");

-- CreateIndex
CREATE INDEX "b2b_shipment_events_shipment_id_created_at_idx" ON "b2b_shipment_events"("shipment_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_shipment_events_status_created_at_idx" ON "b2b_shipment_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_shipment_events_created_by_user_id_idx" ON "b2b_shipment_events"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_proofs_of_delivery_shipment_id_key" ON "b2b_proofs_of_delivery"("shipment_id");

-- CreateIndex
CREATE INDEX "b2b_proofs_of_delivery_created_by_user_id_idx" ON "b2b_proofs_of_delivery"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_receivables_b2b_order_id_key" ON "b2b_receivables"("b2b_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_receivables_tax_document_id_key" ON "b2b_receivables"("tax_document_id");

-- CreateIndex
CREATE INDEX "b2b_receivables_status_due_at_idx" ON "b2b_receivables"("status", "due_at");

-- CreateIndex
CREATE INDEX "b2b_receivables_ageing_bucket_status_due_at_idx" ON "b2b_receivables"("ageing_bucket", "status", "due_at");

-- CreateIndex
CREATE INDEX "b2b_receivable_entries_receivable_id_created_at_idx" ON "b2b_receivable_entries"("receivable_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_receivable_entries_reference_type_reference_id_idx" ON "b2b_receivable_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_payment_records_legacy_proof_id_key" ON "b2b_payment_records"("legacy_proof_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_payment_records_idempotency_key_key" ON "b2b_payment_records"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_payment_records_provider_order_id_key" ON "b2b_payment_records"("provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_payment_records_provider_payment_id_key" ON "b2b_payment_records"("provider_payment_id");

-- CreateIndex
CREATE INDEX "b2b_payment_records_b2b_order_id_status_created_at_idx" ON "b2b_payment_records"("b2b_order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_payment_records_requested_schedule_id_idx" ON "b2b_payment_records"("requested_schedule_id");

-- CreateIndex
CREATE INDEX "b2b_payment_records_status_created_at_idx" ON "b2b_payment_records"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_payment_records_reference_number_status_idx" ON "b2b_payment_records"("reference_number", "status");

-- CreateIndex
CREATE INDEX "b2b_payment_records_provider_order_creation_in_progress_updated_at_idx" ON "b2b_payment_records"("provider_order_creation_in_progress", "updated_at");

-- CreateIndex
CREATE INDEX "b2b_payment_records_verified_by_id_idx" ON "b2b_payment_records"("verified_by_id");

-- CreateIndex
CREATE INDEX "b2b_payment_allocations_payment_record_id_idx" ON "b2b_payment_allocations"("payment_record_id");

-- CreateIndex
CREATE INDEX "b2b_payment_allocations_payment_schedule_id_idx" ON "b2b_payment_allocations"("payment_schedule_id");

-- CreateIndex
CREATE INDEX "b2b_payment_allocations_receivable_id_idx" ON "b2b_payment_allocations"("receivable_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_receipt_vouchers_voucher_number_key" ON "b2b_receipt_vouchers"("voucher_number");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_receipt_vouchers_payment_record_id_key" ON "b2b_receipt_vouchers"("payment_record_id");

-- CreateIndex
CREATE INDEX "b2b_receipt_vouchers_issued_by_id_idx" ON "b2b_receipt_vouchers"("issued_by_id");

-- CreateIndex
CREATE INDEX "b2b_collection_tasks_receivable_id_status_idx" ON "b2b_collection_tasks"("receivable_id", "status");

-- CreateIndex
CREATE INDEX "b2b_collection_tasks_assigned_to_user_id_status_due_at_idx" ON "b2b_collection_tasks"("assigned_to_user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "b2b_collection_tasks_status_next_reminder_at_idx" ON "b2b_collection_tasks"("status", "next_reminder_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_support_cases_case_number_key" ON "b2b_support_cases"("case_number");

-- CreateIndex
CREATE INDEX "b2b_support_cases_b2b_order_id_status_created_at_idx" ON "b2b_support_cases"("b2b_order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_support_cases_b2b_order_line_id_idx" ON "b2b_support_cases"("b2b_order_line_id");

-- CreateIndex
CREATE INDEX "b2b_support_cases_shipment_id_idx" ON "b2b_support_cases"("shipment_id");

-- CreateIndex
CREATE INDEX "b2b_support_cases_tax_document_id_idx" ON "b2b_support_cases"("tax_document_id");

-- CreateIndex
CREATE INDEX "b2b_support_cases_receivable_id_idx" ON "b2b_support_cases"("receivable_id");

-- CreateIndex
CREATE INDEX "b2b_support_cases_payment_record_id_idx" ON "b2b_support_cases"("payment_record_id");

-- CreateIndex
CREATE INDEX "b2b_support_cases_created_by_user_id_idx" ON "b2b_support_cases"("created_by_user_id");

-- CreateIndex
CREATE INDEX "b2b_support_cases_assigned_to_user_id_status_idx" ON "b2b_support_cases"("assigned_to_user_id", "status");

-- CreateIndex
CREATE INDEX "b2b_erp_connections_status_updated_at_idx" ON "b2b_erp_connections"("status", "updated_at");

-- CreateIndex
CREATE INDEX "b2b_erp_connections_created_by_id_idx" ON "b2b_erp_connections"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_erp_export_jobs_export_number_key" ON "b2b_erp_export_jobs"("export_number");

-- CreateIndex
CREATE INDEX "b2b_erp_export_jobs_status_created_at_idx" ON "b2b_erp_export_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_erp_export_jobs_created_by_id_created_at_idx" ON "b2b_erp_export_jobs"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_erp_export_jobs_format_created_at_idx" ON "b2b_erp_export_jobs"("format", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_integration_outbox_event_id_key" ON "b2b_integration_outbox"("event_id");

-- CreateIndex
CREATE INDEX "b2b_integration_outbox_connection_id_status_next_attempt_at_idx" ON "b2b_integration_outbox"("connection_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "b2b_integration_outbox_b2b_order_id_created_at_idx" ON "b2b_integration_outbox"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_integration_outbox_status_next_attempt_at_created_at_idx" ON "b2b_integration_outbox"("status", "next_attempt_at", "created_at");

-- CreateIndex
CREATE INDEX "b2b_integration_outbox_aggregate_type_aggregate_id_idx" ON "b2b_integration_outbox"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "b2b_mutation_records_b2b_order_id_created_at_idx" ON "b2b_mutation_records"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_mutation_records_actor_user_id_created_at_idx" ON "b2b_mutation_records"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_mutation_records_actor_user_id_scope_idempotency_key_key" ON "b2b_mutation_records"("actor_user_id", "scope", "idempotency_key");
-- AddForeignKey
ALTER TABLE "seller_staff_memberships" ADD CONSTRAINT "seller_staff_memberships_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_staff_memberships" ADD CONSTRAINT "seller_staff_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_lines" ADD CONSTRAINT "b2b_enquiry_lines_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_lines" ADD CONSTRAINT "b2b_enquiry_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_lines" ADD CONSTRAINT "b2b_enquiry_lines_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_quotation_lines" ADD CONSTRAINT "b2b_quotation_lines_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "b2b_enquiry_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_quotation_lines" ADD CONSTRAINT "b2b_quotation_lines_enquiry_line_id_fkey" FOREIGN KEY ("enquiry_line_id") REFERENCES "b2b_enquiry_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_lines" ADD CONSTRAINT "b2b_order_lines_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_lines" ADD CONSTRAINT "b2b_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_lines" ADD CONSTRAINT "b2b_order_lines_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_po_reviews" ADD CONSTRAINT "b2b_po_reviews_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_po_reviews" ADD CONSTRAINT "b2b_po_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_buyer_credit_profiles" ADD CONSTRAINT "business_buyer_credit_profiles_business_buyer_id_fkey" FOREIGN KEY ("business_buyer_id") REFERENCES "business_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_buyer_credit_profiles" ADD CONSTRAINT "business_buyer_credit_profiles_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_credit_decisions" ADD CONSTRAINT "b2b_credit_decisions_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_credit_decisions" ADD CONSTRAINT "b2b_credit_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_schedules" ADD CONSTRAINT "b2b_payment_schedules_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_inventory_reservations" ADD CONSTRAINT "b2b_inventory_reservations_b2b_order_line_id_fkey" FOREIGN KEY ("b2b_order_line_id") REFERENCES "b2b_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_inventory_reservations" ADD CONSTRAINT "b2b_inventory_reservations_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_fulfilment_plans" ADD CONSTRAINT "b2b_fulfilment_plans_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_fulfilment_plans" ADD CONSTRAINT "b2b_fulfilment_plans_b2b_order_line_id_fkey" FOREIGN KEY ("b2b_order_line_id") REFERENCES "b2b_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_procurement_orders" ADD CONSTRAINT "b2b_procurement_orders_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_procurement_orders" ADD CONSTRAINT "b2b_procurement_orders_fulfilment_plan_id_fkey" FOREIGN KEY ("fulfilment_plan_id") REFERENCES "b2b_fulfilment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_procurement_orders" ADD CONSTRAINT "b2b_procurement_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_production_jobs" ADD CONSTRAINT "b2b_production_jobs_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_production_jobs" ADD CONSTRAINT "b2b_production_jobs_fulfilment_plan_id_fkey" FOREIGN KEY ("fulfilment_plan_id") REFERENCES "b2b_fulfilment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_production_jobs" ADD CONSTRAINT "b2b_production_jobs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_warehouse_tasks" ADD CONSTRAINT "b2b_warehouse_tasks_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_warehouse_tasks" ADD CONSTRAINT "b2b_warehouse_tasks_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_warehouse_tasks" ADD CONSTRAINT "b2b_warehouse_tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_warehouse_task_items" ADD CONSTRAINT "b2b_warehouse_task_items_warehouse_task_id_fkey" FOREIGN KEY ("warehouse_task_id") REFERENCES "b2b_warehouse_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_warehouse_task_items" ADD CONSTRAINT "b2b_warehouse_task_items_b2b_order_line_id_fkey" FOREIGN KEY ("b2b_order_line_id") REFERENCES "b2b_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_packages" ADD CONSTRAINT "b2b_packages_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_packages" ADD CONSTRAINT "b2b_packages_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_packages" ADD CONSTRAINT "b2b_packages_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "b2b_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_qc_inspections" ADD CONSTRAINT "b2b_qc_inspections_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_qc_inspections" ADD CONSTRAINT "b2b_qc_inspections_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "b2b_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_qc_inspections" ADD CONSTRAINT "b2b_qc_inspections_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_shipments" ADD CONSTRAINT "b2b_shipments_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_shipments" ADD CONSTRAINT "b2b_shipments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_shipments" ADD CONSTRAINT "b2b_shipments_assigned_delivery_user_id_fkey" FOREIGN KEY ("assigned_delivery_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_shipment_events" ADD CONSTRAINT "b2b_shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "b2b_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_shipment_events" ADD CONSTRAINT "b2b_shipment_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_proofs_of_delivery" ADD CONSTRAINT "b2b_proofs_of_delivery_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "b2b_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_proofs_of_delivery" ADD CONSTRAINT "b2b_proofs_of_delivery_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_receivables" ADD CONSTRAINT "b2b_receivables_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_receivables" ADD CONSTRAINT "b2b_receivables_tax_document_id_fkey" FOREIGN KEY ("tax_document_id") REFERENCES "tax_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_receivable_entries" ADD CONSTRAINT "b2b_receivable_entries_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "b2b_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_records" ADD CONSTRAINT "b2b_payment_records_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_records" ADD CONSTRAINT "b2b_payment_records_requested_schedule_id_fkey" FOREIGN KEY ("requested_schedule_id") REFERENCES "b2b_payment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_records" ADD CONSTRAINT "b2b_payment_records_legacy_proof_id_fkey" FOREIGN KEY ("legacy_proof_id") REFERENCES "b2b_payment_proofs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_records" ADD CONSTRAINT "b2b_payment_records_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_allocations" ADD CONSTRAINT "b2b_payment_allocations_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "b2b_payment_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_allocations" ADD CONSTRAINT "b2b_payment_allocations_payment_schedule_id_fkey" FOREIGN KEY ("payment_schedule_id") REFERENCES "b2b_payment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_allocations" ADD CONSTRAINT "b2b_payment_allocations_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "b2b_receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_receipt_vouchers" ADD CONSTRAINT "b2b_receipt_vouchers_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "b2b_payment_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_receipt_vouchers" ADD CONSTRAINT "b2b_receipt_vouchers_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_collection_tasks" ADD CONSTRAINT "b2b_collection_tasks_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "b2b_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_collection_tasks" ADD CONSTRAINT "b2b_collection_tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_b2b_order_line_id_fkey" FOREIGN KEY ("b2b_order_line_id") REFERENCES "b2b_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "b2b_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_tax_document_id_fkey" FOREIGN KEY ("tax_document_id") REFERENCES "tax_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "b2b_receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "b2b_payment_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_support_cases" ADD CONSTRAINT "b2b_support_cases_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_erp_connections" ADD CONSTRAINT "b2b_erp_connections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_erp_export_jobs" ADD CONSTRAINT "b2b_erp_export_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_integration_outbox" ADD CONSTRAINT "b2b_integration_outbox_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "b2b_erp_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_integration_outbox" ADD CONSTRAINT "b2b_integration_outbox_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_mutation_records" ADD CONSTRAINT "b2b_mutation_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_mutation_records" ADD CONSTRAINT "b2b_mutation_records_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "b2b_orders_legacy_migration_review_required_status_created_at_idx"
  ON "b2b_orders"("legacy_migration_review_required", "status", "created_at");

-- Preserve every legacy single-line enquiry as one V2 enquiry line.
INSERT INTO "b2b_enquiry_lines" (
  "id", "enquiry_id", "product_id", "line_number", "description", "quantity", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), enquiry."id", enquiry."product_id", 1,
  COALESCE(product."name", 'B2B procurement'), enquiry."quantity", enquiry."created_at", CURRENT_TIMESTAMP
FROM "b2b_enquiries" enquiry
LEFT JOIN "products" product ON product."id" = enquiry."product_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "b2b_enquiry_lines" line WHERE line."enquiry_id" = enquiry."id"
);

-- Preserve priced legacy quotations as one quotation line.
INSERT INTO "b2b_quotation_lines" (
  "id", "response_id", "enquiry_line_id", "quantity", "unit_price_paise", "subtotal_paise", "created_at"
)
SELECT
  gen_random_uuid(), response."id", line."id", line."quantity", response."quoted_price_paise",
  line."quantity" * response."quoted_price_paise", response."created_at"
FROM "b2b_enquiry_responses" response
JOIN "b2b_enquiry_lines" line ON line."enquiry_id" = response."enquiry_id" AND line."line_number" = 1
WHERE response."quoted_price_paise" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "b2b_quotation_lines" quote WHERE quote."response_id" = response."id"
  );

-- Preserve every legacy single-product sales order as one immutable order line.
INSERT INTO "b2b_order_lines" (
  "id", "b2b_order_id", "product_id", "line_number", "description", "hsn_sac_code",
  "tax_classification", "quantity", "unit_price_paise", "gross_value_paise",
  "gst_rate_percent", "line_value_paise", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), b2b_order."id", b2b_order."product_id", 1,
  COALESCE(product."name", 'B2B procurement'), product."hsn_code",
  COALESCE(product."tax_classification", 'TAXABLE'::"ProductTaxClassification"),
  b2b_order."quantity", COALESCE(b2b_order."unit_price_paise", 0),
  COALESCE(b2b_order."subtotal_paise", 0), product."gst_rate_percent",
  COALESCE(b2b_order."subtotal_paise", 0), b2b_order."created_at", CURRENT_TIMESTAMP
FROM "b2b_orders" b2b_order
LEFT JOIN "products" product ON product."id" = b2b_order."product_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "b2b_order_lines" line WHERE line."b2b_order_id" = b2b_order."id"
);

-- Backfill the existing commercial payment expectation as one prepaid schedule.
INSERT INTO "b2b_payment_schedules" (
  "id", "b2b_order_id", "installment_number", "label", "payment_term_type", "amount_paise",
  "paid_amount_paise", "due_at", "fulfilment_gate", "dispatch_gate", "status", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), b2b_order."id", 1, 'Legacy full payment', 'PREPAID_FULL',
  b2b_order."buyer_payable_amount_paise", LEAST(b2b_order."paid_amount_paise", b2b_order."buyer_payable_amount_paise"),
  b2b_order."payment_due_at", true, true,
  CASE
    WHEN b2b_order."paid_amount_paise" >= b2b_order."buyer_payable_amount_paise" THEN 'PAID'::"B2BPaymentScheduleStatus"
    WHEN b2b_order."paid_amount_paise" > 0 THEN 'PARTIALLY_PAID'::"B2BPaymentScheduleStatus"
    ELSE 'PENDING'::"B2BPaymentScheduleStatus"
  END,
  b2b_order."created_at", CURRENT_TIMESTAMP
FROM "b2b_orders" b2b_order
WHERE NOT EXISTS (
  SELECT 1 FROM "b2b_payment_schedules" schedule WHERE schedule."b2b_order_id" = b2b_order."id"
);

-- Convert legacy proofs into append-only payment records where possible.
INSERT INTO "b2b_payment_records" (
  "id", "b2b_order_id", "legacy_proof_id", "idempotency_key", "method", "status", "amount_paise",
  "currency", "reference_number", "proof_file_key", "rejection_reason", "verified_by_id", "verified_at",
  "cleared_at", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), proof."b2b_order_id", proof."id", 'legacy-proof:' || proof."id"::text,
  proof."method",
  CASE proof."status"
    WHEN 'VERIFIED' THEN 'CLEARED'::"B2BPaymentRecordStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"B2BPaymentRecordStatus"
    ELSE 'SUBMITTED'::"B2BPaymentRecordStatus"
  END,
  proof."amount_paise", proof."currency", proof."reference_number", proof."proof_file_key",
  proof."rejection_reason", proof."reviewed_by_user_id", proof."reviewed_at",
  CASE WHEN proof."status" = 'VERIFIED' THEN proof."reviewed_at" ELSE NULL END,
  proof."created_at", CURRENT_TIMESTAMP
FROM "b2b_payment_proofs" proof
WHERE NOT EXISTS (
  SELECT 1 FROM "b2b_payment_records" payment WHERE payment."legacy_proof_id" = proof."id"
);

-- Map broad legacy fulfilment states to the most defensible V2 stage.
UPDATE "b2b_orders" b2b_order
SET
  "status" = CASE
    WHEN b2b_order."transport_status" = 'DELIVERED' THEN 'DELIVERED'::"B2BOrderStatus"
    WHEN b2b_order."transport_status" = 'IN_TRANSIT' THEN 'IN_TRANSIT'::"B2BOrderStatus"
    WHEN b2b_order."transport_status" = 'DISPATCHED' THEN 'DISPATCHED'::"B2BOrderStatus"
    WHEN EXISTS (
      SELECT 1 FROM "tax_documents" document
      WHERE document."b2b_order_id" = b2b_order."id" AND document."status" = 'ISSUED'
    ) THEN 'TAX_INVOICE_ISSUED'::"B2BOrderStatus"
    ELSE 'FULFILMENT_REVIEW_REQUIRED'::"B2BOrderStatus"
  END,
  "legacy_migration_review_required" = CASE
    WHEN b2b_order."transport_status" IN ('DELIVERED', 'IN_TRANSIT', 'DISPATCHED') THEN false
    WHEN EXISTS (
      SELECT 1 FROM "tax_documents" document
      WHERE document."b2b_order_id" = b2b_order."id" AND document."status" = 'ISSUED'
    ) THEN false
    ELSE true
  END
WHERE b2b_order."status" = 'FULFILLED';

CREATE OR REPLACE FUNCTION "prevent_b2b_verified_payment_core_update"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" IN ('VERIFIED', 'CLEARED') AND (
    NEW."b2b_order_id" IS DISTINCT FROM OLD."b2b_order_id" OR
    NEW."requested_schedule_id" IS DISTINCT FROM OLD."requested_schedule_id" OR
    NEW."method" IS DISTINCT FROM OLD."method" OR
    NEW."amount_paise" IS DISTINCT FROM OLD."amount_paise" OR
    NEW."unallocated_amount_paise" IS DISTINCT FROM OLD."unallocated_amount_paise" OR
    NEW."currency" IS DISTINCT FROM OLD."currency" OR
    NEW."reference_number" IS DISTINCT FROM OLD."reference_number" OR
    NEW."proof_file_key" IS DISTINCT FROM OLD."proof_file_key" OR
    NEW."provider_order_id" IS DISTINCT FROM OLD."provider_order_id" OR
    NEW."provider_payment_id" IS DISTINCT FROM OLD."provider_payment_id" OR
    NEW."provider_order_creation_in_progress" IS DISTINCT FROM OLD."provider_order_creation_in_progress" OR
    NEW."provider_order_created_at" IS DISTINCT FROM OLD."provider_order_created_at" OR
    NEW."provider_method" IS DISTINCT FROM OLD."provider_method" OR
    NEW."provider_payload" IS DISTINCT FROM OLD."provider_payload" OR
    NEW."cheque_number" IS DISTINCT FROM OLD."cheque_number"
  ) THEN
    RAISE EXCEPTION 'Verified B2B payment financial fields are immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_payment_records_verified_immutable"
BEFORE UPDATE ON "b2b_payment_records"
FOR EACH ROW EXECUTE FUNCTION "prevent_b2b_verified_payment_core_update"();

CREATE OR REPLACE FUNCTION "prevent_b2b_receipt_voucher_change"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     OLD."file_key" IS NULL AND
     NEW."file_key" IS NOT NULL AND
     ROW(NEW."id", NEW."voucher_number", NEW."payment_record_id", NEW."issued_by_id", NEW."issued_at", NEW."created_at")
       IS NOT DISTINCT FROM
     ROW(OLD."id", OLD."voucher_number", OLD."payment_record_id", OLD."issued_by_id", OLD."issued_at", OLD."created_at") THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Issued B2B receipt vouchers are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_receipt_vouchers_immutable"
BEFORE UPDATE OR DELETE ON "b2b_receipt_vouchers"
FOR EACH ROW EXECUTE FUNCTION "prevent_b2b_receipt_voucher_change"();

CREATE OR REPLACE FUNCTION "prevent_b2b_immutable_pod_change"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Issued B2B POD evidence is immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_proofs_of_delivery_immutable"
BEFORE UPDATE OR DELETE ON "b2b_proofs_of_delivery"
FOR EACH ROW EXECUTE FUNCTION "prevent_b2b_immutable_pod_change"();

CREATE OR REPLACE FUNCTION "prevent_closed_b2b_qc_change"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."closed_at" IS NOT NULL THEN
    RAISE EXCEPTION 'Closed B2B QC inspections are immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "b2b_qc_inspections_closed_immutable"
BEFORE UPDATE OR DELETE ON "b2b_qc_inspections"
FOR EACH ROW EXECUTE FUNCTION "prevent_closed_b2b_qc_change"();
