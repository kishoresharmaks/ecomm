-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "cube";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('CUSTOMER', 'SELLER', 'BUSINESS_BUYER', 'ADMIN', 'SUPPORT_STAFF', 'CHAT_SUPPORT', 'DELIVERY_PARTNER', 'FINANCE', 'COURIER_MANAGER');

-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('OPEN', 'WAITING_FOR_STAFF', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ChatConversationSensitivity" AS ENUM ('NORMAL', 'DISPUTE', 'FRAUD_REVIEW', 'LEGAL_HOLD');

-- CreateEnum
CREATE TYPE "ChatRequesterType" AS ENUM ('CUSTOMER', 'SELLER', 'BUSINESS_BUYER', 'DELIVERY_PARTNER');

-- CreateEnum
CREATE TYPE "ChatMessageSenderType" AS ENUM ('USER', 'BOT', 'SUPPORT_AGENT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'GUIDED_ACTION', 'STAFF_HANDOVER', 'INTERNAL_NOTE', 'SYSTEM_EVENT');

-- CreateEnum
CREATE TYPE "ChatEscalationReason" AS ENUM ('USER_REQUESTED_STAFF', 'BOT_UNCERTAIN', 'AI_UNAVAILABLE', 'RATE_LIMITED', 'SLA_RISK', 'SENSITIVE_TOPIC', 'ADMIN_ESCALATED');

-- CreateEnum
CREATE TYPE "ChatAiRunStatus" AS ENUM ('NOT_USED', 'SKIPPED', 'SUCCEEDED', 'FAILED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ChatRateLimitAction" AS ENUM ('MESSAGE_SEND', 'CONVERSATION_CREATE', 'AI_CALL', 'BOT_TURN');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('MARKETPLACE_SELLER', 'HYPERLOCAL_STORE', 'WHOLESALE_DISTRIBUTOR', 'SERVICE_PROVIDER');

-- CreateEnum
CREATE TYPE "SellerCapability" AS ENUM ('RETAIL', 'SERVICE');

-- CreateEnum
CREATE TYPE "SellerBusinessType" AS ENUM ('INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SellerSubscriptionBillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "SellerSubscriptionPlanAudience" AS ENUM ('RETAIL', 'SERVICE', 'ALL');

-- CreateEnum
CREATE TYPE "SellerSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SellerSubscriptionProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SearchDocumentEntityType" AS ENUM ('PRODUCT', 'STORE', 'CATEGORY');

-- CreateEnum
CREATE TYPE "SearchDocumentVisibilityStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SearchIndexJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductAttributeFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "ProductAttributeScope" AS ENUM ('PRODUCT', 'VARIANT');

-- CreateEnum
CREATE TYPE "ProductListingMode" AS ENUM ('CART', 'ENQUIRY_ONLY', 'CART_AND_ENQUIRY');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealParticipationStatus" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "DealProductEnrollmentStatus" AS ENUM ('ENROLLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INCREMENT', 'DECREMENT', 'RESERVE', 'RELEASE', 'ADJUSTMENT', 'SALE', 'RETURN');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('STARTED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('STANDARD', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "TaxPriceMode" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "TaxSupplyType" AS ENUM ('INTRA_STATE', 'INTER_STATE', 'OUTSIDE_INDIA');

-- CreateEnum
CREATE TYPE "SellerTaxRegistrationStatus" AS ENUM ('GST_REGISTERED', 'NOT_REGISTERED', 'COMPOSITION');

-- CreateEnum
CREATE TYPE "ProductTaxClassification" AS ENUM ('TAXABLE', 'NIL_RATED', 'EXEMPT', 'NON_GST');

-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('TAX_INVOICE', 'BILL_OF_SUPPLY', 'COMMERCIAL_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "TaxDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxDocumentSource" AS ENUM ('CHECKOUT', 'LEGACY_BACKFILL', 'B2B_FULFILMENT', 'SERVICE_BOOKING', 'RETURN_REFUND', 'ORDER_CANCELLATION', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TaxDocumentLineType" AS ENUM ('PRODUCT', 'SERVICE', 'SHIPPING', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "GstrSupplySection" AS ENUM ('B2B', 'B2CL', 'B2CS', 'CDNR', 'CDNUR', 'EXPORT', 'SEZ', 'NIL_EXEMPT_NON_GST');

-- CreateEnum
CREATE TYPE "GstFilingPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'FILED', 'REOPENED');

-- CreateEnum
CREATE TYPE "GstReconciliationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "GstComplianceStatus" AS ENUM ('NOT_REQUIRED', 'READY', 'PENDING', 'SUBMITTED', 'GENERATED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "GstReportExportType" AS ENUM ('GST_REGISTER', 'HSN_SUMMARY', 'GSTR1_CSV', 'GSTR1_JSON', 'GSTR3B', 'GSTR8', 'TCS_STATEMENT', 'DOCUMENT_SERIES', 'RATE_LIABILITY', 'STATE_LIABILITY', 'GSTIN_SUMMARY', 'RECONCILIATION', 'PLATFORM_COMMISSION', 'E_INVOICE', 'E_WAY_BILL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "OrderItemLifecycleStatus" AS ENUM ('ACTIVE', 'PARTIALLY_CANCELLED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REPLACEMENT_REQUESTED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED', 'QC_PASSED', 'QC_FAILED', 'RESOLVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnRequestItemStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PICKUP_PENDING', 'PICKED_UP', 'RECEIVED', 'QC_PASSED', 'QC_FAILED', 'REFUND_REQUESTED', 'REPLACEMENT_CREATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReturnRequestResolution" AS ENUM ('REFUND', 'REPLACEMENT', 'PARTIAL_REFUND', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'RETRY_PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundTransactionStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('RAZORPAY', 'COD_CASH', 'BANK_TRANSFER', 'UPI', 'MANUAL');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('ORDER_CANCELLED', 'ITEM_CANCELLED', 'RETURN_REFUND', 'RETURN_PARTIAL_REFUND', 'SERVICE_BOOKING_CANCELLED', 'SERVICE_DISPUTE_REFUND', 'SERVICE_DISPUTE_PARTIAL_REFUND', 'SELLER_NON_FULFILMENT', 'DAMAGED_LOST_SHIPMENT', 'GOODWILL_ADJUSTMENT', 'RTO_REFUND', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReverseShipmentMode" AS ENUM ('PLATFORM_PICKUP', 'CUSTOMER_SELF_SHIP');

-- CreateEnum
CREATE TYPE "ReverseShipmentStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'RECEIVED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_ASSIGNED', 'PENDING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentAttemptSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentRejectionReason" AS ENUM ('CAPACITY_FULL', 'AREA_TOO_FAR', 'VEHICLE_UNAVAILABLE', 'COD_LIMIT_RISK', 'PERSONAL_EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryAttemptReason" AS ENUM ('CUSTOMER_NOT_REACHABLE', 'ADDRESS_ISSUE', 'RESCHEDULED', 'REFUSED_DELIVERY', 'FAILED_ATTEMPT', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('STORE_PICKUP', 'LOCAL_DELIVERY_PARTNER', 'THIRD_PARTY_COURIER', 'MANUAL_TRANSPORT');

-- CreateEnum
CREATE TYPE "RazorpayWebhookEventStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ShippingCodSurchargeType" AS ENUM ('NONE', 'FLAT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ShippingPricingType" AS ENUM ('FLAT', 'DISTANCE');

-- CreateEnum
CREATE TYPE "CourierProviderMode" AS ENUM ('MANUAL', 'SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "CourierShipmentStatus" AS ENUM ('NOT_BOOKED', 'BOOKED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderShipmentPackageStatus" AS ENUM ('PACKING_PENDING', 'READY_FOR_BOOKING', 'BOOKING_PENDING', 'BOOKED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CourierWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryRoutingFailureReason" AS ENUM ('NO_LOCAL_PARTNER', 'COURIER_PROVIDER_INACTIVE', 'COURIER_COUNTRY_UNSERVICEABLE', 'COURIER_UNAVAILABLE', 'NO_RATE_CARD', 'PROVIDER_BOOKING_FAILED', 'OTHER');

-- CreateEnum
CREATE TYPE "CodCollectionSource" AS ENUM ('LOCAL_PARTNER', 'THIRD_PARTY_COURIER', 'SELLER', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "CodCollectionStatus" AS ENUM ('NOT_COLLECTED', 'COLLECTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CourierCodRemittanceStatus" AS ENUM ('PENDING', 'COURIER_COLLECTED', 'REMITTED', 'VERIFIED', 'DISPUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryPartnerWalletEntryType" AS ENUM ('LOCAL_DELIVERY_EARNING', 'REVERSE_PICKUP_EARNING', 'MANUAL_ADJUSTMENT', 'MANUAL_PAYOUT');

-- CreateEnum
CREATE TYPE "DeliveryPartnerWalletEntryDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MAP_PICK', 'MANUAL', 'REVERSE_GEOCODE');

-- CreateEnum
CREATE TYPE "DeliveryPartnerPayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "DeliveryPartnerApplicationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SellerOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'COD', 'BANK_TRANSFER', 'MANUAL');

-- CreateEnum
CREATE TYPE "B2BEnquiryStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESPONDED', 'NEGOTIATING', 'BUYER_CONFIRMED', 'ADMIN_APPROVED', 'FINALISED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BOrderStatus" AS ENUM ('PROFORMA_ISSUED', 'PO_SUBMITTED', 'PO_UNDER_REVIEW', 'PO_ACCEPTED', 'CREDIT_CLEARANCE_PENDING', 'IN_FULFILMENT', 'PROCUREMENT_IN_PROGRESS', 'PRODUCTION_IN_PROGRESS', 'STOCK_READY', 'PICKING', 'PACKING', 'QC_PENDING', 'PACKED_AND_QC_PASSED', 'TAX_INVOICE_ISSUED', 'E_WAY_READY', 'E_WAY_NOT_REQUIRED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERY_ACCEPTED', 'DELIVERY_DISPUTED', 'PAYMENT_OVERDUE', 'ON_HOLD', 'FULFILMENT_REVIEW_REQUIRED', 'CLOSED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BPaymentStatus" AS ENUM ('PENDING', 'SUBMITTED_FOR_VERIFICATION', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'REFUNDED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "B2BProofStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'RAZORPAY_FAILED');

-- CreateEnum
CREATE TYPE "B2BPaymentMethod" AS ENUM ('BANK_TRANSFER', 'MANUAL', 'RAZORPAY', 'UPI', 'CHEQUE');

-- CreateEnum
CREATE TYPE "B2BTransportMode" AS ENUM ('STORE_PICKUP', 'SELLER_ARRANGED_TRANSPORT');

-- CreateEnum
CREATE TYPE "B2BTransportStatus" AS ENUM ('NOT_REQUIRED', 'REQUESTED', 'QUOTED', 'READY_FOR_PICKUP', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BAuditActorType" AS ENUM ('ADMIN', 'FINANCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "B2BAdminAction" AS ENUM ('EXTEND_PAYMENT_DUE_DATE', 'SET_NOT_REQUIRED', 'UNLOCK_FULFILMENT', 'CANCEL_OVERDUE_ORDER', 'REGENERATE_PROFORMA', 'RECORD_MANUAL_PAYMENT', 'VERIFY_PAYMENT_PROOF', 'REJECT_PAYMENT_PROOF', 'ISSUE_REFUND', 'PAYMENT_OVERDUE', 'UPDATE_TRANSPORT');

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
CREATE TYPE "B2BOrderAmendmentStatus" AS ENUM ('REQUESTED', 'APPLIED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2BDisputeResolutionType" AS ENUM ('ACCEPTED_AS_DELIVERED', 'PARTIAL_ACCEPTANCE', 'REPLACEMENT', 'RETURN_AND_REFUND', 'CREDIT_NOTE', 'CLAIM_REJECTED');

-- CreateEnum
CREATE TYPE "B2BFinancialReconciliationStatus" AS ENUM ('MATCHED', 'CORRECTED', 'EXCEPTION');

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

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SeoEntityType" AS ENUM ('HOME', 'PRODUCT', 'CATEGORY', 'STORE', 'CMS_PAGE', 'B2B_LANDING', 'SELLER_LANDING', 'POLICY', 'SEARCH', 'CUSTOM_ROUTE');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportRequestTopic" AS ENUM ('ORDER', 'PAYMENT', 'DELIVERY', 'SELLER', 'B2B', 'DOWNLOAD_APP', 'GENERAL');

-- CreateEnum
CREATE TYPE "SupportRequesterType" AS ENUM ('CUSTOMER', 'SELLER', 'BUSINESS_BUYER', 'DELIVERY_PARTNER', 'GUEST');

-- CreateEnum
CREATE TYPE "SupportContactChannel" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "SupportRequestSource" AS ENUM ('WEB_CONTACT', 'WEB_ACCOUNT_SUPPORT', 'WEB_SELLER_SUPPORT', 'WEB_B2B_SUPPORT', 'API', 'MOBILE_APP');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PushNotificationType" AS ENUM ('DEAL_PUBLISHED', 'ORDER_PLACED', 'ORDER_DELIVERED', 'B2B_ENQUIRY_MESSAGE', 'SERVICE_BOOKING', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "PushNotificationCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PushNotificationBatchStatus" AS ENUM ('PENDING', 'CLAIMED', 'DONE');

-- CreateEnum
CREATE TYPE "PushNotificationReceiptStatus" AS ENUM ('PENDING', 'CHECKED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EmailTemplateCategory" AS ENUM ('CUSTOMER', 'SELLER', 'B2B', 'ORDER', 'PAYMENT', 'PRODUCT', 'SUPPORT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailRecipientType" AS ENUM ('CUSTOMER', 'SELLER', 'BUSINESS_BUYER', 'DELIVERY_PARTNER', 'ADMIN', 'SUPPORT_REQUESTER');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FIXED', 'MANUAL');

-- CreateEnum
CREATE TYPE "FinanceRuleScope" AS ENUM ('GLOBAL', 'CATEGORY', 'SELLER', 'SELLER_CATEGORY');

-- CreateEnum
CREATE TYPE "SellerSettlementStatus" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'DRAFTED', 'APPROVED', 'PAID', 'CANCELLED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "SellerPayoutStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED', 'HELD');

-- CreateEnum
CREATE TYPE "SellerLedgerEntryType" AS ENUM ('ORDER_EARNING', 'B2B_ORDER_EARNING', 'SERVICE_EARNING', 'COMMISSION_DEDUCTION', 'B2B_COMMISSION', 'SERVICE_COMMISSION', 'GST_ON_COMMISSION', 'TDS_DEDUCTION', 'TCS_DEDUCTION', 'PLATFORM_FEE', 'COUPON_DISCOUNT', 'REFUND_ADJUSTMENT', 'REVERSE_LOGISTICS_FEE', 'SERVICE_RECEIVABLE_OPENED', 'SERVICE_RECEIVABLE_SETTLED', 'SERVICE_RECEIVABLE_WAIVED', 'SERVICE_RECEIVABLE_REVERSED', 'SERVICE_RECEIVABLE_OFFSET', 'SERVICE_REFUND_HOLD', 'SERVICE_REFUND_REVERSAL', 'SERVICE_CANCELLATION_FEE', 'SELLER_CASH_RECEIVABLE_OPENED', 'SELLER_CASH_RECEIVABLE_OFFSET', 'SELLER_CASH_RECEIVABLE_SETTLED', 'SELLER_CASH_RECEIVABLE_WAIVED', 'MANUAL_ADJUSTMENT', 'PAYOUT_PAID');

-- CreateEnum
CREATE TYPE "SellerCashReceivableSource" AS ENUM ('STORE_PICKUP_COD', 'MANUAL_TRANSPORT_COD');

-- CreateEnum
CREATE TYPE "SellerCashReceivableStatus" AS ENUM ('OPEN', 'PARTIALLY_OFFSET', 'OFFSET_SCHEDULED', 'SETTLED', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceVisitMode" AS ENUM ('CUSTOMER_LOCATION', 'PROVIDER_LOCATION', 'REMOTE');

-- CreateEnum
CREATE TYPE "ServicePricingModel" AS ENUM ('FIXED_PRICE', 'QUOTE_FIRST', 'INSPECTION_FEE');

-- CreateEnum
CREATE TYPE "ServicePaymentMode" AS ENUM ('FULL_PAYMENT', 'ADVANCE_PAYMENT', 'INSPECTION_FEE', 'PAY_AT_VISIT');

-- CreateEnum
CREATE TYPE "ServiceBookingStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_EXPIRED', 'QUOTE_REJECTED', 'CLOSED_AFTER_INSPECTION', 'REJECTED', 'CANCELLED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED', 'COMPLETION_DISPUTED', 'COMPLETED', 'CANCELLED_AFTER_DISPUTE');

-- CreateEnum
CREATE TYPE "ServiceCancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT');

-- CreateEnum
CREATE TYPE "ServiceCancellationInitiator" AS ENUM ('CUSTOMER', 'PROVIDER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ServiceQuoteStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ServicePaymentPurpose" AS ENUM ('FULL_PAYMENT', 'ADVANCE_PAYMENT', 'INSPECTION_FEE', 'FINAL_QUOTE', 'PAY_AT_VISIT');

-- CreateEnum
CREATE TYPE "ServicePaymentCollectionType" AS ENUM ('PLATFORM_ONLINE', 'PLATFORM_OFFLINE', 'PROVIDER_CASH');

-- CreateEnum
CREATE TYPE "ServicePaymentSettlementTreatment" AS ENUM ('PAYOUT_ELIGIBLE', 'PLATFORM_RECEIVABLE', 'TRACK_ONLY');

-- CreateEnum
CREATE TYPE "ServiceCashCollectionStatus" AS ENUM ('NOT_APPLICABLE', 'RECORDED', 'CUSTOMER_CONFIRMED', 'CUSTOMER_DISPUTED', 'ADMIN_VERIFIED', 'ADMIN_PARTIALLY_VERIFIED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ServiceCashDisputeResolution" AS ENUM ('CUSTOMER_CONFIRMED', 'ADMIN_FORCE_CONFIRMED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'REOPENED_FOR_EVIDENCE');

-- CreateEnum
CREATE TYPE "ServiceSellerReceivableStatus" AS ENUM ('PROVISIONAL', 'OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'WAIVER_REQUESTED', 'WAIVED', 'DISPUTED', 'REVERSED', 'OFFSET_SCHEDULED', 'OFFSET_APPLIED');

-- CreateEnum
CREATE TYPE "ServiceSellerReceivableSource" AS ENUM ('PROVIDER_CASH_COLLECTION', 'ADMIN_ADJUSTMENT', 'REVERSAL', 'PAYOUT_OFFSET');

-- CreateEnum
CREATE TYPE "ServiceReceivableOffsetPolicy" AS ENUM ('MANUAL_ONLY', 'AUTO_OFFSET_NEXT_PAYOUT', 'HOLD_PAYOUT_UNTIL_SETTLED');

-- CreateEnum
CREATE TYPE "ServiceReceivableTaxAccrualStatus" AS ENUM ('PROVISIONAL', 'ACCRUED', 'REVERSED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ServiceReceivableWaiverApprovalStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceDisputeResolution" AS ENUM ('COMPLETE_BOOKING', 'CANCEL_AFTER_DISPUTE', 'REFUND_CUSTOMER', 'RELEASE_TO_PROVIDER', 'PARTIAL_REFUND');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "CouponFundingSource" AS ENUM ('PLATFORM', 'SELLER');

-- CreateEnum
CREATE TYPE "CouponSellerParticipationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('ACTIVE', 'PARTIALLY_ADJUSTED', 'FULLY_REVERSED');

-- CreateEnum
CREATE TYPE "CouponAdjustmentReason" AS ENUM ('ORDER_CANCELLED', 'PARTIAL_CANCELLED', 'REFUND_ADJUSTMENT', 'SHIPPING_NON_REFUNDABLE', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SellerStatementStatus" AS ENUM ('GENERATED', 'VOID');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "StatusEventType" AS ENUM ('ORDER', 'PAYMENT', 'DELIVERY', 'SELLER', 'PRODUCT');

-- CreateEnum
CREATE TYPE "LocationImportSourceType" AS ENUM ('BUNDLED_DATA', 'GEONAMES_DATA_DUMP', 'OGD_API', 'ONEMAP_API', 'MANUAL_CSV');

-- CreateEnum
CREATE TYPE "LocationImportMode" AS ENUM ('IMPORT', 'REFRESH');

-- CreateEnum
CREATE TYPE "LocationImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "clerk_user_id" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "full_name" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "password_algorithm" TEXT NOT NULL DEFAULT 'scrypt',
    "password_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "browsing_location_label" TEXT,
    "browsing_country_code" TEXT,
    "browsing_state_code" TEXT,
    "browsing_city_code" TEXT,
    "browsing_local_area_code" TEXT,
    "browsing_pincode" TEXT,
    "deal_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketing_campaigns_enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_push_tokens" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
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

    CONSTRAINT "customer_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "country_code" TEXT NOT NULL DEFAULT 'IN',
    "state_code" TEXT,
    "city_code" TEXT,
    "local_area_code" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location_source" "LocationSource",
    "accuracy_meters" DECIMAL(10,2),
    "location_confidence_score" DECIMAL(5,2),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" UUID NOT NULL,
    "wishlist_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seller_type" "SellerType" NOT NULL,
    "primary_capability" "SellerCapability" NOT NULL DEFAULT 'RETAIL',
    "enabled_capabilities" "SellerCapability"[] DEFAULT ARRAY['RETAIL']::"SellerCapability"[],
    "service_rating" DECIMAL(3,2),
    "service_review_count" INTEGER NOT NULL DEFAULT 0,
    "store_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "commission_type" "CommissionType" NOT NULL DEFAULT 'MANUAL',
    "commission_value_bps" INTEGER,
    "commission_fixed_paise" INTEGER,
    "subscription_plan_id" UUID,
    "subscription_status" "SellerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscription_started_at" TIMESTAMP(3),
    "subscription_current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "description" TEXT,
    "business_legal_name" TEXT,
    "business_type" "SellerBusinessType",
    "tax_registration_status" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "gst_number" TEXT,
    "pan_number" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_addresses" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "country_code" TEXT NOT NULL DEFAULT 'IN',
    "state_code" TEXT,
    "city_code" TEXT,
    "local_area_code" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location_source" "LocationSource",
    "accuracy_meters" DECIMAL(10,2),
    "location_confidence_score" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_service_areas" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "label" TEXT,
    "country_code" TEXT,
    "state_code" TEXT,
    "city_code" TEXT,
    "local_area_code" TEXT,
    "pincode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "radius_km" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_service_technicians" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_service_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_service_availability_rules" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_service_availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_service_blocked_windows" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "is_full_day" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_service_blocked_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_courier_provider_settings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "pickup_location_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_courier_provider_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_documents" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_uploads" (
    "id" UUID NOT NULL,
    "asset_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "upload_kind" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "content_type" TEXT,
    "size_bytes" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "private_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payout_profiles" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "account_holder_name" TEXT,
    "bank_name" TEXT,
    "account_number_encrypted" TEXT,
    "account_number_last4" VARCHAR(4),
    "ifsc_code_encrypted" TEXT,
    "upi_id_encrypted" TEXT,
    "upi_id_hint" TEXT,
    "account_number" TEXT,
    "ifsc_code" TEXT,
    "upi_id" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_payout_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscription_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audience" "SellerSubscriptionPlanAudience" NOT NULL DEFAULT 'RETAIL',
    "price_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billing_cycle" "SellerSubscriptionBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "product_limit" INTEGER,
    "featured_product_limit" INTEGER,
    "b2b_enquiry_limit" INTEGER,
    "commission_discount_bps" INTEGER NOT NULL DEFAULT 0,
    "provider_plan_id" TEXT,
    "provider_plan_version" INTEGER NOT NULL DEFAULT 1,
    "provider_plan_synced_at" TIMESTAMP(3),
    "provider_plan_snapshot" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscriptions" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SellerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "provider" "PaymentProvider",
    "provider_subscription_id" TEXT,
    "provider_plan_id" TEXT,
    "provider_status" TEXT,
    "provider_customer_id" TEXT,
    "authorized_at" TIMESTAMP(3),
    "next_billing_at" TIMESTAMP(3),
    "grace_period_ends_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "provider_cancel_at_cycle_end" BOOLEAN NOT NULL DEFAULT false,
    "last_payment_status" "PaymentStatus",
    "payment_failure_count" INTEGER NOT NULL DEFAULT 0,
    "provider_snapshot" JSONB,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscription_payments" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "seller_subscription_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "provider_subscription_id" TEXT,
    "provider_invoice_id" TEXT,
    "provider_payment_id" TEXT,
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "billing_period_start" TIMESTAMP(3),
    "billing_period_end" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscription_provider_events" (
    "id" UUID NOT NULL,
    "seller_subscription_id" UUID,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "SellerSubscriptionProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "seller_subscription_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_buyers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "gst_number" TEXT,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_buyer_addresses" (
    "id" UUID NOT NULL,
    "business_buyer_id" UUID NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "country_code" TEXT NOT NULL DEFAULT 'IN',
    "state_code" TEXT,
    "city_code" TEXT,
    "local_area_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_buyer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_countries" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "phone_code" TEXT NOT NULL,
    "postal_code_label" TEXT NOT NULL DEFAULT 'Postal code',
    "postal_code_pattern" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_subdivisions" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'State',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "source_record_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_subdivisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_cities" (
    "id" UUID NOT NULL,
    "subdivision_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "source_record_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_areas" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postal_code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "source_record_id" TEXT,
    "metadata" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_import_sources" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source_type" "LocationImportSourceType" NOT NULL,
    "country_code" TEXT,
    "source_url" TEXT,
    "license_note" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_import_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_import_runs" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "mode" "LocationImportMode" NOT NULL,
    "status" "LocationImportStatus" NOT NULL DEFAULT 'RUNNING',
    "country_code" TEXT,
    "source_url" TEXT,
    "source_checksum" TEXT,
    "imported_countries" INTEGER NOT NULL DEFAULT 0,
    "imported_subdivisions" INTEGER NOT NULL DEFAULT 0,
    "imported_cities" INTEGER NOT NULL DEFAULT 0,
    "imported_areas" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "location_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "product_template_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "default_hsn_code" TEXT,
    "default_gst_rate_percent" DECIMAL(5,2),
    "default_tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "default_tax_description" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hsn_master" (
    "id" UUID NOT NULL,
    "hsn_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gst_rate_percent" DECIMAL(5,2) NOT NULL,
    "category_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hsn_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "listing_mode" "ProductListingMode" NOT NULL DEFAULT 'CART',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_template_fields" (
    "id" UUID NOT NULL,
    "product_template_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_type" "ProductAttributeFieldType" NOT NULL,
    "scope" "ProductAttributeScope" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "placeholder" TEXT,
    "help_text" TEXT,
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "is_searchable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "listing_mode" "ProductListingMode" NOT NULL DEFAULT 'CART',
    "weight_kg" DECIMAL(10,3) DEFAULT 0,
    "attributes" JSONB,
    "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "hsn_code" TEXT,
    "gst_rate_percent" DECIMAL(5,2),
    "hsn_master_id" UUID,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "search_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_delivery_modes" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "manual_transport_free_distance_km" DECIMAL(8,2),
    "manual_transport_charge_per_km_minor" INTEGER,
    "manual_transport_currency" VARCHAR(3),
    "manual_transport_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_delivery_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "variant_name" TEXT,
    "price_paise" INTEGER NOT NULL,
    "mrp_paise" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "package_weight_grams" INTEGER,
    "package_length_cm" INTEGER,
    "package_breadth_cm" INTEGER,
    "package_height_cm" INTEGER,
    "status" "VariantStatus" NOT NULL DEFAULT 'ACTIVE',
    "attributes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "movement_type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "discount_bps" INTEGER NOT NULL,
    "join_deadline" TIMESTAMP(3) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
    "max_sellers" INTEGER,
    "max_products" INTEGER,
    "published_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_participations" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "DealParticipationStatus" NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_product_enrollments" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "status" "DealProductEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolled_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_product_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CouponStatus" NOT NULL DEFAULT 'DRAFT',
    "discount_type" "CouponDiscountType" NOT NULL,
    "funding_source" "CouponFundingSource" NOT NULL DEFAULT 'PLATFORM',
    "discount_value_bps" INTEGER,
    "discount_amount_paise" INTEGER,
    "max_discount_paise" INTEGER,
    "min_subtotal_paise" INTEGER,
    "max_subtotal_paise" INTEGER,
    "total_usage_limit" INTEGER,
    "per_customer_limit" INTEGER,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "is_marketplace_wide" BOOLEAN NOT NULL DEFAULT true,
    "first_order_only" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "internal_note" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usage_counters" (
    "coupon_id" UUID NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "discount_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_usage_counters_pkey" PRIMARY KEY ("coupon_id")
);

-- CreateTable
CREATE TABLE "coupon_seller_eligibilities" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_seller_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_product_eligibilities" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_product_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_category_eligibilities" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_category_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_customer_eligibilities" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_customer_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_seller_participations" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "CouponSellerParticipationStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_seller_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "code_snapshot" TEXT NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "discount_type_snapshot" "CouponDiscountType" NOT NULL,
    "funding_source_snapshot" "CouponFundingSource" NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "merchandise_basis_paise" INTEGER NOT NULL DEFAULT 0,
    "shipping_basis_paise" INTEGER NOT NULL DEFAULT 0,
    "merchandise_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "shipping_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "discount_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "snapshot" JSONB,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemption_adjustments" (
    "id" UUID NOT NULL,
    "coupon_redemption_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID,
    "order_seller_split_id" UUID,
    "reason" "CouponAdjustmentReason" NOT NULL,
    "discount_reversed_paise" INTEGER NOT NULL DEFAULT 0,
    "merchandise_discount_reversed_paise" INTEGER NOT NULL DEFAULT 0,
    "shipping_discount_reversed_paise" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemption_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "cart_id" UUID,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'STARTED',
    "shipping_address_snapshot" JSONB,
    "payment_method" TEXT,
    "delivery_mode" "DeliveryMode",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "customer_id" UUID NOT NULL,
    "checkout_session_id" UUID,
    "order_kind" "OrderKind" NOT NULL DEFAULT 'STANDARD',
    "parent_order_id" UUID,
    "replacement_return_request_id" UUID,
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
    "subtotal_paise" INTEGER NOT NULL,
    "shipping_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_id" UUID,
    "coupon_code" TEXT,
    "coupon_title" TEXT,
    "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_merchandise_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_shipping_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_snapshot" JSONB,
    "total_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "base_currency" TEXT NOT NULL DEFAULT 'INR',
    "buyer_country_code" TEXT NOT NULL DEFAULT 'IN',
    "buyer_currency" TEXT NOT NULL DEFAULT 'INR',
    "buyer_subtotal_minor" INTEGER NOT NULL DEFAULT 0,
    "buyer_shipping_minor" INTEGER NOT NULL DEFAULT 0,
    "buyer_platform_fee_minor" INTEGER NOT NULL DEFAULT 0,
    "buyer_total_minor" INTEGER NOT NULL DEFAULT 0,
    "fx_rate" DECIMAL(18,8),
    "fx_provider" TEXT,
    "fx_rate_fetched_at" TIMESTAMP(3),
    "fx_snapshot" JSONB,
    "checkout_fee_snapshot" JSONB,
    "shipping_address_snapshot" JSONB,
    "buyer_gstin_snapshot" TEXT,
    "buyer_legal_name_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_snapshot" JSONB,
    "quantity" INTEGER NOT NULL,
    "active_quantity" INTEGER NOT NULL DEFAULT 0,
    "cancelled_quantity" INTEGER NOT NULL DEFAULT 0,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "refunded_quantity" INTEGER NOT NULL DEFAULT 0,
    "replacement_quantity" INTEGER NOT NULL DEFAULT 0,
    "retained_quantity" INTEGER NOT NULL DEFAULT 0,
    "lifecycle_status" "OrderItemLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "unit_price_paise" INTEGER NOT NULL,
    "line_total_paise" INTEGER NOT NULL,
    "cancelled_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "returned_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "refunded_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "replacement_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "original_unit_price_paise" INTEGER,
    "deal_discount_bps" INTEGER,
    "deal_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "deal_id" UUID,
    "replacement_source_order_item_id" UUID,
    "replacement_source_return_item_id" UUID,
    "deal_snapshot" JSONB,
    "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_snapshot" JSONB,
    "return_policy_snapshot" JSONB,
    "hsn_code_snapshot" TEXT,
    "gst_rate_percent_snapshot" DECIMAL(5,2),
    "supplier_tax_registration_status_snapshot" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "product_tax_classification_snapshot" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "tax_price_mode_snapshot" "TaxPriceMode" NOT NULL DEFAULT 'INCLUSIVE',
    "tax_supply_type_snapshot" "TaxSupplyType",
    "place_of_supply_state_code_snapshot" TEXT,
    "supplier_gstin_snapshot" TEXT,
    "buyer_gstin_snapshot" TEXT,
    "gross_taxable_consideration_paise" INTEGER NOT NULL DEFAULT 0,
    "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "cess_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_total_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_snapshot_source" "TaxDocumentSource",
    "tax_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "ProductReviewStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT true,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "moderated_at" TIMESTAMP(3),
    "moderated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_documents" (
    "id" UUID NOT NULL,
    "entity_type" "SearchDocumentEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "subtitle" TEXT,
    "normalized_subtitle" TEXT,
    "search_text" TEXT NOT NULL,
    "slug" TEXT,
    "image_url" TEXT,
    "category_id" UUID,
    "seller_id" UUID,
    "min_price_paise" INTEGER,
    "max_price_paise" INTEGER,
    "rating_average" DECIMAL(3,2),
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "in_stock" BOOLEAN NOT NULL DEFAULT false,
    "has_deal" BOOLEAN NOT NULL DEFAULT false,
    "deal_discount_bps" INTEGER NOT NULL DEFAULT 0,
    "rank_boost" INTEGER NOT NULL DEFAULT 0,
    "visibility_status" "SearchDocumentVisibilityStatus" NOT NULL DEFAULT 'HIDDEN',
    "search_vector" tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce("normalized_title", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("normalized_subtitle", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("search_text", '')), 'C')
    ) STORED,
    "source_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_index_jobs" (
    "id" UUID NOT NULL,
    "entity_type" "SearchDocumentEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "SearchIndexJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_index_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_seller_splits" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "seller_subtotal_paise" INTEGER NOT NULL,
    "commission_paise" INTEGER NOT NULL DEFAULT 0,
    "commission_rule_id" UUID,
    "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
    "tds_paise" INTEGER NOT NULL DEFAULT 0,
    "tcs_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_platform_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_seller_funded_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_snapshot" JSONB,
    "refund_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "net_payable_paise" INTEGER NOT NULL DEFAULT 0,
    "settlement_status" "SellerSettlementStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "settlement_eligible_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "finance_snapshot" JSONB,
    "payout_id" UUID,
    "seller_status" "SellerOrderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_seller_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipments" (
    "id" UUID NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "order_seller_split_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "subtotal_paise" INTEGER NOT NULL,
    "shipping_paise" INTEGER NOT NULL DEFAULT 0,
    "cod_surcharge_paise" INTEGER NOT NULL DEFAULT 0,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "assignment_status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "assignment_expires_at" TIMESTAMP(3),
    "assignment_note" TEXT,
    "delivery_partner_user_id" UUID,
    "partner_name" TEXT,
    "partner_phone" TEXT,
    "courier_provider_code" TEXT,
    "routing_failed" BOOLEAN NOT NULL DEFAULT false,
    "routing_failure_reason" "DeliveryRoutingFailureReason",
    "routing_failure_note" TEXT,
    "routed_at" TIMESTAMP(3),
    "routing_first_failed_at" TIMESTAMP(3),
    "routing_last_attempt_at" TIMESTAMP(3),
    "routing_retry_count" INTEGER NOT NULL DEFAULT 0,
    "routing_permanent_failure_at" TIMESTAMP(3),
    "routing_snapshot" JSONB,
    "shipping_charge_snapshot" JSONB,
    "cod_surcharge_snapshot" JSONB,
    "ready_for_booking_at" TIMESTAMP(3),
    "booking_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "booking_claimed_at" TIMESTAMP(3),
    "booking_next_attempt_at" TIMESTAMP(3),
    "awb_number" TEXT,
    "courier_tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
    "label_url" TEXT,
    "tracking_reference" TEXT,
    "estimated_delivery_date" TIMESTAMP(3),
    "delivery_note" TEXT,
    "receiver_name" TEXT,
    "proof_note" TEXT,
    "proof_reference" TEXT,
    "cod_collection_status" "CodCollectionStatus" NOT NULL DEFAULT 'NOT_COLLECTED',
    "cod_collection_source" "CodCollectionSource",
    "cod_collected_amount_paise" INTEGER,
    "cod_collected_at" TIMESTAMP(3),
    "cod_collected_by_id" UUID,
    "cod_collection_note" TEXT,
    "cod_verified_at" TIMESTAMP(3),
    "cod_verified_by_id" UUID,
    "cod_verification_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipment_assignment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "previous_partner_user_id" UUID,
    "partner_user_id" UUID,
    "previous_status" "DeliveryAssignmentStatus",
    "status" "DeliveryAssignmentStatus" NOT NULL,
    "assignment_note" TEXT,
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "assignment_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_shipment_assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipment_packages" (
    "id" UUID NOT NULL,
    "package_number" TEXT NOT NULL,
    "order_shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "status" "OrderShipmentPackageStatus" NOT NULL DEFAULT 'PACKING_PENDING',
    "shipping_paise" INTEGER NOT NULL DEFAULT 0,
    "cod_surcharge_paise" INTEGER NOT NULL DEFAULT 0,
    "declared_value_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "weight_grams" INTEGER,
    "length_cm" INTEGER,
    "breadth_cm" INTEGER,
    "height_cm" INTEGER,
    "item_allocations" JSONB,
    "package_snapshot" JSONB,
    "ready_for_booking_at" TIMESTAMP(3),
    "booked_at" TIMESTAMP(3),
    "pickup_scheduled_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_shipment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status_type" "StatusEventType" NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "resolution" "ReturnRequestResolution" NOT NULL DEFAULT 'REFUND',
    "reverse_shipment_mode" "ReverseShipmentMode" NOT NULL DEFAULT 'PLATFORM_PICKUP',
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "quality_proof_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refund_destination_snapshot" JSONB,
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "requested_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "approved_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_items" (
    "id" UUID NOT NULL,
    "return_request_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "order_seller_split_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReturnRequestItemStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "resolution" "ReturnRequestResolution" NOT NULL DEFAULT 'REFUND',
    "reason" TEXT NOT NULL,
    "requested_refund_paise" INTEGER NOT NULL DEFAULT 0,
    "approved_refund_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_platform_funded_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_seller_funded_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "qc_note" TEXT,
    "seller_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_notes" (
    "id" UUID NOT NULL,
    "return_request_id" UUID NOT NULL,
    "seller_id" UUID,
    "note" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" UUID NOT NULL,
    "refund_number" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "payment_id" UUID,
    "return_request_id" UUID,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason" "RefundReason" NOT NULL,
    "method" "RefundMethod",
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "approved_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_destination_snapshot" JSONB,
    "amount_adjustment_note" TEXT,
    "amount_adjusted_at" TIMESTAMP(3),
    "amount_adjusted_by" UUID,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "seller_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "approved_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_request_items" (
    "id" UUID NOT NULL,
    "refund_request_id" UUID NOT NULL,
    "return_request_item_id" UUID,
    "order_item_id" UUID NOT NULL,
    "order_seller_split_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "seller_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_funded_coupon_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_transactions" (
    "id" UUID NOT NULL,
    "refund_request_id" UUID NOT NULL,
    "payment_id" UUID,
    "provider" "PaymentProvider",
    "method" "RefundMethod" NOT NULL,
    "status" "RefundTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider_refund_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "manual_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "raw_response" JSONB,
    "created_by" UUID,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_document_sequences" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "financial_year" TEXT NOT NULL,
    "document_type" "TaxDocumentType" NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_documents" (
    "id" UUID NOT NULL,
    "document_number" TEXT,
    "document_type" "TaxDocumentType" NOT NULL,
    "status" "TaxDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "TaxDocumentSource" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "order_id" UUID,
    "b2b_order_id" UUID,
    "service_booking_id" UUID,
    "order_seller_split_id" UUID,
    "seller_id" UUID NOT NULL,
    "return_request_id" UUID,
    "refund_request_id" UUID,
    "original_document_id" UUID,
    "issue_date" TIMESTAMP(3),
    "supply_date" TIMESTAMP(3),
    "seller_legal_name" TEXT NOT NULL,
    "seller_tax_registration_status" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "seller_gstin" TEXT,
    "seller_address_snapshot" JSONB NOT NULL,
    "buyer_legal_name" TEXT NOT NULL,
    "buyer_gstin" TEXT,
    "buyer_address_snapshot" JSONB NOT NULL,
    "place_of_supply_state_code" TEXT,
    "supplyType" "TaxSupplyType",
    "gstr_supply_section" "GstrSupplySection",
    "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "cess_paise" INTEGER NOT NULL DEFAULT 0,
    "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
    "invoice_value_paise" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "issued_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_document_compliance" (
    "id" UUID NOT NULL,
    "tax_document_id" UUID NOT NULL,
    "e_invoice_status" "GstComplianceStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "irn" TEXT,
    "acknowledgement_number" TEXT,
    "acknowledgement_date" TIMESTAMP(3),
    "signed_qr_code" TEXT,
    "e_invoice_provider" TEXT,
    "e_invoice_provider_ref" TEXT,
    "e_invoice_error" TEXT,
    "e_way_bill_status" "GstComplianceStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "e_way_bill_number" TEXT,
    "e_way_bill_generated_at" TIMESTAMP(3),
    "e_way_bill_valid_until" TIMESTAMP(3),
    "e_way_bill_provider" TEXT,
    "e_way_bill_provider_ref" TEXT,
    "e_way_bill_error" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_document_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_document_lines" (
    "id" UUID NOT NULL,
    "tax_document_id" UUID NOT NULL,
    "order_item_id" UUID,
    "return_request_item_id" UUID,
    "refund_request_item_id" UUID,
    "line_type" "TaxDocumentLineType" NOT NULL DEFAULT 'PRODUCT',
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "hsn_sac_code" TEXT,
    "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "uqc" TEXT NOT NULL DEFAULT 'NOS',
    "unit_price_paise" INTEGER NOT NULL DEFAULT 0,
    "gross_value_paise" INTEGER NOT NULL DEFAULT 0,
    "discount_paise" INTEGER NOT NULL DEFAULT 0,
    "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_rate_percent" DECIMAL(5,2),
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "cess_paise" INTEGER NOT NULL DEFAULT 0,
    "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
    "line_value_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_filing_periods" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "return_period" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "status" "GstFilingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "snapshot" JSONB,
    "snapshot_hash" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by_id" UUID,
    "filed_at" TIMESTAMP(3),
    "filed_by_id" UUID,
    "filing_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_filing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_reconciliation_runs" (
    "id" UUID NOT NULL,
    "filing_period_id" UUID,
    "seller_id" UUID NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "book_snapshot" JSONB NOT NULL,
    "filing_snapshot" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "run_hash" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_report_exports" (
    "id" UUID NOT NULL,
    "filing_period_id" UUID,
    "seller_id" UUID,
    "export_type" "GstReportExportType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "generated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_tax_document_sequences" (
    "id" UUID NOT NULL,
    "financial_year" TEXT NOT NULL,
    "document_type" "TaxDocumentType" NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_tax_document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_tax_documents" (
    "id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_type" "TaxDocumentType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status" "TaxDocumentStatus" NOT NULL DEFAULT 'ISSUED',
    "idempotency_key" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "supplier_legal_name" TEXT NOT NULL,
    "supplier_gstin" TEXT NOT NULL,
    "supplier_address_snapshot" JSONB NOT NULL,
    "recipient_legal_name" TEXT NOT NULL,
    "recipient_gstin" TEXT,
    "recipient_address_snapshot" JSONB NOT NULL,
    "place_of_supply_state_code" TEXT,
    "supplyType" "TaxSupplyType",
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "cess_paise" INTEGER NOT NULL DEFAULT 0,
    "total_tax_paise" INTEGER NOT NULL DEFAULT 0,
    "invoice_value_paise" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "issued_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reverse_shipments" (
    "id" UUID NOT NULL,
    "return_request_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "assigned_partner_user_id" UUID,
    "mode" "ReverseShipmentMode" NOT NULL DEFAULT 'PLATFORM_PICKUP',
    "status" "ReverseShipmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "assignment_status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "awb_number" TEXT,
    "courier_name" TEXT,
    "tracking_reference" TEXT,
    "proof_reference" TEXT,
    "pickup_proof_reference" TEXT,
    "receipt_proof_reference" TEXT,
    "pickup_note" TEXT,
    "received_by_name" TEXT,
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "assignment_expires_at" TIMESTAMP(3),
    "assignment_note" TEXT,
    "picked_up_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reverse_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reverse_shipment_assignment_attempts" (
    "id" UUID NOT NULL,
    "return_request_id" UUID NOT NULL,
    "reverse_shipment_id" UUID NOT NULL,
    "partner_user_id" UUID NOT NULL,
    "source" "DeliveryAssignmentAttemptSource" NOT NULL,
    "status" "DeliveryAssignmentStatus" NOT NULL,
    "note" TEXT,
    "assigned_by_id" UUID,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reverse_shipment_assignment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reverse_shipment_events" (
    "id" UUID NOT NULL,
    "reverse_shipment_id" UUID NOT NULL,
    "old_status" "ReverseShipmentStatus",
    "new_status" "ReverseShipmentStatus" NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reverse_shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_details" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "partner_name" TEXT,
    "partner_phone" TEXT,
    "delivery_partner_user_id" UUID,
    "courier_provider_code" TEXT,
    "routing_failed" BOOLEAN NOT NULL DEFAULT false,
    "routing_failure_reason" "DeliveryRoutingFailureReason",
    "routing_failure_note" TEXT,
    "routed_at" TIMESTAMP(3),
    "assignment_status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "assignment_expires_at" TIMESTAMP(3),
    "assignment_note" TEXT,
    "shipping_charge_snapshot" JSONB,
    "cod_surcharge_snapshot" JSONB,
    "awb_number" TEXT,
    "courier_tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
    "label_url" TEXT,
    "tracking_reference" TEXT,
    "estimated_delivery_date" TIMESTAMP(3),
    "delivery_note" TEXT,
    "receiver_name" TEXT,
    "proof_note" TEXT,
    "proof_reference" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "cod_collection_status" "CodCollectionStatus" NOT NULL DEFAULT 'NOT_COLLECTED',
    "cod_collection_source" "CodCollectionSource",
    "cod_collected_amount_paise" INTEGER,
    "cod_collected_at" TIMESTAMP(3),
    "cod_collected_by_id" UUID,
    "cod_collection_note" TEXT,
    "cod_verified_at" TIMESTAMP(3),
    "cod_verified_by_id" UUID,
    "cod_verification_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignment_attempts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "delivery_detail_id" UUID NOT NULL,
    "partner_user_id" UUID NOT NULL,
    "source" "DeliveryAssignmentAttemptSource" NOT NULL,
    "status" "DeliveryAssignmentStatus" NOT NULL,
    "rejection_reason" "DeliveryAssignmentRejectionReason",
    "note" TEXT,
    "assigned_by_id" UUID,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_assignment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_shipments" (
    "id" UUID NOT NULL,
    "order_shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_order_id" TEXT,
    "awb_number" TEXT,
    "tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
    "tracking_status_label" TEXT,
    "tracking_url" TEXT,
    "label_url" TEXT,
    "booking_payload_snapshot" JSONB,
    "booking_response_snapshot" JSONB,
    "last_webhook_event_id" TEXT,
    "last_webhook_at" TIMESTAMP(3),
    "last_tracked_at" TIMESTAMP(3),
    "booking_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "booking_error" TEXT,
    "booked_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_consignments" (
    "id" UUID NOT NULL,
    "consignment_number" TEXT NOT NULL,
    "order_shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_order_id" TEXT,
    "pickup_location_name" TEXT,
    "tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
    "tracking_status_label" TEXT,
    "manifest_url" TEXT,
    "invoice_url" TEXT,
    "label_document_url" TEXT,
    "shipping_zone" TEXT,
    "provider_raw_status" TEXT,
    "provider_raw_status_code" TEXT,
    "booking_payload_snapshot" JSONB,
    "booking_response_snapshot" JSONB,
    "last_webhook_event_id" TEXT,
    "last_webhook_at" TIMESTAMP(3),
    "last_tracked_at" TIMESTAMP(3),
    "booking_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "booking_error" TEXT,
    "booked_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_consignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_consignment_packages" (
    "id" UUID NOT NULL,
    "courier_consignment_id" UUID NOT NULL,
    "order_shipment_package_id" UUID NOT NULL,
    "order_shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider_package_id" TEXT,
    "awb_number" TEXT,
    "courier_name" TEXT,
    "courier_code" TEXT,
    "tracking_status" "CourierShipmentStatus" NOT NULL DEFAULT 'NOT_BOOKED',
    "tracking_status_label" TEXT,
    "tracking_url" TEXT,
    "label_url" TEXT,
    "label_storage_key" TEXT,
    "label_content_type" TEXT,
    "label_fetched_at" TIMESTAMP(3),
    "manifest_url" TEXT,
    "invoice_url" TEXT,
    "shipping_zone" TEXT,
    "provider_raw_status" TEXT,
    "provider_raw_status_code" TEXT,
    "booked_at" TIMESTAMP(3),
    "pickup_scheduled_at" TIMESTAMP(3),
    "last_webhook_event_id" TEXT,
    "last_webhook_at" TIMESTAMP(3),
    "last_tracked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_consignment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_webhook_events" (
    "id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "awb_number" TEXT,
    "order_shipment_id" UUID,
    "status" "CourierWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,

    CONSTRAINT "courier_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_cod_remittances" (
    "id" UUID NOT NULL,
    "courier_shipment_id" UUID,
    "order_shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "awb_number" TEXT,
    "expected_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "collected_amount_paise" INTEGER,
    "remitted_amount_paise" INTEGER,
    "remittance_date" TIMESTAMP(3),
    "remittance_reference" TEXT,
    "report_reference" TEXT,
    "status" "CourierCodRemittanceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "verification_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_cod_remittances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" TEXT,
    "vehicle_number" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "base_latitude" DECIMAL(10,7),
    "base_longitude" DECIMAL(10,7),
    "service_radius_km" INTEGER,
    "cod_cash_limit_paise" INTEGER,
    "deposit_wallet_balance_paise" INTEGER NOT NULL DEFAULT 0,
    "razorpay_customer_id" TEXT,
    "razorpay_virtual_account_id" TEXT,
    "razorpay_virtual_upi_id" TEXT,
    "razorpay_virtual_account_provisioning_at" TIMESTAMP(3),
    "notes" TEXT,
    "service_country_code" TEXT,
    "service_state_code" TEXT,
    "service_city_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "DeliveryPartnerApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "vehicle_type" TEXT NOT NULL,
    "vehicle_number" TEXT NOT NULL,
    "driving_license_number" TEXT,
    "experience_summary" TEXT,
    "service_country_code" TEXT,
    "service_state_code" TEXT,
    "service_city_code" TEXT,
    "service_pincodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "service_local_area_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "area" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "base_latitude" DECIMAL(10,7),
    "base_longitude" DECIMAL(10,7),
    "location_source" "LocationSource",
    "accuracy_meters" DECIMAL(10,2),
    "location_confidence_score" DECIMAL(5,2),
    "service_radius_km" INTEGER,
    "availability_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partner_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_service_areas" (
    "id" UUID NOT NULL,
    "partner_profile_id" UUID NOT NULL,
    "country_code" TEXT,
    "state_code" TEXT,
    "city_code" TEXT,
    "pincode" TEXT,
    "local_area_code" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partner_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "delivery_detail_id" UUID NOT NULL,
    "reason" "DeliveryAttemptReason" NOT NULL,
    "note" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_attempt_date" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tracking_counters" (
    "date_key" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_tracking_counters_pkey" PRIMARY KEY ("date_key")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" UUID NOT NULL,
    "delivery_detail_id" UUID NOT NULL,
    "old_status" "DeliveryStatus",
    "new_status" "DeliveryStatus" NOT NULL,
    "note" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_wallet_entries" (
    "id" UUID NOT NULL,
    "partner_user_id" UUID NOT NULL,
    "order_id" UUID,
    "order_shipment_id" UUID,
    "delivery_detail_id" UUID,
    "reverse_shipment_id" UUID,
    "payout_id" UUID,
    "entry_type" "DeliveryPartnerWalletEntryType" NOT NULL,
    "direction" "DeliveryPartnerWalletEntryDirection" NOT NULL DEFAULT 'CREDIT',
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "metadata" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_partner_wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_payouts" (
    "id" UUID NOT NULL,
    "payout_number" TEXT NOT NULL,
    "partner_user_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "DeliveryPartnerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "settings_snapshot" JSONB,
    "requested_by_id" UUID,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "paid_by_id" UUID,
    "paid_at" TIMESTAMP(3),
    "payment_mode" TEXT,
    "transaction_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "method" TEXT,
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_order_id" TEXT,
    "provider_order_creation_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "provider_payment_id" TEXT,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "razorpay_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "RazorpayWebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "payload_hash" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_rates" (
    "id" UUID NOT NULL,
    "base_currency" TEXT NOT NULL,
    "quote_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_provider_settings" (
    "id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "adapter_code" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "api_base_url" TEXT,
    "api_key_encrypted" TEXT,
    "credentials_configured" BOOLEAN NOT NULL DEFAULT false,
    "timeout_ms" INTEGER NOT NULL DEFAULT 5000,
    "cache_ttl_minutes" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,
    "last_health_status" TEXT NOT NULL DEFAULT 'NEVER_TESTED',
    "last_checked_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_provider_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "FinanceRuleScope" NOT NULL,
    "seller_id" UUID,
    "category_id" UUID,
    "commission_type" "CommissionType" NOT NULL DEFAULT 'PERCENTAGE',
    "commission_value_bps" INTEGER,
    "commission_fixed_paise" INTEGER,
    "gst_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "tds_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "tcs_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_type" "CommissionType" NOT NULL DEFAULT 'MANUAL',
    "platform_fee_value_bps" INTEGER,
    "platform_fee_fixed_paise" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_settlement_runs" (
    "id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "status" "SellerPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "gross_sales_paise" INTEGER NOT NULL DEFAULT 0,
    "commission_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
    "tds_paise" INTEGER NOT NULL DEFAULT 0,
    "tcs_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "net_payable_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "created_by" UUID,
    "submitted_by" UUID,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_settlement_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payouts" (
    "id" UUID NOT NULL,
    "payout_number" TEXT NOT NULL,
    "settlement_run_id" UUID,
    "seller_id" UUID NOT NULL,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "status" "SellerPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "gross_sales_paise" INTEGER NOT NULL DEFAULT 0,
    "commission_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
    "tds_paise" INTEGER NOT NULL DEFAULT 0,
    "tcs_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "net_payable_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_mode" TEXT,
    "transaction_reference" TEXT,
    "note" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "paid_by" UUID,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payout_events" (
    "id" UUID NOT NULL,
    "payout_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "old_status" "SellerPayoutStatus",
    "new_status" "SellerPayoutStatus",
    "note" TEXT,
    "actor_user_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payout_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_ledger_entries" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "order_id" UUID,
    "order_seller_split_id" UUID,
    "service_booking_id" UUID,
    "service_settlement_id" UUID,
    "seller_cash_receivable_id" UUID,
    "payout_id" UUID,
    "entry_type" "SellerLedgerEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "debit_paise" INTEGER NOT NULL DEFAULT 0,
    "credit_paise" INTEGER NOT NULL DEFAULT 0,
    "balance_after_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reference_type" TEXT,
    "reference_id" TEXT,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_cash_receivables" (
    "id" UUID NOT NULL,
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
    "id" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "seller_statements" (
    "id" UUID NOT NULL,
    "statement_number" TEXT NOT NULL,
    "seller_id" UUID NOT NULL,
    "payout_id" UUID,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "gross_sales_paise" INTEGER NOT NULL DEFAULT 0,
    "commission_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
    "tds_paise" INTEGER NOT NULL DEFAULT 0,
    "tcs_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "net_payable_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SellerStatementStatus" NOT NULL DEFAULT 'GENERATED',
    "generated_by" UUID,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "old_status" "PaymentStatus",
    "new_status" "PaymentStatus",
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_listings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ServiceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "pricing_model" "ServicePricingModel" NOT NULL DEFAULT 'FIXED_PRICE',
    "payment_mode" "ServicePaymentMode" NOT NULL DEFAULT 'FULL_PAYMENT',
    "cancellation_policy" "ServiceCancellationPolicy" NOT NULL DEFAULT 'FLEXIBLE',
    "tax_classification" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "sac_code" TEXT,
    "gst_rate_percent" DECIMAL(5,2),
    "base_price_paise" INTEGER,
    "inspection_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "advance_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "quote_ttl_hours" INTEGER NOT NULL DEFAULT 48,
    "service_duration_minutes" INTEGER,
    "allowed_visit_modes" "ServiceVisitMode"[] DEFAULT ARRAY['CUSTOMER_LOCATION']::"ServiceVisitMode"[],
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "service_rating" DECIMAL(3,2),
    "service_review_count" INTEGER NOT NULL DEFAULT 0,
    "search_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" UUID NOT NULL,
    "service_listing_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "mrp_paise" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "duration_minutes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_listing_images" (
    "id" UUID NOT NULL,
    "service_listing_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" UUID NOT NULL,
    "service_listing_id" UUID NOT NULL,
    "label" TEXT,
    "country_code" TEXT,
    "state_code" TEXT,
    "city_code" TEXT,
    "local_area_code" TEXT,
    "pincode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "radius_km" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_bookings" (
    "id" UUID NOT NULL,
    "booking_number" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "customer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "service_listing_id" UUID NOT NULL,
    "service_package_id" UUID,
    "status" "ServiceBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "visit_mode" "ServiceVisitMode" NOT NULL,
    "payment_mode" "ServicePaymentMode" NOT NULL,
    "cancellation_policy" "ServiceCancellationPolicy" NOT NULL,
    "seller_tax_registration_status_snapshot" "SellerTaxRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "seller_legal_name_snapshot" TEXT NOT NULL,
    "seller_gstin_snapshot" TEXT,
    "seller_address_snapshot" JSONB NOT NULL,
    "buyer_legal_name_snapshot" TEXT NOT NULL,
    "buyer_gstin_snapshot" TEXT,
    "buyer_address_snapshot" JSONB NOT NULL,
    "service_tax_classification_snapshot" "ProductTaxClassification" NOT NULL DEFAULT 'TAXABLE',
    "sac_code_snapshot" TEXT,
    "gst_rate_percent_snapshot" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_supply_type_snapshot" "TaxSupplyType" NOT NULL DEFAULT 'INTER_STATE',
    "place_of_supply_state_code_snapshot" TEXT,
    "taxable_value_paise" INTEGER NOT NULL DEFAULT 0,
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "cess_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_total_paise" INTEGER NOT NULL DEFAULT 0,
    "scheduled_start_at" TIMESTAMP(3),
    "scheduled_end_at" TIMESTAMP(3),
    "assigned_technician_id" UUID,
    "address_snapshot" JSONB,
    "customer_issue" TEXT NOT NULL,
    "customer_note" TEXT,
    "provider_note" TEXT,
    "cancellation_reason" TEXT,
    "cancellation_initiator" "ServiceCancellationInitiator",
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "completion_note" TEXT,
    "completion_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completion_proof_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completion_submitted_at" TIMESTAMP(3),
    "completion_confirmed_by" UUID,
    "completion_confirmed_at" TIMESTAMP(3),
    "technician_en_route_at" TIMESTAMP(3),
    "technician_arrived_at" TIMESTAMP(3),
    "technician_check_in_at" TIMESTAMP(3),
    "technician_check_out_at" TIMESTAMP(3),
    "technician_field_status_note" TEXT,
    "technician_field_proof_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technician_last_latitude" DECIMAL(10,7),
    "technician_last_longitude" DECIMAL(10,7),
    "cancellation_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "cancellation_refund_paise" INTEGER NOT NULL DEFAULT 0,
    "cancellation_policy_snapshot" JSONB,
    "subtotal_paise" INTEGER NOT NULL DEFAULT 0,
    "inspection_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "advance_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "total_payable_paise" INTEGER NOT NULL DEFAULT 0,
    "paid_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_quotes" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "quote_number" TEXT NOT NULL,
    "status" "ServiceQuoteStatus" NOT NULL DEFAULT 'SENT',
    "subtotal_paise" INTEGER NOT NULL DEFAULT 0,
    "total_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "sent_by" UUID,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by" UUID,
    "withdrawal_note" TEXT,
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_quote_line_items" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "purpose" "ServicePaymentPurpose" NOT NULL,
    "collection_type" "ServicePaymentCollectionType" NOT NULL DEFAULT 'PLATFORM_ONLINE',
    "settlement_treatment" "ServicePaymentSettlementTreatment" NOT NULL DEFAULT 'PAYOUT_ELIGIBLE',
    "cash_collection_status" "ServiceCashCollectionStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "cash_collection_event_id" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "provider_order_id" TEXT,
    "provider_order_creation_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "provider_payment_id" TEXT,
    "reference_number" TEXT,
    "cash_collected_by" UUID,
    "cash_collected_at" TIMESTAMP(3),
    "customer_cash_confirmed_at" TIMESTAMP(3),
    "admin_cash_verified_at" TIMESTAMP(3),
    "cash_disputed_at" TIMESTAMP(3),
    "cash_dispute_reason" TEXT,
    "cash_dispute_resolution" "ServiceCashDisputeResolution",
    "cash_resolution_note" TEXT,
    "raw_response" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_payment_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "old_status" "PaymentStatus",
    "new_status" "PaymentStatus",
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_seller_receivables" (
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

-- CreateTable
CREATE TABLE "service_seller_receivable_events" (
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

-- CreateTable
CREATE TABLE "service_disputes" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "raised_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "admin_note" TEXT,
    "resolution" "ServiceDisputeResolution",
    "refund_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_request_id" UUID,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_refund_requests" (
    "id" UUID NOT NULL,
    "refund_number" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "service_payment_id" UUID,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason" "RefundReason" NOT NULL,
    "method" "RefundMethod",
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "note" TEXT,
    "provider_refund_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_refund_transactions" (
    "id" UUID NOT NULL,
    "service_refund_request_id" UUID NOT NULL,
    "service_payment_id" UUID,
    "provider" "PaymentProvider",
    "method" "RefundMethod" NOT NULL,
    "status" "RefundTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "idempotency_key" TEXT,
    "manual_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "provider_refund_id" TEXT,
    "provider_response" JSONB,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_refund_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_booking_settlements" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "payout_id" UUID,
    "gross_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "inspection_fee_gross_paise" INTEGER NOT NULL DEFAULT 0,
    "commission_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_on_commission_paise" INTEGER NOT NULL DEFAULT 0,
    "tds_paise" INTEGER NOT NULL DEFAULT 0,
    "tcs_paise" INTEGER NOT NULL DEFAULT 0,
    "platform_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "net_payable_paise" INTEGER NOT NULL DEFAULT 0,
    "status" "SellerSettlementStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "finance_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_booking_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "service_listing_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_review_replies" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_review_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_enquiries" (
    "id" UUID NOT NULL,
    "business_buyer_id" UUID NOT NULL,
    "idempotency_key" TEXT,
    "product_id" UUID,
    "seller_id" UUID,
    "quantity" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "transport_mode" "B2BTransportMode" NOT NULL DEFAULT 'SELLER_ARRANGED_TRANSPORT',
    "transport_note" TEXT,
    "status" "B2BEnquiryStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_enquiry_responses" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "responder_user_id" UUID NOT NULL,
    "response_message" TEXT NOT NULL,
    "quoted_price_paise" INTEGER,
    "transport_charge_paise" INTEGER,
    "transport_eta" TEXT,
    "transport_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_enquiry_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_enquiry_messages" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_enquiry_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "business_buyer_id" UUID NOT NULL,
    "seller_id" UUID,
    "product_id" UUID,
    "selected_response_id" UUID,
    "status" "B2BOrderStatus" NOT NULL DEFAULT 'PROFORMA_ISSUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "payment_term_type" "B2BPaymentTermType" NOT NULL DEFAULT 'PREPAID_FULL',
    "legacy_migration_review_required" BOOLEAN NOT NULL DEFAULT false,
    "proforma_invoice_number" TEXT NOT NULL,
    "proforma_issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proforma_expires_at" TIMESTAMP(3),
    "proforma_invoice_file_key" TEXT,
    "tax_invoice_number" TEXT,
    "tax_invoice_issued_at" TIMESTAMP(3),
    "tax_invoice_file_key" TEXT,
    "purchase_order_number" TEXT,
    "purchase_order_file_key" TEXT,
    "purchase_order_note" TEXT,
    "purchase_order_submitted_at" TIMESTAMP(3),
    "purchase_order_accepted_at" TIMESTAMP(3),
    "fulfilled_at" TIMESTAMP(3),
    "payout_id" UUID,
    "settlement_status" "SellerSettlementStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "settlement_eligible_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" INTEGER,
    "subtotal_paise" INTEGER,
    "commission_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "commission_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "seller_payout_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_status" "B2BPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "B2BPaymentMethod",
    "buyer_payable_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "transport_mode" "B2BTransportMode" NOT NULL DEFAULT 'SELLER_ARRANGED_TRANSPORT',
    "transport_status" "B2BTransportStatus" NOT NULL DEFAULT 'REQUESTED',
    "transport_charge_paise" INTEGER NOT NULL DEFAULT 0,
    "transport_charge_locked_at" TIMESTAMP(3),
    "transport_quoted_at" TIMESTAMP(3),
    "transport_partner_name" TEXT,
    "transport_partner_phone" TEXT,
    "transport_tracking_ref" TEXT,
    "transport_eta" TEXT,
    "transport_dispatched_at" TIMESTAMP(3),
    "transport_delivered_at" TIMESTAMP(3),
    "transport_pickup_address" TEXT,
    "transport_note" TEXT,
    "delivery_address_snapshot" JSONB,
    "paid_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "payment_due_at" TIMESTAMP(3) NOT NULL,
    "payment_overdue_at" TIMESTAMP(3),
    "payment_verified_by_id" UUID,
    "payment_verified_at" TIMESTAMP(3),
    "fulfilment_unlocked_by_id" UUID,
    "fulfilment_unlocked_at" TIMESTAMP(3),
    "fulfilment_unlock_note" TEXT,
    "terms_snapshot" JSONB,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_order_events" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "status" "B2BOrderStatus" NOT NULL,
    "note" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_payment_proofs" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "method" "B2BPaymentMethod" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "overpayment_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "reference_number" TEXT,
    "proof_file_key" TEXT,
    "razorpay_payment_id" TEXT,
    "submitted_by_user_id" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "B2BProofStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_proforma_invoice_revisions" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "generated_by_user_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_proforma_invoice_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_admin_audit_logs" (
    "id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_type" "B2BAuditActorType" NOT NULL,
    "action" "B2BAdminAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "b2b_order_amendments" (
    "id" UUID NOT NULL,
    "amendment_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "status" "B2BOrderAmendmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "base_order_version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "line_changes" JSONB,
    "delivery_address_snapshot" JSONB,
    "payment_due_at" TIMESTAMP(3),
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB,
    "decision_reason" TEXT,
    "requested_by_user_id" UUID NOT NULL,
    "decided_by_user_id" UUID,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_order_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_dispute_resolutions" (
    "id" UUID NOT NULL,
    "resolution_number" TEXT NOT NULL,
    "support_case_id" UUID NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "b2b_order_line_id" UUID,
    "shipment_id" UUID,
    "resolution_type" "B2BDisputeResolutionType" NOT NULL,
    "accepted_quantity" INTEGER NOT NULL DEFAULT 0,
    "rejected_quantity" INTEGER NOT NULL DEFAULT 0,
    "return_quantity" INTEGER NOT NULL DEFAULT 0,
    "replacement_quantity" INTEGER NOT NULL DEFAULT 0,
    "refund_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "receivable_adjustment_paise" INTEGER NOT NULL DEFAULT 0,
    "credit_note_tax_document_id" UUID,
    "replacement_enquiry_id" UUID,
    "reason" TEXT NOT NULL,
    "resolved_by_user_id" UUID NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_dispute_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_financial_reconciliations" (
    "id" UUID NOT NULL,
    "reconciliation_number" TEXT NOT NULL,
    "b2b_order_id" UUID NOT NULL,
    "status" "B2BFinancialReconciliationStatus" NOT NULL,
    "expected_paid_amount_paise" INTEGER NOT NULL,
    "actual_paid_amount_paise" INTEGER NOT NULL,
    "expected_outstanding_paise" INTEGER NOT NULL,
    "actual_outstanding_paise" INTEGER,
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "discrepancy" JSONB,
    "note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_financial_reconciliations_pkey" PRIMARY KEY ("id")
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
    "file_key" TEXT,
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

-- CreateTable
CREATE TABLE "cms_announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "link_url" TEXT,
    "background_color" TEXT,
    "text_color" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT,
    "link_url" TEXT,
    "eyebrow" TEXT,
    "cta_label" TEXT,
    "secondary_cta_label" TEXT,
    "secondary_link_url" TEXT,
    "mobile_image_url" TEXT,
    "image_alt" TEXT,
    "text_position" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_sections" (
    "id" UUID NOT NULL,
    "section_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_entries" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "entity_type" "SeoEntityType" NOT NULL,
    "entity_id" TEXT,
    "route_path" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "canonical_url" TEXT,
    "robots_directive" TEXT NOT NULL DEFAULT 'index,follow',
    "og_title" TEXT,
    "og_description" TEXT,
    "og_image_url" TEXT,
    "twitter_title" TEXT,
    "twitter_description" TEXT,
    "twitter_image_url" TEXT,
    "focus_keyword" TEXT,
    "structured_data_type" TEXT,
    "seo_score" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_redirects" (
    "id" UUID NOT NULL,
    "source_path" TEXT NOT NULL,
    "target_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_media_assets" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "asset_id" TEXT,
    "media_type" TEXT NOT NULL DEFAULT 'image',
    "alt_text" TEXT,
    "caption" TEXT,
    "usage_context" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_revisions" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_menu_items" (
    "id" UUID NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'header',
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "parent_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "topic" "SupportRequestTopic" NOT NULL DEFAULT 'GENERAL',
    "requester_type" "SupportRequesterType" NOT NULL DEFAULT 'CUSTOMER',
    "preferred_contact_channel" "SupportContactChannel" NOT NULL DEFAULT 'EMAIL',
    "source" "SupportRequestSource" NOT NULL DEFAULT 'WEB_CONTACT',
    "order_number" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "admin_note" TEXT,
    "response_message" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_to_user_id" UUID,
    "order_id" UUID,
    "product_id" UUID,
    "b2b_enquiry_id" UUID,
    "support_request_id" UUID,
    "requester_type" "ChatRequesterType" NOT NULL,
    "topic" "SupportRequestTopic" NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT NOT NULL,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ChatConversationPriority" NOT NULL DEFAULT 'NORMAL',
    "sensitivity" "ChatConversationSensitivity" NOT NULL DEFAULT 'NORMAL',
    "escalation_reason" "ChatEscalationReason",
    "handover_requested_at" TIMESTAMP(3),
    "first_response_due_at" TIMESTAMP(3),
    "next_response_due_at" TIMESTAMP(3),
    "sla_breached_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_user_message_at" TIMESTAMP(3),
    "last_staff_message_at" TIMESTAMP(3),
    "user_unread_count" INTEGER NOT NULL DEFAULT 0,
    "staff_unread_count" INTEGER NOT NULL DEFAULT 0,
    "retention_until" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_type" "ChatMessageSenderType" NOT NULL,
    "message_type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "visible_to_user" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "read_by_user_at" TIMESTAMP(3),
    "read_by_staff_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_assignments" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "created_by_id" UUID,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversation_events" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_bot_runs" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID,
    "provider" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "source_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ChatAiRunStatus" NOT NULL DEFAULT 'NOT_USED',
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "error_class" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_bot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rate_limit_buckets" (
    "id" UUID NOT NULL,
    "scope_key" TEXT NOT NULL,
    "action" "ChatRateLimitAction" NOT NULL,
    "bucket_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_ai_usage_summaries" (
    "id" UUID NOT NULL,
    "subject_key" TEXT NOT NULL,
    "user_id" UUID,
    "usage_date" DATE NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'disabled',
    "model" TEXT NOT NULL DEFAULT 'none',
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_ai_usage_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "category" "EmailTemplateCategory" NOT NULL DEFAULT 'SYSTEM',
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "theme_id" UUID,
    "style_overrides" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_trigger_rules" (
    "id" UUID NOT NULL,
    "event_code" TEXT NOT NULL,
    "recipient_type" "EmailRecipientType" NOT NULL,
    "category" "EmailTemplateCategory" NOT NULL,
    "template_id" UUID,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "delay_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_trigger_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_themes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "tokens" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "customer_notification_id" UUID,
    "customer_push_token_id" UUID,
    "push_campaign_batch_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "template_code" TEXT NOT NULL,
    "event_code" TEXT,
    "recipient_type" "EmailRecipientType",
    "trigger_rule_id" UUID,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "variables" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "PushNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "href" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_campaigns" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_asset_key" TEXT,
    "image_url" TEXT,
    "href" TEXT,
    "segment_filter" JSONB NOT NULL,
    "status" "PushNotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "preview_count" INTEGER NOT NULL DEFAULT 0,
    "targeted_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_campaign_batches" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "status" "PushNotificationBatchStatus" NOT NULL DEFAULT 'PENDING',
    "recipient_token_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "ticket_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticket_errors" JSONB,
    "claimed_by" TEXT,
    "claimed_at" TIMESTAMP(3),
    "done_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_notification_campaign_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_receipts" (
    "id" UUID NOT NULL,
    "notification_log_id" UUID NOT NULL,
    "customer_push_token_id" UUID,
    "campaign_batch_id" UUID,
    "ticket_id" TEXT,
    "receipt_id" TEXT,
    "status" "PushNotificationReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "provider_status" TEXT,
    "provider_details" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "check_after" TIMESTAMP(3),
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_notification_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_settings" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "admin_recipients" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "value_type" "SettingValueType" NOT NULL,
    "group" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rate_cards" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "country_code" TEXT,
    "state_code" TEXT,
    "city_code" TEXT,
    "pincode" TEXT,
    "local_area_code" TEXT,
    "min_subtotal_paise" INTEGER,
    "max_subtotal_paise" INTEGER,
    "max_weight_kg" DECIMAL(10,3),
    "pricing_type" "ShippingPricingType" NOT NULL DEFAULT 'FLAT',
    "shipping_charge_paise" INTEGER NOT NULL DEFAULT 0,
    "pricing_config" JSONB,
    "free_above_paise" INTEGER,
    "cod_surcharge_type" "ShippingCodSurchargeType" NOT NULL DEFAULT 'NONE',
    "cod_surcharge_flat_paise" INTEGER NOT NULL DEFAULT 0,
    "cod_surcharge_bps" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_provider_settings" (
    "id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "mode" "CourierProviderMode" NOT NULL DEFAULT 'MANUAL',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "serviceable_country_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credentials_configured" BOOLEAN NOT NULL DEFAULT false,
    "webhook_secret_configured" BOOLEAN NOT NULL DEFAULT false,
    "settings_snapshot" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_provider_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_credentials_user_id_key" ON "admin_credentials"("user_id");

-- CreateIndex
CREATE INDEX "admin_credentials_locked_until_idx" ON "admin_credentials"("locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_user_id_idx" ON "admin_sessions"("user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "admin_sessions_revoked_at_idx" ON "admin_sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "customers_status_created_at_idx" ON "customers"("status", "created_at");

-- CreateIndex
CREATE INDEX "customers_deal_alerts_enabled_idx" ON "customers"("deal_alerts_enabled");

-- CreateIndex
CREATE INDEX "customers_marketing_campaigns_enabled_idx" ON "customers"("marketing_campaigns_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "customer_push_tokens_token_key" ON "customer_push_tokens"("token");

-- CreateIndex
CREATE INDEX "customer_push_tokens_customer_id_enabled_idx" ON "customer_push_tokens"("customer_id", "enabled");

-- CreateIndex
CREATE INDEX "customer_push_tokens_user_id_enabled_idx" ON "customer_push_tokens"("user_id", "enabled");

-- CreateIndex
CREATE INDEX "customer_push_tokens_last_seen_at_idx" ON "customer_push_tokens"("last_seen_at");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE INDEX "customer_addresses_city_pincode_idx" ON "customer_addresses"("city", "pincode");

-- CreateIndex
CREATE INDEX "customer_addresses_country_code_state_code_city_code_idx" ON "customer_addresses"("country_code", "state_code", "city_code");

-- CreateIndex
CREATE INDEX "customer_addresses_latitude_longitude_idx" ON "customer_addresses"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_customer_id_key" ON "wishlists"("customer_id");

-- CreateIndex
CREATE INDEX "wishlist_items_product_id_idx" ON "wishlist_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlist_id_product_id_key" ON "wishlist_items"("wishlist_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_slug_key" ON "sellers"("slug");

-- CreateIndex
CREATE INDEX "sellers_approval_status_idx" ON "sellers"("approval_status");

-- CreateIndex
CREATE INDEX "sellers_seller_type_idx" ON "sellers"("seller_type");

-- CreateIndex
CREATE INDEX "sellers_primary_capability_idx" ON "sellers"("primary_capability");

-- CreateIndex
CREATE INDEX "sellers_enabled_capabilities_idx" ON "sellers" USING GIN ("enabled_capabilities");

-- CreateIndex
CREATE INDEX "sellers_subscription_plan_id_idx" ON "sellers"("subscription_plan_id");

-- CreateIndex
CREATE INDEX "sellers_subscription_status_idx" ON "sellers"("subscription_status");

-- CreateIndex
CREATE INDEX "sellers_deleted_at_created_at_idx" ON "sellers"("deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "sellers_status_approval_status_created_at_idx" ON "sellers"("status", "approval_status", "created_at");

-- CreateIndex
CREATE INDEX "sellers_store_name_idx" ON "sellers" USING GIN ("store_name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "seller_push_tokens_token_key" ON "seller_push_tokens"("token");

-- CreateIndex
CREATE INDEX "seller_push_tokens_seller_id_enabled_idx" ON "seller_push_tokens"("seller_id", "enabled");

-- CreateIndex
CREATE INDEX "seller_push_tokens_user_id_enabled_idx" ON "seller_push_tokens"("user_id", "enabled");

-- CreateIndex
CREATE INDEX "seller_push_tokens_last_seen_at_idx" ON "seller_push_tokens"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_push_tokens_token_key" ON "delivery_push_tokens"("token");

-- CreateIndex
CREATE INDEX "delivery_push_tokens_user_id_enabled_idx" ON "delivery_push_tokens"("user_id", "enabled");

-- CreateIndex
CREATE INDEX "delivery_push_tokens_last_seen_at_idx" ON "delivery_push_tokens"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_seller_id_key" ON "seller_profiles"("seller_id");

-- CreateIndex
CREATE INDEX "seller_addresses_seller_id_idx" ON "seller_addresses"("seller_id");

-- CreateIndex
CREATE INDEX "seller_addresses_city_area_idx" ON "seller_addresses"("city", "area");

-- CreateIndex
CREATE INDEX "seller_addresses_country_code_state_code_city_code_idx" ON "seller_addresses"("country_code", "state_code", "city_code");

-- CreateIndex
CREATE INDEX "seller_service_areas_seller_id_is_active_idx" ON "seller_service_areas"("seller_id", "is_active");

-- CreateIndex
CREATE INDEX "seller_service_areas_country_code_state_code_city_code_idx" ON "seller_service_areas"("country_code", "state_code", "city_code");

-- CreateIndex
CREATE INDEX "seller_service_areas_local_area_code_idx" ON "seller_service_areas"("local_area_code");

-- CreateIndex
CREATE INDEX "seller_service_areas_pincode_idx" ON "seller_service_areas"("pincode");

-- CreateIndex
CREATE INDEX "seller_service_technicians_seller_id_is_active_idx" ON "seller_service_technicians"("seller_id", "is_active");

-- CreateIndex
CREATE INDEX "seller_service_availability_rules_seller_id_day_of_week_is__idx" ON "seller_service_availability_rules"("seller_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "seller_service_blocked_windows_seller_id_starts_at_ends_at_idx" ON "seller_service_blocked_windows"("seller_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "seller_courier_provider_settings_provider_code_is_active_idx" ON "seller_courier_provider_settings"("provider_code", "is_active");

-- CreateIndex
CREATE INDEX "seller_courier_provider_settings_seller_id_is_active_idx" ON "seller_courier_provider_settings"("seller_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "seller_courier_provider_settings_seller_id_provider_code_key" ON "seller_courier_provider_settings"("seller_id", "provider_code");

-- CreateIndex
CREATE INDEX "seller_documents_status_idx" ON "seller_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_documents_seller_id_document_type_key" ON "seller_documents"("seller_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "private_uploads_asset_key_key" ON "private_uploads"("asset_key");

-- CreateIndex
CREATE INDEX "private_uploads_provider_created_at_idx" ON "private_uploads"("provider", "created_at");

-- CreateIndex
CREATE INDEX "private_uploads_upload_kind_created_at_idx" ON "private_uploads"("upload_kind", "created_at");

-- CreateIndex
CREATE INDEX "private_uploads_deleted_at_created_at_idx" ON "private_uploads"("deleted_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_payout_profiles_seller_id_key" ON "seller_payout_profiles"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscription_plans_code_key" ON "seller_subscription_plans"("code");

-- CreateIndex
CREATE INDEX "seller_subscription_plans_is_active_sort_order_idx" ON "seller_subscription_plans"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "seller_subscription_plans_audience_is_active_sort_order_idx" ON "seller_subscription_plans"("audience", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "seller_subscription_plans_is_default_idx" ON "seller_subscription_plans"("is_default");

-- CreateIndex
CREATE INDEX "seller_subscription_plans_provider_plan_id_idx" ON "seller_subscription_plans"("provider_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscriptions_provider_subscription_id_key" ON "seller_subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "seller_subscriptions_seller_id_is_current_idx" ON "seller_subscriptions"("seller_id", "is_current");

-- CreateIndex
CREATE INDEX "seller_subscriptions_seller_id_status_idx" ON "seller_subscriptions"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_subscriptions_plan_id_idx" ON "seller_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "seller_subscriptions_provider_plan_id_idx" ON "seller_subscriptions"("provider_plan_id");

-- CreateIndex
CREATE INDEX "seller_subscriptions_provider_status_idx" ON "seller_subscriptions"("provider_status");

-- CreateIndex
CREATE INDEX "seller_subscriptions_grace_period_ends_at_idx" ON "seller_subscriptions"("grace_period_ends_at");

-- CreateIndex
CREATE INDEX "seller_subscription_payments_seller_id_created_at_idx" ON "seller_subscription_payments"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_subscription_payments_seller_subscription_id_idx" ON "seller_subscription_payments"("seller_subscription_id");

-- CreateIndex
CREATE INDEX "seller_subscription_payments_provider_subscription_id_idx" ON "seller_subscription_payments"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "seller_subscription_payments_status_idx" ON "seller_subscription_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscription_payments_provider_provider_invoice_id_key" ON "seller_subscription_payments"("provider", "provider_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscription_payments_provider_provider_payment_id_key" ON "seller_subscription_payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE INDEX "seller_subscription_provider_events_seller_subscription_id_idx" ON "seller_subscription_provider_events"("seller_subscription_id");

-- CreateIndex
CREATE INDEX "seller_subscription_provider_events_event_type_idx" ON "seller_subscription_provider_events"("event_type");

-- CreateIndex
CREATE INDEX "seller_subscription_provider_events_status_idx" ON "seller_subscription_provider_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscription_provider_events_provider_provider_event_key" ON "seller_subscription_provider_events"("provider", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_buyers_user_id_key" ON "business_buyers"("user_id");

-- CreateIndex
CREATE INDEX "business_buyers_status_idx" ON "business_buyers"("status");

-- CreateIndex
CREATE INDEX "business_buyer_addresses_business_buyer_id_idx" ON "business_buyer_addresses"("business_buyer_id");

-- CreateIndex
CREATE INDEX "business_buyer_addresses_country_code_state_code_city_code_idx" ON "business_buyer_addresses"("country_code", "state_code", "city_code");

-- CreateIndex
CREATE UNIQUE INDEX "location_countries_code_key" ON "location_countries"("code");

-- CreateIndex
CREATE INDEX "location_countries_enabled_sort_order_idx" ON "location_countries"("enabled", "sort_order");

-- CreateIndex
CREATE INDEX "location_countries_name_idx" ON "location_countries"("name");

-- CreateIndex
CREATE INDEX "location_subdivisions_country_id_active_sort_order_idx" ON "location_subdivisions"("country_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "location_subdivisions_name_idx" ON "location_subdivisions"("name");

-- CreateIndex
CREATE INDEX "location_subdivisions_source_idx" ON "location_subdivisions"("source");

-- CreateIndex
CREATE UNIQUE INDEX "location_subdivisions_country_id_code_key" ON "location_subdivisions"("country_id", "code");

-- CreateIndex
CREATE INDEX "location_cities_subdivision_id_active_sort_order_idx" ON "location_cities"("subdivision_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "idx_location_cities_code_active" ON "location_cities"("code", "active");

-- CreateIndex
CREATE INDEX "location_cities_name_idx" ON "location_cities"("name");

-- CreateIndex
CREATE INDEX "location_cities_source_idx" ON "location_cities"("source");

-- CreateIndex
CREATE UNIQUE INDEX "location_cities_subdivision_id_code_key" ON "location_cities"("subdivision_id", "code");

-- CreateIndex
CREATE INDEX "location_areas_city_id_active_sort_order_idx" ON "location_areas"("city_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "idx_location_areas_city_postal" ON "location_areas"("city_id", "postal_code");

-- CreateIndex
CREATE INDEX "idx_location_areas_code" ON "location_areas"("code");

-- CreateIndex
CREATE INDEX "location_areas_name_idx" ON "location_areas"("name");

-- CreateIndex
CREATE INDEX "idx_location_areas_postal_active_sort" ON "location_areas"("postal_code", "active", "sort_order");

-- CreateIndex
CREATE INDEX "location_areas_source_idx" ON "location_areas"("source");

-- CreateIndex
CREATE UNIQUE INDEX "location_areas_city_id_code_key" ON "location_areas"("city_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "location_import_sources_code_key" ON "location_import_sources"("code");

-- CreateIndex
CREATE INDEX "location_import_sources_enabled_idx" ON "location_import_sources"("enabled");

-- CreateIndex
CREATE INDEX "location_import_sources_country_code_idx" ON "location_import_sources"("country_code");

-- CreateIndex
CREATE INDEX "location_import_runs_source_id_started_at_idx" ON "location_import_runs"("source_id", "started_at");

-- CreateIndex
CREATE INDEX "location_import_runs_country_code_idx" ON "location_import_runs"("country_code");

-- CreateIndex
CREATE INDEX "location_import_runs_status_idx" ON "location_import_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_product_template_id_idx" ON "categories"("product_template_id");

-- CreateIndex
CREATE INDEX "categories_status_idx" ON "categories"("status");

-- CreateIndex
CREATE INDEX "categories_default_hsn_code_idx" ON "categories"("default_hsn_code");

-- CreateIndex
CREATE INDEX "hsn_master_gst_rate_percent_idx" ON "hsn_master"("gst_rate_percent");

-- CreateIndex
CREATE INDEX "hsn_master_category_id_idx" ON "hsn_master"("category_id");

-- CreateIndex
CREATE INDEX "hsn_master_is_active_idx" ON "hsn_master"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "hsn_master_hsn_code_category_id_key" ON "hsn_master"("hsn_code", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_templates_code_key" ON "product_templates"("code");

-- CreateIndex
CREATE INDEX "product_templates_status_idx" ON "product_templates"("status");

-- CreateIndex
CREATE INDEX "product_templates_sort_order_idx" ON "product_templates"("sort_order");

-- CreateIndex
CREATE INDEX "product_template_fields_scope_idx" ON "product_template_fields"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "product_template_fields_product_template_id_field_key_scope_key" ON "product_template_fields"("product_template_id", "field_key", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_approval_status_idx" ON "products"("approval_status");

-- CreateIndex
CREATE INDEX "products_listing_mode_idx" ON "products"("listing_mode");

-- CreateIndex
CREATE INDEX "products_hsn_code_idx" ON "products"("hsn_code");

-- CreateIndex
CREATE INDEX "products_gst_rate_percent_idx" ON "products"("gst_rate_percent");

-- CreateIndex
CREATE INDEX "products_hsn_master_id_idx" ON "products"("hsn_master_id");

-- CreateIndex
CREATE INDEX "products_deleted_at_status_approval_status_created_at_idx" ON "products"("deleted_at", "status", "approval_status", "created_at");

-- CreateIndex
CREATE INDEX "products_category_id_status_approval_status_created_at_idx" ON "products"("category_id", "status", "approval_status", "created_at");

-- CreateIndex
CREATE INDEX "products_seller_id_deleted_at_created_at_idx" ON "products"("seller_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "products_is_featured_created_at_idx" ON "products"("is_featured", "created_at");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_attributes_idx" ON "products" USING GIN ("attributes" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "product_delivery_modes_product_id_is_enabled_idx" ON "product_delivery_modes"("product_id", "is_enabled");

-- CreateIndex
CREATE INDEX "product_delivery_modes_delivery_mode_is_enabled_idx" ON "product_delivery_modes"("delivery_mode", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "product_delivery_modes_product_id_delivery_mode_key" ON "product_delivery_modes"("product_id", "delivery_mode");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_status_created_at_idx" ON "product_variants"("product_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "product_variants_status_stock_quantity_idx" ON "product_variants"("status", "stock_quantity");

-- CreateIndex
CREATE INDEX "product_variants_attributes_idx" ON "product_variants" USING GIN ("attributes" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "inventory_movements_product_variant_id_idx" ON "inventory_movements"("product_variant_id");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_type_idx" ON "inventory_movements"("movement_type");

-- CreateIndex
CREATE INDEX "inventory_movements_created_by_idx" ON "inventory_movements"("created_by");

-- CreateIndex
CREATE INDEX "deals_category_id_idx" ON "deals"("category_id");

-- CreateIndex
CREATE INDEX "deals_status_starts_at_ends_at_idx" ON "deals"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "deals_join_deadline_idx" ON "deals"("join_deadline");

-- CreateIndex
CREATE INDEX "deals_created_by_idx" ON "deals"("created_by");

-- CreateIndex
CREATE INDEX "deals_updated_by_idx" ON "deals"("updated_by");

-- CreateIndex
CREATE INDEX "deal_participations_seller_id_status_idx" ON "deal_participations"("seller_id", "status");

-- CreateIndex
CREATE INDEX "deal_participations_deal_id_status_idx" ON "deal_participations"("deal_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deal_participations_deal_id_seller_id_key" ON "deal_participations"("deal_id", "seller_id");

-- CreateIndex
CREATE INDEX "deal_product_enrollments_deal_id_status_idx" ON "deal_product_enrollments"("deal_id", "status");

-- CreateIndex
CREATE INDEX "deal_product_enrollments_seller_id_status_idx" ON "deal_product_enrollments"("seller_id", "status");

-- CreateIndex
CREATE INDEX "deal_product_enrollments_product_id_status_idx" ON "deal_product_enrollments"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deal_product_enrollments_deal_id_product_id_key" ON "deal_product_enrollments"("deal_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_status_starts_at_ends_at_idx" ON "coupons"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "coupons_funding_source_status_idx" ON "coupons"("funding_source", "status");

-- CreateIndex
CREATE INDEX "coupons_is_marketplace_wide_status_idx" ON "coupons"("is_marketplace_wide", "status");

-- CreateIndex
CREATE INDEX "coupons_created_at_idx" ON "coupons"("created_at");

-- CreateIndex
CREATE INDEX "coupons_created_by_idx" ON "coupons"("created_by");

-- CreateIndex
CREATE INDEX "coupons_updated_by_idx" ON "coupons"("updated_by");

-- CreateIndex
CREATE INDEX "coupon_usage_counters_used_count_idx" ON "coupon_usage_counters"("used_count");

-- CreateIndex
CREATE INDEX "coupon_usage_counters_coupon_id_idx" ON "coupon_usage_counters"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_seller_eligibilities_seller_id_idx" ON "coupon_seller_eligibilities"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_seller_eligibilities_coupon_id_seller_id_key" ON "coupon_seller_eligibilities"("coupon_id", "seller_id");

-- CreateIndex
CREATE INDEX "coupon_product_eligibilities_product_id_idx" ON "coupon_product_eligibilities"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_product_eligibilities_coupon_id_product_id_key" ON "coupon_product_eligibilities"("coupon_id", "product_id");

-- CreateIndex
CREATE INDEX "coupon_category_eligibilities_category_id_idx" ON "coupon_category_eligibilities"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_category_eligibilities_coupon_id_category_id_key" ON "coupon_category_eligibilities"("coupon_id", "category_id");

-- CreateIndex
CREATE INDEX "coupon_customer_eligibilities_customer_id_idx" ON "coupon_customer_eligibilities"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_customer_eligibilities_coupon_id_customer_id_key" ON "coupon_customer_eligibilities"("coupon_id", "customer_id");

-- CreateIndex
CREATE INDEX "coupon_seller_participations_seller_id_status_idx" ON "coupon_seller_participations"("seller_id", "status");

-- CreateIndex
CREATE INDEX "coupon_seller_participations_coupon_id_status_idx" ON "coupon_seller_participations"("coupon_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_seller_participations_coupon_id_seller_id_key" ON "coupon_seller_participations"("coupon_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_status_created_at_idx" ON "coupon_redemptions"("coupon_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "coupon_redemptions_customer_id_coupon_id_status_idx" ON "coupon_redemptions"("customer_id", "coupon_id", "status");

-- CreateIndex
CREATE INDEX "coupon_redemptions_customer_id_created_at_idx" ON "coupon_redemptions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "coupon_redemption_adjustments_coupon_redemption_id_created__idx" ON "coupon_redemption_adjustments"("coupon_redemption_id", "created_at");

-- CreateIndex
CREATE INDEX "coupon_redemption_adjustments_order_id_created_at_idx" ON "coupon_redemption_adjustments"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "coupon_redemption_adjustments_order_item_id_idx" ON "coupon_redemption_adjustments"("order_item_id");

-- CreateIndex
CREATE INDEX "coupon_redemption_adjustments_order_seller_split_id_idx" ON "coupon_redemption_adjustments"("order_seller_split_id");

-- CreateIndex
CREATE INDEX "coupon_redemption_adjustments_created_by_idx" ON "coupon_redemption_adjustments"("created_by");

-- CreateIndex
CREATE INDEX "carts_customer_id_status_idx" ON "carts"("customer_id", "status");

-- CreateIndex
CREATE INDEX "cart_items_seller_id_idx" ON "cart_items"("seller_id");

-- CreateIndex
CREATE INDEX "cart_items_product_variant_id_idx" ON "cart_items"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_variant_id_key" ON "cart_items"("cart_id", "product_variant_id");

-- CreateIndex
CREATE INDEX "checkout_sessions_customer_id_idx" ON "checkout_sessions"("customer_id");

-- CreateIndex
CREATE INDEX "checkout_sessions_cart_id_idx" ON "checkout_sessions"("cart_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkout_session_id_key" ON "orders"("checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_replacement_return_request_id_key" ON "orders"("replacement_return_request_id");

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- CreateIndex
CREATE INDEX "orders_coupon_code_idx" ON "orders"("coupon_code");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_order_status_created_at_idx" ON "orders"("order_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_delivery_status_created_at_idx" ON "orders"("delivery_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_order_kind_created_at_idx" ON "orders"("order_kind", "created_at");

-- CreateIndex
CREATE INDEX "orders_parent_order_id_idx" ON "orders"("parent_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_customer_id_idempotency_key_key" ON "orders"("customer_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_deal_id_idx" ON "order_items"("deal_id");

-- CreateIndex
CREATE INDEX "order_items_replacement_source_order_item_id_idx" ON "order_items"("replacement_source_order_item_id");

-- CreateIndex
CREATE INDEX "order_items_replacement_source_return_item_id_idx" ON "order_items"("replacement_source_return_item_id");

-- CreateIndex
CREATE INDEX "order_items_coupon_discount_paise_idx" ON "order_items"("coupon_discount_paise");

-- CreateIndex
CREATE INDEX "order_items_lifecycle_status_idx" ON "order_items"("lifecycle_status");

-- CreateIndex
CREATE INDEX "order_items_order_id_lifecycle_status_idx" ON "order_items"("order_id", "lifecycle_status");

-- CreateIndex
CREATE INDEX "order_items_seller_id_lifecycle_status_idx" ON "order_items"("seller_id", "lifecycle_status");

-- CreateIndex
CREATE INDEX "order_items_hsn_code_snapshot_created_at_idx" ON "order_items"("hsn_code_snapshot", "created_at");

-- CreateIndex
CREATE INDEX "order_items_gst_rate_percent_snapshot_created_at_idx" ON "order_items"("gst_rate_percent_snapshot", "created_at");

-- CreateIndex
CREATE INDEX "order_items_product_variant_id_idx" ON "order_items"("product_variant_id");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_created_at_idx" ON "product_reviews"("product_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_seller_id_status_created_at_idx" ON "product_reviews"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_customer_id_created_at_idx" ON "product_reviews"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_status_created_at_idx" ON "product_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_order_id_idx" ON "product_reviews"("order_id");

-- CreateIndex
CREATE INDEX "product_reviews_order_item_id_idx" ON "product_reviews"("order_item_id");

-- CreateIndex
CREATE INDEX "product_reviews_moderated_by_id_idx" ON "product_reviews"("moderated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_customer_id_product_id_key" ON "product_reviews"("customer_id", "product_id");

-- CreateIndex
CREATE INDEX "search_documents_entity_type_visibility_status_updated_at_idx" ON "search_documents"("entity_type", "visibility_status", "updated_at");

-- CreateIndex
CREATE INDEX "search_documents_category_id_entity_type_visibility_status_idx" ON "search_documents"("category_id", "entity_type", "visibility_status");

-- CreateIndex
CREATE INDEX "search_documents_seller_id_entity_type_visibility_status_idx" ON "search_documents"("seller_id", "entity_type", "visibility_status");

-- CreateIndex
CREATE INDEX "search_documents_visibility_status_rank_boost_updated_at_idx" ON "search_documents"("visibility_status", "rank_boost", "updated_at");

-- CreateIndex
CREATE INDEX "search_documents_search_vector_idx" ON "search_documents" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_entity_type_entity_id_key" ON "search_documents"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_index_jobs_dedupe_key_key" ON "search_index_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "search_index_jobs_status_available_at_created_at_idx" ON "search_index_jobs"("status", "available_at", "created_at");

-- CreateIndex
CREATE INDEX "search_index_jobs_entity_type_entity_id_idx" ON "search_index_jobs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "search_index_jobs_locked_at_idx" ON "search_index_jobs"("locked_at");

-- CreateIndex
CREATE INDEX "order_seller_splits_commission_rule_id_idx" ON "order_seller_splits"("commission_rule_id");

-- CreateIndex
CREATE INDEX "order_seller_splits_settlement_status_idx" ON "order_seller_splits"("settlement_status");

-- CreateIndex
CREATE INDEX "order_seller_splits_seller_id_settlement_status_created_at_idx" ON "order_seller_splits"("seller_id", "settlement_status", "created_at");

-- CreateIndex
CREATE INDEX "order_seller_splits_seller_id_payout_id_settlement_status_idx" ON "order_seller_splits"("seller_id", "payout_id", "settlement_status");

-- CreateIndex
CREATE INDEX "order_seller_splits_payout_id_settlement_status_idx" ON "order_seller_splits"("payout_id", "settlement_status");

-- CreateIndex
CREATE UNIQUE INDEX "order_seller_splits_order_id_seller_id_key" ON "order_seller_splits"("order_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_shipment_number_key" ON "order_shipments"("shipment_number");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_order_seller_split_id_key" ON "order_shipments"("order_seller_split_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_awb_number_key" ON "order_shipments"("awb_number");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_tracking_reference_key" ON "order_shipments"("tracking_reference");

-- CreateIndex
CREATE INDEX "order_shipments_order_id_status_created_at_idx" ON "order_shipments"("order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "order_shipments_seller_id_status_created_at_idx" ON "order_shipments"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "order_shipments_order_id_seller_id_status_idx" ON "order_shipments"("order_id", "seller_id", "status");

-- CreateIndex
CREATE INDEX "order_shipments_delivery_partner_user_id_assignment_status__idx" ON "order_shipments"("delivery_partner_user_id", "assignment_status", "status");

-- CreateIndex
CREATE INDEX "order_shipments_assignment_expires_at_assignment_status_idx" ON "order_shipments"("assignment_expires_at", "assignment_status");

-- CreateIndex
CREATE INDEX "order_shipments_delivery_mode_status_created_at_idx" ON "order_shipments"("delivery_mode", "status", "created_at");

-- CreateIndex
CREATE INDEX "order_shipments_courier_provider_code_courier_tracking_stat_idx" ON "order_shipments"("courier_provider_code", "courier_tracking_status");

-- CreateIndex
CREATE INDEX "order_shipments_routing_failed_created_at_idx" ON "order_shipments"("routing_failed", "created_at");

-- CreateIndex
CREATE INDEX "order_shipments_routing_failed_routing_first_failed_at_idx" ON "order_shipments"("routing_failed", "routing_first_failed_at");

-- CreateIndex
CREATE INDEX "order_shipments_routing_permanent_failure_at_idx" ON "order_shipments"("routing_permanent_failure_at");

-- CreateIndex
CREATE INDEX "order_shipments_ready_for_booking_at_booking_next_attempt_a_idx" ON "order_shipments"("ready_for_booking_at", "booking_next_attempt_at");

-- CreateIndex
CREATE INDEX "order_shipments_booking_in_progress_booking_claimed_at_idx" ON "order_shipments"("booking_in_progress", "booking_claimed_at");

-- CreateIndex
CREATE INDEX "order_shipments_cod_collection_status_cod_collected_by_id_idx" ON "order_shipments"("cod_collection_status", "cod_collected_by_id");

-- CreateIndex
CREATE INDEX "order_shipments_cod_collection_status_cod_verified_by_id_idx" ON "order_shipments"("cod_collection_status", "cod_verified_by_id");

-- CreateIndex
CREATE INDEX "order_shipments_cod_collected_by_id_idx" ON "order_shipments"("cod_collected_by_id");

-- CreateIndex
CREATE INDEX "order_shipments_cod_verified_by_id_idx" ON "order_shipments"("cod_verified_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_order_id_seller_id_key" ON "order_shipments"("order_id", "seller_id");

-- CreateIndex
CREATE INDEX "order_shipment_assignment_events_order_shipment_id_created__idx" ON "order_shipment_assignment_events"("order_shipment_id", "created_at");

-- CreateIndex
CREATE INDEX "order_shipment_assignment_events_order_id_created_at_idx" ON "order_shipment_assignment_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_shipment_assignment_events_previous_partner_user_id_idx" ON "order_shipment_assignment_events"("previous_partner_user_id");

-- CreateIndex
CREATE INDEX "order_shipment_assignment_events_partner_user_id_status_cre_idx" ON "order_shipment_assignment_events"("partner_user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipment_packages_package_number_key" ON "order_shipment_packages"("package_number");

-- CreateIndex
CREATE INDEX "order_shipment_packages_order_id_status_created_at_idx" ON "order_shipment_packages"("order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "order_shipment_packages_order_shipment_id_status_idx" ON "order_shipment_packages"("order_shipment_id", "status");

-- CreateIndex
CREATE INDEX "order_shipment_packages_seller_id_status_created_at_idx" ON "order_shipment_packages"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "order_shipment_packages_delivery_mode_status_created_at_idx" ON "order_shipment_packages"("delivery_mode", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipment_packages_order_shipment_id_sequence_key" ON "order_shipment_packages"("order_shipment_id", "sequence");

-- CreateIndex
CREATE INDEX "order_status_events_order_id_idx" ON "order_status_events"("order_id");

-- CreateIndex
CREATE INDEX "order_status_events_status_type_idx" ON "order_status_events"("status_type");

-- CreateIndex
CREATE INDEX "order_status_events_created_by_idx" ON "order_status_events"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_request_number_key" ON "return_requests"("request_number");

-- CreateIndex
CREATE INDEX "return_requests_customer_id_status_created_at_idx" ON "return_requests"("customer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "return_requests_order_id_idx" ON "return_requests"("order_id");

-- CreateIndex
CREATE INDEX "return_requests_status_created_at_idx" ON "return_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "return_requests_created_at_idx" ON "return_requests"("created_at");

-- CreateIndex
CREATE INDEX "return_requests_reviewed_by_idx" ON "return_requests"("reviewed_by");

-- CreateIndex
CREATE INDEX "return_requests_created_by_idx" ON "return_requests"("created_by");

-- CreateIndex
CREATE INDEX "return_request_items_return_request_id_idx" ON "return_request_items"("return_request_id");

-- CreateIndex
CREATE INDEX "return_request_items_order_id_idx" ON "return_request_items"("order_id");

-- CreateIndex
CREATE INDEX "return_request_items_order_item_id_idx" ON "return_request_items"("order_item_id");

-- CreateIndex
CREATE INDEX "return_request_items_seller_id_status_idx" ON "return_request_items"("seller_id", "status");

-- CreateIndex
CREATE INDEX "return_request_items_order_seller_split_id_idx" ON "return_request_items"("order_seller_split_id");

-- CreateIndex
CREATE INDEX "return_request_items_status_created_at_idx" ON "return_request_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "return_request_items_product_id_idx" ON "return_request_items"("product_id");

-- CreateIndex
CREATE INDEX "return_request_items_product_variant_id_idx" ON "return_request_items"("product_variant_id");

-- CreateIndex
CREATE INDEX "return_request_notes_return_request_id_created_at_idx" ON "return_request_notes"("return_request_id", "created_at");

-- CreateIndex
CREATE INDEX "return_request_notes_seller_id_created_at_idx" ON "return_request_notes"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "return_request_notes_created_by_idx" ON "return_request_notes"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "refund_requests_refund_number_key" ON "refund_requests"("refund_number");

-- CreateIndex
CREATE INDEX "refund_requests_order_id_idx" ON "refund_requests"("order_id");

-- CreateIndex
CREATE INDEX "refund_requests_customer_id_status_created_at_idx" ON "refund_requests"("customer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "refund_requests_payment_id_idx" ON "refund_requests"("payment_id");

-- CreateIndex
CREATE INDEX "refund_requests_status_created_at_idx" ON "refund_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "refund_requests_return_request_id_idx" ON "refund_requests"("return_request_id");

-- CreateIndex
CREATE INDEX "refund_requests_reviewed_by_idx" ON "refund_requests"("reviewed_by");

-- CreateIndex
CREATE INDEX "refund_requests_created_by_idx" ON "refund_requests"("created_by");

-- CreateIndex
CREATE INDEX "refund_requests_amount_adjusted_by_idx" ON "refund_requests"("amount_adjusted_by");

-- CreateIndex
CREATE INDEX "refund_request_items_refund_request_id_idx" ON "refund_request_items"("refund_request_id");

-- CreateIndex
CREATE INDEX "refund_request_items_return_request_item_id_idx" ON "refund_request_items"("return_request_item_id");

-- CreateIndex
CREATE INDEX "refund_request_items_order_item_id_idx" ON "refund_request_items"("order_item_id");

-- CreateIndex
CREATE INDEX "refund_request_items_seller_id_created_at_idx" ON "refund_request_items"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "refund_request_items_order_seller_split_id_idx" ON "refund_request_items"("order_seller_split_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_transactions_idempotency_key_key" ON "refund_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "refund_transactions_refund_request_id_idx" ON "refund_transactions"("refund_request_id");

-- CreateIndex
CREATE INDEX "refund_transactions_payment_id_idx" ON "refund_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "refund_transactions_status_created_at_idx" ON "refund_transactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "refund_transactions_created_by_idx" ON "refund_transactions"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "refund_transactions_provider_provider_refund_id_key" ON "refund_transactions"("provider", "provider_refund_id");

-- CreateIndex
CREATE INDEX "tax_document_sequences_seller_id_financial_year_idx" ON "tax_document_sequences"("seller_id", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_document_sequences_seller_id_financial_year_document_ty_key" ON "tax_document_sequences"("seller_id", "financial_year", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "tax_documents_idempotency_key_key" ON "tax_documents"("idempotency_key");

-- CreateIndex
CREATE INDEX "tax_documents_seller_id_issue_date_document_type_idx" ON "tax_documents"("seller_id", "issue_date", "document_type");

-- CreateIndex
CREATE INDEX "tax_documents_seller_id_status_created_at_idx" ON "tax_documents"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tax_documents_registration_status_status_issue_date_idx" ON "tax_documents"("seller_tax_registration_status", "status", "issue_date");

-- CreateIndex
CREATE INDEX "tax_documents_order_id_seller_id_idx" ON "tax_documents"("order_id", "seller_id");

-- CreateIndex
CREATE INDEX "tax_documents_b2b_order_id_seller_id_idx" ON "tax_documents"("b2b_order_id", "seller_id");

-- CreateIndex
CREATE INDEX "tax_documents_service_booking_id_seller_id_idx" ON "tax_documents"("service_booking_id", "seller_id");

-- CreateIndex
CREATE INDEX "tax_documents_order_seller_split_id_idx" ON "tax_documents"("order_seller_split_id");

-- CreateIndex
CREATE INDEX "tax_documents_return_request_id_seller_id_idx" ON "tax_documents"("return_request_id", "seller_id");

-- CreateIndex
CREATE INDEX "tax_documents_refund_request_id_seller_id_idx" ON "tax_documents"("refund_request_id", "seller_id");

-- CreateIndex
CREATE INDEX "tax_documents_original_document_id_idx" ON "tax_documents"("original_document_id");

-- CreateIndex
CREATE INDEX "tax_documents_issued_by_id_idx" ON "tax_documents"("issued_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_documents_seller_id_document_number_key" ON "tax_documents"("seller_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "tax_document_compliance_tax_document_id_key" ON "tax_document_compliance"("tax_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_document_compliance_irn_key" ON "tax_document_compliance"("irn");

-- CreateIndex
CREATE UNIQUE INDEX "tax_document_compliance_e_way_bill_number_key" ON "tax_document_compliance"("e_way_bill_number");

-- CreateIndex
CREATE INDEX "tax_document_compliance_e_invoice_status_created_at_idx" ON "tax_document_compliance"("e_invoice_status", "created_at");

-- CreateIndex
CREATE INDEX "tax_document_compliance_e_way_bill_status_created_at_idx" ON "tax_document_compliance"("e_way_bill_status", "created_at");

-- CreateIndex
CREATE INDEX "tax_document_lines_tax_document_id_idx" ON "tax_document_lines"("tax_document_id");

-- CreateIndex
CREATE INDEX "tax_document_lines_order_item_id_idx" ON "tax_document_lines"("order_item_id");

-- CreateIndex
CREATE INDEX "tax_document_lines_return_request_item_id_idx" ON "tax_document_lines"("return_request_item_id");

-- CreateIndex
CREATE INDEX "tax_document_lines_refund_request_item_id_idx" ON "tax_document_lines"("refund_request_item_id");

-- CreateIndex
CREATE INDEX "tax_document_lines_hsn_sac_code_created_at_idx" ON "tax_document_lines"("hsn_sac_code", "created_at");

-- CreateIndex
CREATE INDEX "tax_document_lines_tax_classification_tax_document_id_idx" ON "tax_document_lines"("tax_classification", "tax_document_id");

-- CreateIndex
CREATE INDEX "gst_filing_periods_seller_id_status_date_from_idx" ON "gst_filing_periods"("seller_id", "status", "date_from");

-- CreateIndex
CREATE INDEX "gst_filing_periods_locked_by_id_idx" ON "gst_filing_periods"("locked_by_id");

-- CreateIndex
CREATE INDEX "gst_filing_periods_filed_by_id_idx" ON "gst_filing_periods"("filed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_filing_periods_seller_id_return_period_key" ON "gst_filing_periods"("seller_id", "return_period");

-- CreateIndex
CREATE INDEX "gst_reconciliation_runs_filing_period_id_idx" ON "gst_reconciliation_runs"("filing_period_id");

-- CreateIndex
CREATE INDEX "gst_reconciliation_runs_seller_id_created_at_idx" ON "gst_reconciliation_runs"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "gst_reconciliation_runs_created_by_id_idx" ON "gst_reconciliation_runs"("created_by_id");

-- CreateIndex
CREATE INDEX "gst_report_exports_filing_period_id_created_at_idx" ON "gst_report_exports"("filing_period_id", "created_at");

-- CreateIndex
CREATE INDEX "gst_report_exports_seller_id_export_type_created_at_idx" ON "gst_report_exports"("seller_id", "export_type", "created_at");

-- CreateIndex
CREATE INDEX "gst_report_exports_generated_by_id_idx" ON "gst_report_exports"("generated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tax_document_sequences_financial_year_document__key" ON "marketplace_tax_document_sequences"("financial_year", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tax_documents_document_number_key" ON "marketplace_tax_documents"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tax_documents_idempotency_key_key" ON "marketplace_tax_documents"("idempotency_key");

-- CreateIndex
CREATE INDEX "marketplace_tax_documents_seller_id_issue_date_document_typ_idx" ON "marketplace_tax_documents"("seller_id", "issue_date", "document_type");

-- CreateIndex
CREATE INDEX "marketplace_tax_documents_source_type_source_id_idx" ON "marketplace_tax_documents"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "marketplace_tax_documents_issued_by_id_idx" ON "marketplace_tax_documents"("issued_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "reverse_shipments_awb_number_key" ON "reverse_shipments"("awb_number");

-- CreateIndex
CREATE INDEX "reverse_shipments_return_request_id_idx" ON "reverse_shipments"("return_request_id");

-- CreateIndex
CREATE INDEX "reverse_shipments_seller_id_status_idx" ON "reverse_shipments"("seller_id", "status");

-- CreateIndex
CREATE INDEX "reverse_shipments_assigned_partner_user_id_status_idx" ON "reverse_shipments"("assigned_partner_user_id", "status");

-- CreateIndex
CREATE INDEX "reverse_shipments_assigned_partner_user_id_assignment_statu_idx" ON "reverse_shipments"("assigned_partner_user_id", "assignment_status", "status");

-- CreateIndex
CREATE INDEX "reverse_shipments_order_id_idx" ON "reverse_shipments"("order_id");

-- CreateIndex
CREATE INDEX "reverse_shipments_status_created_at_idx" ON "reverse_shipments"("status", "created_at");

-- CreateIndex
CREATE INDEX "reverse_shipments_assignment_status_status_created_at_idx" ON "reverse_shipments"("assignment_status", "status", "created_at");

-- CreateIndex
CREATE INDEX "reverse_shipments_assignment_expires_at_assignment_status_idx" ON "reverse_shipments"("assignment_expires_at", "assignment_status");

-- CreateIndex
CREATE INDEX "reverse_shipment_assignment_attempts_return_request_id_crea_idx" ON "reverse_shipment_assignment_attempts"("return_request_id", "created_at");

-- CreateIndex
CREATE INDEX "reverse_shipment_assignment_attempts_reverse_shipment_id_cr_idx" ON "reverse_shipment_assignment_attempts"("reverse_shipment_id", "created_at");

-- CreateIndex
CREATE INDEX "reverse_shipment_assignment_attempts_partner_user_id_status_idx" ON "reverse_shipment_assignment_attempts"("partner_user_id", "status");

-- CreateIndex
CREATE INDEX "reverse_shipment_assignment_attempts_source_status_idx" ON "reverse_shipment_assignment_attempts"("source", "status");

-- CreateIndex
CREATE INDEX "reverse_shipment_assignment_attempts_assigned_by_id_idx" ON "reverse_shipment_assignment_attempts"("assigned_by_id");

-- CreateIndex
CREATE INDEX "reverse_shipment_events_reverse_shipment_id_created_at_idx" ON "reverse_shipment_events"("reverse_shipment_id", "created_at");

-- CreateIndex
CREATE INDEX "reverse_shipment_events_created_by_idx" ON "reverse_shipment_events"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_details_order_id_key" ON "delivery_details"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_details_awb_number_key" ON "delivery_details"("awb_number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_details_tracking_reference_key" ON "delivery_details"("tracking_reference");

-- CreateIndex
CREATE INDEX "delivery_details_status_updated_at_idx" ON "delivery_details"("status", "updated_at");

-- CreateIndex
CREATE INDEX "delivery_details_delivery_mode_status_idx" ON "delivery_details"("delivery_mode", "status");

-- CreateIndex
CREATE INDEX "delivery_details_delivery_partner_user_id_assignment_status_idx" ON "delivery_details"("delivery_partner_user_id", "assignment_status", "status");

-- CreateIndex
CREATE INDEX "delivery_details_delivery_partner_user_id_cod_collection_st_idx" ON "delivery_details"("delivery_partner_user_id", "cod_collection_status", "cod_collected_by_id");

-- CreateIndex
CREATE INDEX "delivery_details_courier_provider_code_courier_tracking_sta_idx" ON "delivery_details"("courier_provider_code", "courier_tracking_status");

-- CreateIndex
CREATE INDEX "delivery_details_routing_failed_created_at_idx" ON "delivery_details"("routing_failed", "created_at");

-- CreateIndex
CREATE INDEX "delivery_details_assignment_status_status_idx" ON "delivery_details"("assignment_status", "status");

-- CreateIndex
CREATE INDEX "delivery_details_assignment_expires_at_assignment_status_idx" ON "delivery_details"("assignment_expires_at", "assignment_status");

-- CreateIndex
CREATE INDEX "delivery_details_cod_collection_status_cod_collected_by_id_idx" ON "delivery_details"("cod_collection_status", "cod_collected_by_id");

-- CreateIndex
CREATE INDEX "delivery_details_cod_collection_status_cod_verified_by_id_idx" ON "delivery_details"("cod_collection_status", "cod_verified_by_id");

-- CreateIndex
CREATE INDEX "delivery_details_cod_collected_by_id_idx" ON "delivery_details"("cod_collected_by_id");

-- CreateIndex
CREATE INDEX "delivery_details_cod_verified_by_id_idx" ON "delivery_details"("cod_verified_by_id");

-- CreateIndex
CREATE INDEX "delivery_assignment_attempts_order_id_partner_user_id_statu_idx" ON "delivery_assignment_attempts"("order_id", "partner_user_id", "status");

-- CreateIndex
CREATE INDEX "delivery_assignment_attempts_partner_user_id_status_created_idx" ON "delivery_assignment_attempts"("partner_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "delivery_assignment_attempts_order_id_created_at_idx" ON "delivery_assignment_attempts"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_assignment_attempts_delivery_detail_id_idx" ON "delivery_assignment_attempts"("delivery_detail_id");

-- CreateIndex
CREATE INDEX "delivery_assignment_attempts_assigned_by_id_idx" ON "delivery_assignment_attempts"("assigned_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_shipments_order_shipment_id_key" ON "courier_shipments"("order_shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_shipments_awb_number_key" ON "courier_shipments"("awb_number");

-- CreateIndex
CREATE INDEX "courier_shipments_order_id_tracking_status_updated_at_idx" ON "courier_shipments"("order_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_shipments_seller_id_tracking_status_updated_at_idx" ON "courier_shipments"("seller_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_shipments_provider_code_tracking_status_updated_at_idx" ON "courier_shipments"("provider_code", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_shipments_provider_code_last_tracked_at_idx" ON "courier_shipments"("provider_code", "last_tracked_at");

-- CreateIndex
CREATE UNIQUE INDEX "courier_shipments_provider_code_provider_order_id_key" ON "courier_shipments"("provider_code", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_consignments_consignment_number_key" ON "courier_consignments"("consignment_number");

-- CreateIndex
CREATE INDEX "courier_consignments_order_id_tracking_status_updated_at_idx" ON "courier_consignments"("order_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignments_order_shipment_id_tracking_status_upda_idx" ON "courier_consignments"("order_shipment_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignments_seller_id_tracking_status_updated_at_idx" ON "courier_consignments"("seller_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignments_provider_code_tracking_status_updated__idx" ON "courier_consignments"("provider_code", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignments_provider_code_last_tracked_at_idx" ON "courier_consignments"("provider_code", "last_tracked_at");

-- CreateIndex
CREATE UNIQUE INDEX "courier_consignments_provider_code_provider_order_id_key" ON "courier_consignments"("provider_code", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_consignment_packages_awb_number_key" ON "courier_consignment_packages"("awb_number");

-- CreateIndex
CREATE INDEX "courier_consignment_packages_order_id_tracking_status_updat_idx" ON "courier_consignment_packages"("order_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignment_packages_order_shipment_id_tracking_sta_idx" ON "courier_consignment_packages"("order_shipment_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignment_packages_order_shipment_package_id_trac_idx" ON "courier_consignment_packages"("order_shipment_package_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE INDEX "courier_consignment_packages_seller_id_tracking_status_upda_idx" ON "courier_consignment_packages"("seller_id", "tracking_status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "courier_consignment_packages_courier_consignment_id_order_s_key" ON "courier_consignment_packages"("courier_consignment_id", "order_shipment_package_id");

-- CreateIndex
CREATE INDEX "courier_webhook_events_provider_code_awb_number_received_at_idx" ON "courier_webhook_events"("provider_code", "awb_number", "received_at");

-- CreateIndex
CREATE INDEX "courier_webhook_events_order_shipment_id_received_at_idx" ON "courier_webhook_events"("order_shipment_id", "received_at");

-- CreateIndex
CREATE INDEX "courier_webhook_events_status_received_at_idx" ON "courier_webhook_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "courier_webhook_events_provider_code_provider_event_id_key" ON "courier_webhook_events"("provider_code", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_cod_remittances_courier_shipment_id_key" ON "courier_cod_remittances"("courier_shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "courier_cod_remittances_order_shipment_id_key" ON "courier_cod_remittances"("order_shipment_id");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_status_provider_code_updated_at_idx" ON "courier_cod_remittances"("status", "provider_code", "updated_at");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_order_id_status_idx" ON "courier_cod_remittances"("order_id", "status");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_seller_id_status_idx" ON "courier_cod_remittances"("seller_id", "status");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_provider_code_awb_number_idx" ON "courier_cod_remittances"("provider_code", "awb_number");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_remittance_reference_idx" ON "courier_cod_remittances"("remittance_reference");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_report_reference_idx" ON "courier_cod_remittances"("report_reference");

-- CreateIndex
CREATE INDEX "courier_cod_remittances_verified_by_id_idx" ON "courier_cod_remittances"("verified_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_profiles_user_id_key" ON "delivery_partner_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_profiles_razorpay_virtual_account_id_key" ON "delivery_partner_profiles"("razorpay_virtual_account_id");

-- CreateIndex
CREATE INDEX "delivery_partner_profiles_is_available_priority_idx" ON "delivery_partner_profiles"("is_available", "priority");

-- CreateIndex
CREATE INDEX "delivery_partner_profiles_priority_idx" ON "delivery_partner_profiles"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_applications_user_id_key" ON "delivery_partner_applications"("user_id");

-- CreateIndex
CREATE INDEX "delivery_partner_applications_status_created_at_idx" ON "delivery_partner_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "delivery_partner_applications_email_idx" ON "delivery_partner_applications"("email");

-- CreateIndex
CREATE INDEX "delivery_partner_applications_phone_idx" ON "delivery_partner_applications"("phone");

-- CreateIndex
CREATE INDEX "delivery_partner_applications_reviewed_by_id_idx" ON "delivery_partner_applications"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_partner_profile_id_is_active_idx" ON "delivery_partner_service_areas"("partner_profile_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_is_active_country_code_state_idx" ON "delivery_partner_service_areas"("is_active", "country_code", "state_code", "city_code", "pincode", "local_area_code");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_country_code_idx" ON "delivery_partner_service_areas"("country_code");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_state_code_idx" ON "delivery_partner_service_areas"("state_code");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_city_code_idx" ON "delivery_partner_service_areas"("city_code");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_pincode_idx" ON "delivery_partner_service_areas"("pincode");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_local_area_code_idx" ON "delivery_partner_service_areas"("local_area_code");

-- CreateIndex
CREATE INDEX "delivery_partner_service_areas_priority_idx" ON "delivery_partner_service_areas"("priority");

-- CreateIndex
CREATE INDEX "delivery_attempts_delivery_detail_id_idx" ON "delivery_attempts"("delivery_detail_id");

-- CreateIndex
CREATE INDEX "delivery_attempts_reason_idx" ON "delivery_attempts"("reason");

-- CreateIndex
CREATE INDEX "delivery_attempts_created_by_id_idx" ON "delivery_attempts"("created_by_id");

-- CreateIndex
CREATE INDEX "delivery_events_delivery_detail_id_idx" ON "delivery_events"("delivery_detail_id");

-- CreateIndex
CREATE INDEX "delivery_events_updated_by_idx" ON "delivery_events"("updated_by");

-- CreateIndex
CREATE INDEX "delivery_partner_wallet_entries_partner_user_id_created_at_idx" ON "delivery_partner_wallet_entries"("partner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_partner_wallet_entries_partner_user_id_entry_type__idx" ON "delivery_partner_wallet_entries"("partner_user_id", "entry_type", "created_at");

-- CreateIndex
CREATE INDEX "delivery_partner_wallet_entries_order_id_idx" ON "delivery_partner_wallet_entries"("order_id");

-- CreateIndex
CREATE INDEX "delivery_partner_wallet_entries_delivery_detail_id_idx" ON "delivery_partner_wallet_entries"("delivery_detail_id");

-- CreateIndex
CREATE INDEX "delivery_partner_wallet_entries_created_by_id_idx" ON "delivery_partner_wallet_entries"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_wallet_entries_order_shipment_id_entry_typ_key" ON "delivery_partner_wallet_entries"("order_shipment_id", "entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_wallet_entries_reverse_shipment_id_entry_t_key" ON "delivery_partner_wallet_entries"("reverse_shipment_id", "entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_wallet_entries_payout_id_entry_type_key" ON "delivery_partner_wallet_entries"("payout_id", "entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partner_payouts_payout_number_key" ON "delivery_partner_payouts"("payout_number");

-- CreateIndex
CREATE INDEX "delivery_partner_payouts_partner_user_id_status_created_at_idx" ON "delivery_partner_payouts"("partner_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "delivery_partner_payouts_status_created_at_idx" ON "delivery_partner_payouts"("status", "created_at");

-- CreateIndex
CREATE INDEX "delivery_partner_payouts_requested_by_id_idx" ON "delivery_partner_payouts"("requested_by_id");

-- CreateIndex
CREATE INDEX "delivery_partner_payouts_approved_by_id_idx" ON "delivery_partner_payouts"("approved_by_id");

-- CreateIndex
CREATE INDEX "delivery_partner_payouts_paid_by_id_idx" ON "delivery_partner_payouts"("paid_by_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_provider_status_created_at_idx" ON "payments"("provider", "status", "created_at");

-- CreateIndex
CREATE INDEX "payments_provider_provider_order_id_idx" ON "payments"("provider", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_order_id_key" ON "payments"("provider", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_webhook_events_provider_provider_event_id_key" ON "razorpay_webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "currency_rates_quote_currency_expires_at_idx" ON "currency_rates"("quote_currency", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_base_currency_quote_currency_provider_key" ON "currency_rates"("base_currency", "quote_currency", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "fx_provider_settings_provider_code_key" ON "fx_provider_settings"("provider_code");

-- CreateIndex
CREATE UNIQUE INDEX "fx_provider_settings_adapter_code_key" ON "fx_provider_settings"("adapter_code");

-- CreateIndex
CREATE INDEX "fx_provider_settings_is_enabled_priority_idx" ON "fx_provider_settings"("is_enabled", "priority");

-- CreateIndex
CREATE INDEX "fx_provider_settings_is_primary_is_enabled_idx" ON "fx_provider_settings"("is_primary", "is_enabled");

-- CreateIndex
CREATE INDEX "commission_rules_scope_active_priority_idx" ON "commission_rules"("scope", "active", "priority");

-- CreateIndex
CREATE INDEX "commission_rules_seller_id_active_idx" ON "commission_rules"("seller_id", "active");

-- CreateIndex
CREATE INDEX "commission_rules_category_id_active_idx" ON "commission_rules"("category_id", "active");

-- CreateIndex
CREATE INDEX "commission_rules_effective_from_effective_to_idx" ON "commission_rules"("effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "seller_settlement_runs_run_number_key" ON "seller_settlement_runs"("run_number");

-- CreateIndex
CREATE INDEX "seller_settlement_runs_period_from_period_to_idx" ON "seller_settlement_runs"("period_from", "period_to");

-- CreateIndex
CREATE INDEX "seller_settlement_runs_status_created_at_idx" ON "seller_settlement_runs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_payouts_payout_number_key" ON "seller_payouts"("payout_number");

-- CreateIndex
CREATE INDEX "seller_payouts_settlement_run_id_idx" ON "seller_payouts"("settlement_run_id");

-- CreateIndex
CREATE INDEX "seller_payouts_period_from_period_to_idx" ON "seller_payouts"("period_from", "period_to");

-- CreateIndex
CREATE INDEX "seller_payouts_status_created_at_idx" ON "seller_payouts"("status", "created_at");

-- CreateIndex
CREATE INDEX "seller_payouts_seller_id_status_created_at_idx" ON "seller_payouts"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "seller_payout_events_payout_id_idx" ON "seller_payout_events"("payout_id");

-- CreateIndex
CREATE INDEX "seller_payout_events_created_at_idx" ON "seller_payout_events"("created_at");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_seller_id_created_at_idx" ON "seller_ledger_entries"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_order_seller_split_id_idx" ON "seller_ledger_entries"("order_seller_split_id");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_service_booking_id_idx" ON "seller_ledger_entries"("service_booking_id");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_service_settlement_id_idx" ON "seller_ledger_entries"("service_settlement_id");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_seller_cash_receivable_id_idx" ON "seller_ledger_entries"("seller_cash_receivable_id");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_payout_id_idx" ON "seller_ledger_entries"("payout_id");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_entry_type_idx" ON "seller_ledger_entries"("entry_type");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_receivable_number_key" ON "seller_cash_receivables"("receivable_number");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_order_shipment_id_key" ON "seller_cash_receivables"("order_shipment_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_seller_id_status_created_at_idx" ON "seller_cash_receivables"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_order_id_status_idx" ON "seller_cash_receivables"("order_id", "status");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_order_seller_split_id_idx" ON "seller_cash_receivables"("order_seller_split_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_payment_id_idx" ON "seller_cash_receivables"("payment_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_payout_offset_id_status_idx" ON "seller_cash_receivables"("payout_offset_id", "status");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_source_created_at_idx" ON "seller_cash_receivables"("source", "created_at");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_settled_by_idx" ON "seller_cash_receivables"("settled_by");

-- CreateIndex
CREATE INDEX "seller_cash_receivables_waived_by_idx" ON "seller_cash_receivables"("waived_by");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_order_seller_split_id_source_key" ON "seller_cash_receivables"("order_seller_split_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "seller_cash_receivables_seller_split_idempotency_key_key" ON "seller_cash_receivables"("seller_id", "order_seller_split_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "seller_cash_receivable_events_receivable_id_idx" ON "seller_cash_receivable_events"("receivable_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivable_events_actor_user_id_idx" ON "seller_cash_receivable_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "seller_cash_receivable_events_created_at_idx" ON "seller_cash_receivable_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_statements_statement_number_key" ON "seller_statements"("statement_number");

-- CreateIndex
CREATE INDEX "seller_statements_seller_id_generated_at_idx" ON "seller_statements"("seller_id", "generated_at");

-- CreateIndex
CREATE INDEX "seller_statements_payout_id_idx" ON "seller_statements"("payout_id");

-- CreateIndex
CREATE INDEX "payment_events_payment_id_idx" ON "payment_events"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_listings_slug_key" ON "service_listings"("slug");

-- CreateIndex
CREATE INDEX "service_listings_status_idx" ON "service_listings"("status");

-- CreateIndex
CREATE INDEX "service_listings_approval_status_idx" ON "service_listings"("approval_status");

-- CreateIndex
CREATE INDEX "service_listings_pricing_model_idx" ON "service_listings"("pricing_model");

-- CreateIndex
CREATE INDEX "service_listings_payment_mode_idx" ON "service_listings"("payment_mode");

-- CreateIndex
CREATE INDEX "service_listings_sac_code_idx" ON "service_listings"("sac_code");

-- CreateIndex
CREATE INDEX "service_listings_tax_classification_gst_rate_percent_idx" ON "service_listings"("tax_classification", "gst_rate_percent");

-- CreateIndex
CREATE INDEX "service_listings_deleted_at_status_approval_status_created__idx" ON "service_listings"("deleted_at", "status", "approval_status", "created_at");

-- CreateIndex
CREATE INDEX "service_listings_category_id_status_approval_status_created_idx" ON "service_listings"("category_id", "status", "approval_status", "created_at");

-- CreateIndex
CREATE INDEX "service_listings_seller_id_deleted_at_created_at_idx" ON "service_listings"("seller_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "service_packages_service_listing_id_idx" ON "service_packages"("service_listing_id");

-- CreateIndex
CREATE INDEX "service_packages_is_active_sort_order_idx" ON "service_packages"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "service_listing_images_service_listing_id_idx" ON "service_listing_images"("service_listing_id");

-- CreateIndex
CREATE INDEX "service_areas_service_listing_id_idx" ON "service_areas"("service_listing_id");

-- CreateIndex
CREATE INDEX "service_areas_country_code_state_code_city_code_idx" ON "service_areas"("country_code", "state_code", "city_code");

-- CreateIndex
CREATE INDEX "service_areas_local_area_code_idx" ON "service_areas"("local_area_code");

-- CreateIndex
CREATE INDEX "service_areas_pincode_idx" ON "service_areas"("pincode");

-- CreateIndex
CREATE INDEX "service_areas_is_active_idx" ON "service_areas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_bookings_booking_number_key" ON "service_bookings"("booking_number");

-- CreateIndex
CREATE INDEX "service_bookings_customer_id_created_at_idx" ON "service_bookings"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "service_bookings_seller_id_created_at_idx" ON "service_bookings"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "service_bookings_service_listing_id_idx" ON "service_bookings"("service_listing_id");

-- CreateIndex
CREATE INDEX "service_bookings_service_package_id_idx" ON "service_bookings"("service_package_id");

-- CreateIndex
CREATE INDEX "service_bookings_status_idx" ON "service_bookings"("status");

-- CreateIndex
CREATE INDEX "service_bookings_scheduled_start_at_idx" ON "service_bookings"("scheduled_start_at");

-- CreateIndex
CREATE INDEX "service_bookings_assigned_technician_id_scheduled_start_at_idx" ON "service_bookings"("assigned_technician_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "service_bookings_payment_mode_status_idx" ON "service_bookings"("payment_mode", "status");

-- CreateIndex
CREATE INDEX "service_bookings_seller_tax_registration_status_snapshot_cr_idx" ON "service_bookings"("seller_tax_registration_status_snapshot", "created_at");

-- CreateIndex
CREATE INDEX "service_bookings_sac_code_snapshot_created_at_idx" ON "service_bookings"("sac_code_snapshot", "created_at");

-- CreateIndex
CREATE INDEX "service_bookings_cancelled_by_idx" ON "service_bookings"("cancelled_by");

-- CreateIndex
CREATE INDEX "service_bookings_completion_confirmed_by_idx" ON "service_bookings"("completion_confirmed_by");

-- CreateIndex
CREATE UNIQUE INDEX "service_bookings_customer_id_idempotency_key_key" ON "service_bookings"("customer_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "service_quotes_quote_number_key" ON "service_quotes"("quote_number");

-- CreateIndex
CREATE INDEX "service_quotes_booking_id_idx" ON "service_quotes"("booking_id");

-- CreateIndex
CREATE INDEX "service_quotes_status_idx" ON "service_quotes"("status");

-- CreateIndex
CREATE INDEX "service_quotes_expires_at_idx" ON "service_quotes"("expires_at");

-- CreateIndex
CREATE INDEX "service_quotes_sent_by_idx" ON "service_quotes"("sent_by");

-- CreateIndex
CREATE INDEX "service_quotes_withdrawn_by_idx" ON "service_quotes"("withdrawn_by");

-- CreateIndex
CREATE INDEX "service_quote_line_items_quote_id_idx" ON "service_quote_line_items"("quote_id");

-- CreateIndex
CREATE INDEX "service_payments_seller_id_created_at_idx" ON "service_payments"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "service_payments_status_idx" ON "service_payments"("status");

-- CreateIndex
CREATE INDEX "service_payments_provider_status_created_at_idx" ON "service_payments"("provider", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_payments_collection_type_status_created_at_idx" ON "service_payments"("collection_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_payments_settlement_treatment_status_created_at_idx" ON "service_payments"("settlement_treatment", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_payments_cash_collection_status_created_at_idx" ON "service_payments"("cash_collection_status", "created_at");

-- CreateIndex
CREATE INDEX "service_payments_cash_collected_by_created_at_idx" ON "service_payments"("cash_collected_by", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_payments_provider_provider_order_id_key" ON "service_payments"("provider", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_payments_provider_provider_payment_id_key" ON "service_payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_payments_booking_seller_idempotency_key_key" ON "service_payments"("booking_id", "seller_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "service_payments_booking_seller_cash_event_key" ON "service_payments"("booking_id", "seller_id", "cash_collection_event_id");

-- CreateIndex
CREATE INDEX "service_payment_events_payment_id_idx" ON "service_payment_events"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_seller_receivables_receivable_number_key" ON "service_seller_receivables"("receivable_number");

-- CreateIndex
CREATE INDEX "service_seller_receivables_seller_id_status_created_at_idx" ON "service_seller_receivables"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_seller_receivables_booking_id_status_idx" ON "service_seller_receivables"("booking_id", "status");

-- CreateIndex
CREATE INDEX "service_seller_receivables_service_payment_id_idx" ON "service_seller_receivables"("service_payment_id");

-- CreateIndex
CREATE INDEX "service_seller_receivables_status_created_at_idx" ON "service_seller_receivables"("status", "created_at");

-- CreateIndex
CREATE INDEX "service_seller_receivables_payout_offset_id_status_idx" ON "service_seller_receivables"("payout_offset_id", "status");

-- CreateIndex
CREATE INDEX "service_seller_receivables_cash_collection_event_id_idx" ON "service_seller_receivables"("cash_collection_event_id");

-- CreateIndex
CREATE INDEX "service_seller_receivables_source_created_at_idx" ON "service_seller_receivables"("source", "created_at");

-- CreateIndex
CREATE INDEX "service_seller_receivables_verified_by_idx" ON "service_seller_receivables"("verified_by");

-- CreateIndex
CREATE INDEX "service_seller_receivables_disputed_by_idx" ON "service_seller_receivables"("disputed_by");

-- CreateIndex
CREATE INDEX "service_seller_receivables_resolved_by_idx" ON "service_seller_receivables"("resolved_by");

-- CreateIndex
CREATE INDEX "service_seller_receivables_waiver_requested_by_idx" ON "service_seller_receivables"("waiver_requested_by");

-- CreateIndex
CREATE INDEX "service_seller_receivables_waiver_approved_by_idx" ON "service_seller_receivables"("waiver_approved_by");

-- CreateIndex
CREATE UNIQUE INDEX "service_receivables_seller_booking_idempotency_key_key" ON "service_seller_receivables"("seller_id", "booking_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "service_seller_receivable_events_receivable_id_idx" ON "service_seller_receivable_events"("receivable_id");

-- CreateIndex
CREATE INDEX "service_seller_receivable_events_actor_user_id_idx" ON "service_seller_receivable_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "service_seller_receivable_events_created_at_idx" ON "service_seller_receivable_events"("created_at");

-- CreateIndex
CREATE INDEX "service_disputes_booking_id_idx" ON "service_disputes"("booking_id");

-- CreateIndex
CREATE INDEX "service_disputes_raised_by_idx" ON "service_disputes"("raised_by");

-- CreateIndex
CREATE INDEX "service_disputes_refund_request_id_idx" ON "service_disputes"("refund_request_id");

-- CreateIndex
CREATE INDEX "service_disputes_resolved_at_idx" ON "service_disputes"("resolved_at");

-- CreateIndex
CREATE INDEX "service_disputes_resolved_by_idx" ON "service_disputes"("resolved_by");

-- CreateIndex
CREATE UNIQUE INDEX "service_refund_requests_refund_number_key" ON "service_refund_requests"("refund_number");

-- CreateIndex
CREATE INDEX "service_refund_requests_booking_id_idx" ON "service_refund_requests"("booking_id");

-- CreateIndex
CREATE INDEX "service_refund_requests_customer_id_status_created_at_idx" ON "service_refund_requests"("customer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_refund_requests_seller_id_status_created_at_idx" ON "service_refund_requests"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_refund_requests_service_payment_id_idx" ON "service_refund_requests"("service_payment_id");

-- CreateIndex
CREATE INDEX "service_refund_requests_status_created_at_idx" ON "service_refund_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "service_refund_requests_reviewed_by_idx" ON "service_refund_requests"("reviewed_by");

-- CreateIndex
CREATE INDEX "service_refund_requests_created_by_idx" ON "service_refund_requests"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "service_refund_transactions_idempotency_key_key" ON "service_refund_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "service_refund_transactions_service_refund_request_id_idx" ON "service_refund_transactions"("service_refund_request_id");

-- CreateIndex
CREATE INDEX "service_refund_transactions_service_payment_id_idx" ON "service_refund_transactions"("service_payment_id");

-- CreateIndex
CREATE INDEX "service_refund_transactions_provider_refund_id_idx" ON "service_refund_transactions"("provider_refund_id");

-- CreateIndex
CREATE INDEX "service_refund_transactions_created_by_idx" ON "service_refund_transactions"("created_by");

-- CreateIndex
CREATE INDEX "service_refund_transactions_status_created_at_idx" ON "service_refund_transactions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_booking_settlements_booking_id_key" ON "service_booking_settlements"("booking_id");

-- CreateIndex
CREATE INDEX "service_booking_settlements_seller_id_status_created_at_idx" ON "service_booking_settlements"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_booking_settlements_payout_id_status_idx" ON "service_booking_settlements"("payout_id", "status");

-- CreateIndex
CREATE INDEX "service_booking_settlements_status_idx" ON "service_booking_settlements"("status");

-- CreateIndex
CREATE INDEX "service_reviews_service_listing_id_is_visible_created_at_idx" ON "service_reviews"("service_listing_id", "is_visible", "created_at");

-- CreateIndex
CREATE INDEX "service_reviews_seller_id_is_visible_created_at_idx" ON "service_reviews"("seller_id", "is_visible", "created_at");

-- CreateIndex
CREATE INDEX "service_reviews_customer_id_created_at_idx" ON "service_reviews"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_reviews_booking_id_customer_id_key" ON "service_reviews"("booking_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_review_replies_review_id_key" ON "service_review_replies"("review_id");

-- CreateIndex
CREATE INDEX "service_review_replies_provider_id_idx" ON "service_review_replies"("provider_id");

-- CreateIndex
CREATE INDEX "b2b_enquiries_status_idx" ON "b2b_enquiries"("status");

-- CreateIndex
CREATE INDEX "b2b_enquiries_business_buyer_id_status_created_at_idx" ON "b2b_enquiries"("business_buyer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_enquiries_seller_id_status_created_at_idx" ON "b2b_enquiries"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_enquiries_product_id_idx" ON "b2b_enquiries"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_enquiries_business_buyer_id_idempotency_key_key" ON "b2b_enquiries"("business_buyer_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "b2b_enquiry_responses_enquiry_id_idx" ON "b2b_enquiry_responses"("enquiry_id");

-- CreateIndex
CREATE INDEX "b2b_enquiry_responses_responder_user_id_idx" ON "b2b_enquiry_responses"("responder_user_id");

-- CreateIndex
CREATE INDEX "b2b_enquiry_messages_enquiry_id_created_at_idx" ON "b2b_enquiry_messages"("enquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_enquiry_messages_sender_user_id_idx" ON "b2b_enquiry_messages"("sender_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_orders_order_number_key" ON "b2b_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_orders_enquiry_id_key" ON "b2b_orders"("enquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_orders_proforma_invoice_number_key" ON "b2b_orders"("proforma_invoice_number");

-- CreateIndex
CREATE INDEX "b2b_orders_product_id_idx" ON "b2b_orders"("product_id");

-- CreateIndex
CREATE INDEX "b2b_orders_selected_response_id_idx" ON "b2b_orders"("selected_response_id");

-- CreateIndex
CREATE INDEX "b2b_orders_payout_id_idx" ON "b2b_orders"("payout_id");

-- CreateIndex
CREATE INDEX "b2b_orders_status_idx" ON "b2b_orders"("status");

-- CreateIndex
CREATE INDEX "b2b_orders_payment_status_idx" ON "b2b_orders"("payment_status");

-- CreateIndex
CREATE INDEX "b2b_orders_settlement_status_idx" ON "b2b_orders"("settlement_status");

-- CreateIndex
CREATE INDEX "b2b_orders_payment_due_at_idx" ON "b2b_orders"("payment_due_at");

-- CreateIndex
CREATE INDEX "b2b_orders_created_at_idx" ON "b2b_orders"("created_at");

-- CreateIndex
CREATE INDEX "b2b_orders_business_buyer_id_status_created_at_idx" ON "b2b_orders"("business_buyer_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_orders_seller_id_status_created_at_idx" ON "b2b_orders"("seller_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_orders_seller_id_settlement_status_created_at_idx" ON "b2b_orders"("seller_id", "settlement_status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_orders_tax_invoice_number_idx" ON "b2b_orders"("tax_invoice_number");

-- CreateIndex
CREATE INDEX "b2b_orders_created_by_user_id_idx" ON "b2b_orders"("created_by_user_id");

-- CreateIndex
CREATE INDEX "b2b_orders_payment_verified_by_id_idx" ON "b2b_orders"("payment_verified_by_id");

-- CreateIndex
CREATE INDEX "b2b_orders_fulfilment_unlocked_by_id_idx" ON "b2b_orders"("fulfilment_unlocked_by_id");

-- CreateIndex
CREATE INDEX "b2b_orders_legacy_migration_review_required_status_created__idx" ON "b2b_orders"("legacy_migration_review_required", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_order_events_b2b_order_id_idx" ON "b2b_order_events"("b2b_order_id");

-- CreateIndex
CREATE INDEX "b2b_order_events_actor_user_id_idx" ON "b2b_order_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "b2b_order_events_status_idx" ON "b2b_order_events"("status");

-- CreateIndex
CREATE INDEX "b2b_order_events_created_at_idx" ON "b2b_order_events"("created_at");

-- CreateIndex
CREATE INDEX "b2b_payment_proofs_b2b_order_id_idx" ON "b2b_payment_proofs"("b2b_order_id");

-- CreateIndex
CREATE INDEX "b2b_payment_proofs_submitted_by_user_id_idx" ON "b2b_payment_proofs"("submitted_by_user_id");

-- CreateIndex
CREATE INDEX "b2b_payment_proofs_reviewed_by_user_id_idx" ON "b2b_payment_proofs"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "b2b_payment_proofs_reference_number_status_idx" ON "b2b_payment_proofs"("reference_number", "status");

-- CreateIndex
CREATE INDEX "b2b_payment_proofs_status_submitted_at_idx" ON "b2b_payment_proofs"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "b2b_proforma_invoice_revisions_b2b_order_id_idx" ON "b2b_proforma_invoice_revisions"("b2b_order_id");

-- CreateIndex
CREATE INDEX "b2b_proforma_invoice_revisions_created_at_idx" ON "b2b_proforma_invoice_revisions"("created_at");

-- CreateIndex
CREATE INDEX "b2b_proforma_invoice_revisions_generated_by_user_id_idx" ON "b2b_proforma_invoice_revisions"("generated_by_user_id");

-- CreateIndex
CREATE INDEX "b2b_admin_audit_logs_b2b_order_id_idx" ON "b2b_admin_audit_logs"("b2b_order_id");

-- CreateIndex
CREATE INDEX "b2b_admin_audit_logs_actor_id_idx" ON "b2b_admin_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "b2b_admin_audit_logs_action_idx" ON "b2b_admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "b2b_admin_audit_logs_created_at_idx" ON "b2b_admin_audit_logs"("created_at");

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
CREATE INDEX "b2b_payment_records_provider_order_creation_in_progress_upd_idx" ON "b2b_payment_records"("provider_order_creation_in_progress", "updated_at");

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
CREATE UNIQUE INDEX "b2b_order_amendments_amendment_number_key" ON "b2b_order_amendments"("amendment_number");

-- CreateIndex
CREATE INDEX "b2b_order_amendments_b2b_order_id_status_created_at_idx" ON "b2b_order_amendments"("b2b_order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_order_amendments_requested_by_user_id_created_at_idx" ON "b2b_order_amendments"("requested_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_order_amendments_decided_by_user_id_idx" ON "b2b_order_amendments"("decided_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_dispute_resolutions_resolution_number_key" ON "b2b_dispute_resolutions"("resolution_number");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_dispute_resolutions_support_case_id_key" ON "b2b_dispute_resolutions"("support_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_dispute_resolutions_credit_note_tax_document_id_key" ON "b2b_dispute_resolutions"("credit_note_tax_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_dispute_resolutions_replacement_enquiry_id_key" ON "b2b_dispute_resolutions"("replacement_enquiry_id");

-- CreateIndex
CREATE INDEX "b2b_dispute_resolutions_b2b_order_id_created_at_idx" ON "b2b_dispute_resolutions"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_dispute_resolutions_b2b_order_line_id_idx" ON "b2b_dispute_resolutions"("b2b_order_line_id");

-- CreateIndex
CREATE INDEX "b2b_dispute_resolutions_shipment_id_idx" ON "b2b_dispute_resolutions"("shipment_id");

-- CreateIndex
CREATE INDEX "b2b_dispute_resolutions_resolved_by_user_id_created_at_idx" ON "b2b_dispute_resolutions"("resolved_by_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_financial_reconciliations_reconciliation_number_key" ON "b2b_financial_reconciliations"("reconciliation_number");

-- CreateIndex
CREATE INDEX "b2b_financial_reconciliations_b2b_order_id_created_at_idx" ON "b2b_financial_reconciliations"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_financial_reconciliations_status_created_at_idx" ON "b2b_financial_reconciliations"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_financial_reconciliations_created_by_user_id_created_at_idx" ON "b2b_financial_reconciliations"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_erp_connections_status_updated_at_idx" ON "b2b_erp_connections"("status", "updated_at");

-- CreateIndex
CREATE INDEX "b2b_erp_connections_created_by_id_idx" ON "b2b_erp_connections"("created_by_id");

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
CREATE UNIQUE INDEX "b2b_erp_export_jobs_export_number_key" ON "b2b_erp_export_jobs"("export_number");

-- CreateIndex
CREATE INDEX "b2b_erp_export_jobs_status_created_at_idx" ON "b2b_erp_export_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "b2b_erp_export_jobs_created_by_id_created_at_idx" ON "b2b_erp_export_jobs"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_erp_export_jobs_format_created_at_idx" ON "b2b_erp_export_jobs"("format", "created_at");

-- CreateIndex
CREATE INDEX "b2b_mutation_records_b2b_order_id_created_at_idx" ON "b2b_mutation_records"("b2b_order_id", "created_at");

-- CreateIndex
CREATE INDEX "b2b_mutation_records_actor_user_id_created_at_idx" ON "b2b_mutation_records"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_mutation_records_actor_user_id_scope_idempotency_key_key" ON "b2b_mutation_records"("actor_user_id", "scope", "idempotency_key");

-- CreateIndex
CREATE INDEX "cms_announcements_starts_at_idx" ON "cms_announcements"("starts_at");

-- CreateIndex
CREATE INDEX "cms_announcements_ends_at_idx" ON "cms_announcements"("ends_at");

-- CreateIndex
CREATE INDEX "cms_announcements_status_sort_order_idx" ON "cms_announcements"("status", "sort_order");

-- CreateIndex
CREATE INDEX "banners_starts_at_idx" ON "banners"("starts_at");

-- CreateIndex
CREATE INDEX "banners_ends_at_idx" ON "banners"("ends_at");

-- CreateIndex
CREATE INDEX "banners_status_sort_order_idx" ON "banners"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_status_idx" ON "cms_pages"("status");

-- CreateIndex
CREATE INDEX "homepage_sections_status_idx" ON "homepage_sections"("status");

-- CreateIndex
CREATE INDEX "homepage_sections_section_type_status_sort_order_idx" ON "homepage_sections"("section_type", "status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "seo_entries_key_key" ON "seo_entries"("key");

-- CreateIndex
CREATE INDEX "seo_entries_entity_type_idx" ON "seo_entries"("entity_type");

-- CreateIndex
CREATE INDEX "seo_entries_entity_id_idx" ON "seo_entries"("entity_id");

-- CreateIndex
CREATE INDEX "seo_entries_route_path_idx" ON "seo_entries"("route_path");

-- CreateIndex
CREATE INDEX "seo_entries_status_idx" ON "seo_entries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cms_redirects_source_path_key" ON "cms_redirects"("source_path");

-- CreateIndex
CREATE INDEX "cms_redirects_enabled_idx" ON "cms_redirects"("enabled");

-- CreateIndex
CREATE INDEX "cms_media_assets_public_id_idx" ON "cms_media_assets"("public_id");

-- CreateIndex
CREATE INDEX "cms_media_assets_media_type_idx" ON "cms_media_assets"("media_type");

-- CreateIndex
CREATE INDEX "cms_media_assets_usage_context_idx" ON "cms_media_assets"("usage_context");

-- CreateIndex
CREATE INDEX "cms_media_assets_created_by_id_idx" ON "cms_media_assets"("created_by_id");

-- CreateIndex
CREATE INDEX "cms_revisions_entity_type_entity_id_idx" ON "cms_revisions"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "cms_revisions_actor_user_id_idx" ON "cms_revisions"("actor_user_id");

-- CreateIndex
CREATE INDEX "cms_revisions_created_at_idx" ON "cms_revisions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_revisions_entity_type_entity_id_version_key" ON "cms_revisions"("entity_type", "entity_id", "version");

-- CreateIndex
CREATE INDEX "cms_menu_items_area_status_sort_order_idx" ON "cms_menu_items"("area", "status", "sort_order");

-- CreateIndex
CREATE INDEX "cms_menu_items_parent_id_idx" ON "cms_menu_items"("parent_id");

-- CreateIndex
CREATE INDEX "support_requests_user_id_idx" ON "support_requests"("user_id");

-- CreateIndex
CREATE INDEX "support_requests_status_created_at_idx" ON "support_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_requests_topic_status_idx" ON "support_requests"("topic", "status");

-- CreateIndex
CREATE INDEX "support_requests_source_created_at_idx" ON "support_requests"("source", "created_at");

-- CreateIndex
CREATE INDEX "support_requests_order_number_idx" ON "support_requests"("order_number");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_last_message_at_idx" ON "chat_conversations"("user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_assigned_to_user_id_status_last_message__idx" ON "chat_conversations"("assigned_to_user_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_status_sensitivity_last_message_at_idx" ON "chat_conversations"("status", "sensitivity", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_requester_type_status_last_message_at_idx" ON "chat_conversations"("requester_type", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_priority_status_last_message_at_idx" ON "chat_conversations"("priority", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_sensitivity_status_last_message_at_idx" ON "chat_conversations"("sensitivity", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_first_response_due_at_idx" ON "chat_conversations"("first_response_due_at");

-- CreateIndex
CREATE INDEX "chat_conversations_sla_breached_at_idx" ON "chat_conversations"("sla_breached_at");

-- CreateIndex
CREATE INDEX "chat_conversations_order_id_idx" ON "chat_conversations"("order_id");

-- CreateIndex
CREATE INDEX "chat_conversations_product_id_idx" ON "chat_conversations"("product_id");

-- CreateIndex
CREATE INDEX "chat_conversations_b2b_enquiry_id_idx" ON "chat_conversations"("b2b_enquiry_id");

-- CreateIndex
CREATE INDEX "chat_conversations_support_request_id_idx" ON "chat_conversations"("support_request_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_sender_user_id_created_at_idx" ON "chat_messages"("sender_user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_sender_type_created_at_idx" ON "chat_messages"("sender_type", "created_at");

-- CreateIndex
CREATE INDEX "chat_assignments_conversation_id_created_at_idx" ON "chat_assignments"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_assignments_assigned_to_id_created_at_idx" ON "chat_assignments"("assigned_to_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_assignments_created_by_id_created_at_idx" ON "chat_assignments"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_conversation_events_conversation_id_created_at_idx" ON "chat_conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_conversation_events_actor_user_id_created_at_idx" ON "chat_conversation_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_conversation_events_event_type_created_at_idx" ON "chat_conversation_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "chat_bot_runs_conversation_id_created_at_idx" ON "chat_bot_runs"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_bot_runs_user_id_created_at_idx" ON "chat_bot_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_bot_runs_status_created_at_idx" ON "chat_bot_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "chat_rate_limit_buckets_action_expires_at_idx" ON "chat_rate_limit_buckets"("action", "expires_at");

-- CreateIndex
CREATE INDEX "chat_rate_limit_buckets_expires_at_idx" ON "chat_rate_limit_buckets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rate_limit_buckets_scope_key_action_bucket_key_key" ON "chat_rate_limit_buckets"("scope_key", "action", "bucket_key");

-- CreateIndex
CREATE INDEX "chat_ai_usage_summaries_usage_date_idx" ON "chat_ai_usage_summaries"("usage_date");

-- CreateIndex
CREATE INDEX "chat_ai_usage_summaries_user_id_usage_date_idx" ON "chat_ai_usage_summaries"("user_id", "usage_date");

-- CreateIndex
CREATE UNIQUE INDEX "chat_ai_usage_summaries_subject_key_usage_date_provider_mod_key" ON "chat_ai_usage_summaries"("subject_key", "usage_date", "provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notification_templates_category_idx" ON "notification_templates"("category");

-- CreateIndex
CREATE INDEX "notification_templates_status_idx" ON "notification_templates"("status");

-- CreateIndex
CREATE INDEX "notification_templates_channel_category_status_idx" ON "notification_templates"("channel", "category", "status");

-- CreateIndex
CREATE INDEX "notification_templates_theme_id_idx" ON "notification_templates"("theme_id");

-- CreateIndex
CREATE INDEX "email_trigger_rules_template_id_idx" ON "email_trigger_rules"("template_id");

-- CreateIndex
CREATE INDEX "email_trigger_rules_is_enabled_idx" ON "email_trigger_rules"("is_enabled");

-- CreateIndex
CREATE INDEX "email_trigger_rules_category_is_enabled_idx" ON "email_trigger_rules"("category", "is_enabled");

-- CreateIndex
CREATE INDEX "email_trigger_rules_category_event_code_recipient_type_idx" ON "email_trigger_rules"("category", "event_code", "recipient_type");

-- CreateIndex
CREATE UNIQUE INDEX "email_trigger_rules_event_code_recipient_type_key" ON "email_trigger_rules"("event_code", "recipient_type");

-- CreateIndex
CREATE UNIQUE INDEX "email_themes_code_key" ON "email_themes"("code");

-- CreateIndex
CREATE INDEX "email_themes_status_idx" ON "email_themes"("status");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_customer_notification_id_idx" ON "notification_logs"("customer_notification_id");

-- CreateIndex
CREATE INDEX "notification_logs_customer_push_token_id_idx" ON "notification_logs"("customer_push_token_id");

-- CreateIndex
CREATE INDEX "notification_logs_push_campaign_batch_id_idx" ON "notification_logs"("push_campaign_batch_id");

-- CreateIndex
CREATE INDEX "notification_logs_scheduled_for_idx" ON "notification_logs"("scheduled_for");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_logs_channel_created_at_idx" ON "notification_logs"("channel", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_status_created_at_idx" ON "notification_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_template_code_created_at_idx" ON "notification_logs"("template_code", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_event_code_created_at_idx" ON "notification_logs"("event_code", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_recipient_type_created_at_idx" ON "notification_logs"("recipient_type", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_trigger_rule_id_status_created_at_idx" ON "notification_logs"("trigger_rule_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "customer_notifications_customer_id_read_at_created_at_idx" ON "customer_notifications"("customer_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "customer_notifications_customer_id_created_at_idx" ON "customer_notifications"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_notifications_type_created_at_idx" ON "customer_notifications"("type", "created_at");

-- CreateIndex
CREATE INDEX "customer_notifications_source_type_source_id_idx" ON "customer_notifications"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_notifications_customer_id_type_source_type_source__key" ON "customer_notifications"("customer_id", "type", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "push_notification_campaigns_status_scheduled_at_idx" ON "push_notification_campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "push_notification_campaigns_created_at_idx" ON "push_notification_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "push_notification_campaigns_created_by_id_idx" ON "push_notification_campaigns"("created_by_id");

-- CreateIndex
CREATE INDEX "push_notification_campaigns_updated_by_id_idx" ON "push_notification_campaigns"("updated_by_id");

-- CreateIndex
CREATE INDEX "push_notification_campaign_batches_campaign_id_status_idx" ON "push_notification_campaign_batches"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "push_notification_campaign_batches_status_claimed_at_idx" ON "push_notification_campaign_batches"("status", "claimed_at");

-- CreateIndex
CREATE INDEX "push_notification_campaign_batches_created_at_idx" ON "push_notification_campaign_batches"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_notification_receipts_notification_log_id_key" ON "push_notification_receipts"("notification_log_id");

-- CreateIndex
CREATE INDEX "push_notification_receipts_status_check_after_idx" ON "push_notification_receipts"("status", "check_after");

-- CreateIndex
CREATE INDEX "push_notification_receipts_ticket_id_idx" ON "push_notification_receipts"("ticket_id");

-- CreateIndex
CREATE INDEX "push_notification_receipts_customer_push_token_id_idx" ON "push_notification_receipts"("customer_push_token_id");

-- CreateIndex
CREATE INDEX "push_notification_receipts_campaign_batch_id_idx" ON "push_notification_receipts"("campaign_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_group_idx" ON "settings"("group");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_delivery_mode_is_active_priority_idx" ON "shipping_rate_cards"("delivery_mode", "is_active", "priority");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_delivery_mode_is_active_country_code_st_idx" ON "shipping_rate_cards"("delivery_mode", "is_active", "country_code", "state_code", "city_code", "pincode", "local_area_code");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_delivery_mode_is_active_min_subtotal_pa_idx" ON "shipping_rate_cards"("delivery_mode", "is_active", "min_subtotal_paise", "max_subtotal_paise");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_country_code_idx" ON "shipping_rate_cards"("country_code");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_state_code_idx" ON "shipping_rate_cards"("state_code");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_city_code_idx" ON "shipping_rate_cards"("city_code");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_pincode_idx" ON "shipping_rate_cards"("pincode");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_local_area_code_idx" ON "shipping_rate_cards"("local_area_code");

-- CreateIndex
CREATE INDEX "shipping_rate_cards_priority_idx" ON "shipping_rate_cards"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "courier_provider_settings_provider_code_key" ON "courier_provider_settings"("provider_code");

-- CreateIndex
CREATE INDEX "courier_provider_settings_is_active_provider_code_idx" ON "courier_provider_settings"("is_active", "provider_code");

-- CreateIndex
CREATE INDEX "courier_provider_settings_mode_idx" ON "courier_provider_settings"("mode");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_created_at_idx" ON "audit_logs"("entity_type", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_credentials" ADD CONSTRAINT "admin_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_push_tokens" ADD CONSTRAINT "customer_push_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_push_tokens" ADD CONSTRAINT "customer_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "seller_subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_push_tokens" ADD CONSTRAINT "seller_push_tokens_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_push_tokens" ADD CONSTRAINT "seller_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_push_tokens" ADD CONSTRAINT "delivery_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_addresses" ADD CONSTRAINT "seller_addresses_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_service_areas" ADD CONSTRAINT "seller_service_areas_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_service_technicians" ADD CONSTRAINT "seller_service_technicians_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_service_availability_rules" ADD CONSTRAINT "seller_service_availability_rules_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_service_blocked_windows" ADD CONSTRAINT "seller_service_blocked_windows_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_courier_provider_settings" ADD CONSTRAINT "seller_courier_provider_settings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_courier_provider_settings" ADD CONSTRAINT "seller_courier_provider_settings_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "courier_provider_settings"("provider_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payout_profiles" ADD CONSTRAINT "seller_payout_profiles_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "seller_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscription_payments" ADD CONSTRAINT "seller_subscription_payments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscription_payments" ADD CONSTRAINT "seller_subscription_payments_seller_subscription_id_fkey" FOREIGN KEY ("seller_subscription_id") REFERENCES "seller_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscription_provider_events" ADD CONSTRAINT "seller_subscription_provider_events_seller_subscription_id_fkey" FOREIGN KEY ("seller_subscription_id") REFERENCES "seller_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_buyers" ADD CONSTRAINT "business_buyers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_buyer_addresses" ADD CONSTRAINT "business_buyer_addresses_business_buyer_id_fkey" FOREIGN KEY ("business_buyer_id") REFERENCES "business_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_subdivisions" ADD CONSTRAINT "location_subdivisions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "location_countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_cities" ADD CONSTRAINT "location_cities_subdivision_id_fkey" FOREIGN KEY ("subdivision_id") REFERENCES "location_subdivisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_areas" ADD CONSTRAINT "location_areas_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "location_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_import_runs" ADD CONSTRAINT "location_import_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "location_import_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_product_template_id_fkey" FOREIGN KEY ("product_template_id") REFERENCES "product_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hsn_master" ADD CONSTRAINT "hsn_master_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_template_fields" ADD CONSTRAINT "product_template_fields_product_template_id_fkey" FOREIGN KEY ("product_template_id") REFERENCES "product_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_hsn_master_id_fkey" FOREIGN KEY ("hsn_master_id") REFERENCES "hsn_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_delivery_modes" ADD CONSTRAINT "product_delivery_modes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_participations" ADD CONSTRAINT "deal_participations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_participations" ADD CONSTRAINT "deal_participations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_product_enrollments" ADD CONSTRAINT "deal_product_enrollments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_product_enrollments" ADD CONSTRAINT "deal_product_enrollments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_product_enrollments" ADD CONSTRAINT "deal_product_enrollments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage_counters" ADD CONSTRAINT "coupon_usage_counters_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_seller_eligibilities" ADD CONSTRAINT "coupon_seller_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_seller_eligibilities" ADD CONSTRAINT "coupon_seller_eligibilities_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_product_eligibilities" ADD CONSTRAINT "coupon_product_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_product_eligibilities" ADD CONSTRAINT "coupon_product_eligibilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_category_eligibilities" ADD CONSTRAINT "coupon_category_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_category_eligibilities" ADD CONSTRAINT "coupon_category_eligibilities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_customer_eligibilities" ADD CONSTRAINT "coupon_customer_eligibilities_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_customer_eligibilities" ADD CONSTRAINT "coupon_customer_eligibilities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_seller_participations" ADD CONSTRAINT "coupon_seller_participations_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_seller_participations" ADD CONSTRAINT "coupon_seller_participations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_coupon_redemption_id_fkey" FOREIGN KEY ("coupon_redemption_id") REFERENCES "coupon_redemptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemption_adjustments" ADD CONSTRAINT "coupon_redemption_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_parent_order_id_fkey" FOREIGN KEY ("parent_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_replacement_return_request_id_fkey" FOREIGN KEY ("replacement_return_request_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_replacement_source_order_item_id_fkey" FOREIGN KEY ("replacement_source_order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_replacement_source_return_item_id_fkey" FOREIGN KEY ("replacement_source_return_item_id") REFERENCES "return_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_seller_splits" ADD CONSTRAINT "order_seller_splits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_seller_splits" ADD CONSTRAINT "order_seller_splits_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_seller_splits" ADD CONSTRAINT "order_seller_splits_commission_rule_id_fkey" FOREIGN KEY ("commission_rule_id") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_seller_splits" ADD CONSTRAINT "order_seller_splits_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_delivery_partner_user_id_fkey" FOREIGN KEY ("delivery_partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_cod_collected_by_id_fkey" FOREIGN KEY ("cod_collected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_cod_verified_by_id_fkey" FOREIGN KEY ("cod_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_assignment_events" ADD CONSTRAINT "order_shipment_assignment_events_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_assignment_events" ADD CONSTRAINT "order_shipment_assignment_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_assignment_events" ADD CONSTRAINT "order_shipment_assignment_events_previous_partner_user_id_fkey" FOREIGN KEY ("previous_partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_assignment_events" ADD CONSTRAINT "order_shipment_assignment_events_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_packages" ADD CONSTRAINT "order_shipment_packages_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_packages" ADD CONSTRAINT "order_shipment_packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipment_packages" ADD CONSTRAINT "order_shipment_packages_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_notes" ADD CONSTRAINT "return_request_notes_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_notes" ADD CONSTRAINT "return_request_notes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_notes" ADD CONSTRAINT "return_request_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_amount_adjusted_by_fkey" FOREIGN KEY ("amount_adjusted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_return_request_item_id_fkey" FOREIGN KEY ("return_request_item_id") REFERENCES "return_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request_items" ADD CONSTRAINT "refund_request_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_transactions" ADD CONSTRAINT "refund_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_sequences" ADD CONSTRAINT "tax_document_sequences_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_service_booking_id_fkey" FOREIGN KEY ("service_booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "refund_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_original_document_id_fkey" FOREIGN KEY ("original_document_id") REFERENCES "tax_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_compliance" ADD CONSTRAINT "tax_document_compliance_tax_document_id_fkey" FOREIGN KEY ("tax_document_id") REFERENCES "tax_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_lines" ADD CONSTRAINT "tax_document_lines_tax_document_id_fkey" FOREIGN KEY ("tax_document_id") REFERENCES "tax_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_lines" ADD CONSTRAINT "tax_document_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_lines" ADD CONSTRAINT "tax_document_lines_return_request_item_id_fkey" FOREIGN KEY ("return_request_item_id") REFERENCES "return_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_lines" ADD CONSTRAINT "tax_document_lines_refund_request_item_id_fkey" FOREIGN KEY ("refund_request_item_id") REFERENCES "refund_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_filing_periods" ADD CONSTRAINT "gst_filing_periods_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_filing_periods" ADD CONSTRAINT "gst_filing_periods_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_filing_periods" ADD CONSTRAINT "gst_filing_periods_filed_by_id_fkey" FOREIGN KEY ("filed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_reconciliation_runs" ADD CONSTRAINT "gst_reconciliation_runs_filing_period_id_fkey" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_reconciliation_runs" ADD CONSTRAINT "gst_reconciliation_runs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_reconciliation_runs" ADD CONSTRAINT "gst_reconciliation_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_report_exports" ADD CONSTRAINT "gst_report_exports_filing_period_id_fkey" FOREIGN KEY ("filing_period_id") REFERENCES "gst_filing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_report_exports" ADD CONSTRAINT "gst_report_exports_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_report_exports" ADD CONSTRAINT "gst_report_exports_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_tax_documents" ADD CONSTRAINT "marketplace_tax_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_tax_documents" ADD CONSTRAINT "marketplace_tax_documents_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipments" ADD CONSTRAINT "reverse_shipments_assigned_partner_user_id_fkey" FOREIGN KEY ("assigned_partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipment_assignment_attempts" ADD CONSTRAINT "reverse_shipment_assignment_attempts_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipment_assignment_attempts" ADD CONSTRAINT "reverse_shipment_assignment_attempts_reverse_shipment_id_fkey" FOREIGN KEY ("reverse_shipment_id") REFERENCES "reverse_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipment_assignment_attempts" ADD CONSTRAINT "reverse_shipment_assignment_attempts_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipment_assignment_attempts" ADD CONSTRAINT "reverse_shipment_assignment_attempts_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipment_events" ADD CONSTRAINT "reverse_shipment_events_reverse_shipment_id_fkey" FOREIGN KEY ("reverse_shipment_id") REFERENCES "reverse_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reverse_shipment_events" ADD CONSTRAINT "reverse_shipment_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_delivery_partner_user_id_fkey" FOREIGN KEY ("delivery_partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_cod_collected_by_id_fkey" FOREIGN KEY ("cod_collected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_cod_verified_by_id_fkey" FOREIGN KEY ("cod_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_delivery_detail_id_fkey" FOREIGN KEY ("delivery_detail_id") REFERENCES "delivery_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "courier_provider_settings"("provider_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignments" ADD CONSTRAINT "courier_consignments_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignments" ADD CONSTRAINT "courier_consignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignments" ADD CONSTRAINT "courier_consignments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignments" ADD CONSTRAINT "courier_consignments_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "courier_provider_settings"("provider_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignment_packages" ADD CONSTRAINT "courier_consignment_packages_courier_consignment_id_fkey" FOREIGN KEY ("courier_consignment_id") REFERENCES "courier_consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignment_packages" ADD CONSTRAINT "courier_consignment_packages_order_shipment_package_id_fkey" FOREIGN KEY ("order_shipment_package_id") REFERENCES "order_shipment_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignment_packages" ADD CONSTRAINT "courier_consignment_packages_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignment_packages" ADD CONSTRAINT "courier_consignment_packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_consignment_packages" ADD CONSTRAINT "courier_consignment_packages_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_cod_remittances" ADD CONSTRAINT "courier_cod_remittances_courier_shipment_id_fkey" FOREIGN KEY ("courier_shipment_id") REFERENCES "courier_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_cod_remittances" ADD CONSTRAINT "courier_cod_remittances_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_cod_remittances" ADD CONSTRAINT "courier_cod_remittances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_cod_remittances" ADD CONSTRAINT "courier_cod_remittances_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_cod_remittances" ADD CONSTRAINT "courier_cod_remittances_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "courier_provider_settings"("provider_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_cod_remittances" ADD CONSTRAINT "courier_cod_remittances_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_profiles" ADD CONSTRAINT "delivery_partner_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_applications" ADD CONSTRAINT "delivery_partner_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_applications" ADD CONSTRAINT "delivery_partner_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_service_areas" ADD CONSTRAINT "delivery_partner_service_areas_partner_profile_id_fkey" FOREIGN KEY ("partner_profile_id") REFERENCES "delivery_partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_delivery_detail_id_fkey" FOREIGN KEY ("delivery_detail_id") REFERENCES "delivery_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_delivery_detail_id_fkey" FOREIGN KEY ("delivery_detail_id") REFERENCES "delivery_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_delivery_detail_id_fkey" FOREIGN KEY ("delivery_detail_id") REFERENCES "delivery_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_reverse_shipment_id_fkey" FOREIGN KEY ("reverse_shipment_id") REFERENCES "reverse_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "delivery_partner_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_wallet_entries" ADD CONSTRAINT "delivery_partner_wallet_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_payouts" ADD CONSTRAINT "delivery_partner_payouts_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_payouts" ADD CONSTRAINT "delivery_partner_payouts_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_payouts" ADD CONSTRAINT "delivery_partner_payouts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_payouts" ADD CONSTRAINT "delivery_partner_payouts_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_settlement_run_id_fkey" FOREIGN KEY ("settlement_run_id") REFERENCES "seller_settlement_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payout_events" ADD CONSTRAINT "seller_payout_events_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_service_booking_id_fkey" FOREIGN KEY ("service_booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_service_settlement_id_fkey" FOREIGN KEY ("service_settlement_id") REFERENCES "service_booking_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_seller_cash_receivable_id_fkey" FOREIGN KEY ("seller_cash_receivable_id") REFERENCES "seller_cash_receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_order_seller_split_id_fkey" FOREIGN KEY ("order_seller_split_id") REFERENCES "order_seller_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_order_shipment_id_fkey" FOREIGN KEY ("order_shipment_id") REFERENCES "order_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_payout_offset_id_fkey" FOREIGN KEY ("payout_offset_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivables" ADD CONSTRAINT "seller_cash_receivables_waived_by_fkey" FOREIGN KEY ("waived_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivable_events" ADD CONSTRAINT "seller_cash_receivable_events_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "seller_cash_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_cash_receivable_events" ADD CONSTRAINT "seller_cash_receivable_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_statements" ADD CONSTRAINT "seller_statements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_statements" ADD CONSTRAINT "seller_statements_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listing_images" ADD CONSTRAINT "service_listing_images_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "seller_service_technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_completion_confirmed_by_fkey" FOREIGN KEY ("completion_confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quotes" ADD CONSTRAINT "service_quotes_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_quote_line_items" ADD CONSTRAINT "service_quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "service_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payments" ADD CONSTRAINT "service_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payments" ADD CONSTRAINT "service_payments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payments" ADD CONSTRAINT "service_payments_cash_collected_by_fkey" FOREIGN KEY ("cash_collected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payment_events" ADD CONSTRAINT "service_payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "service_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_service_payment_id_fkey" FOREIGN KEY ("service_payment_id") REFERENCES "service_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_payout_offset_id_fkey" FOREIGN KEY ("payout_offset_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_disputed_by_fkey" FOREIGN KEY ("disputed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_waiver_requested_by_fkey" FOREIGN KEY ("waiver_requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivables" ADD CONSTRAINT "service_seller_receivables_waiver_approved_by_fkey" FOREIGN KEY ("waiver_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivable_events" ADD CONSTRAINT "service_seller_receivable_events_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "service_seller_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_seller_receivable_events" ADD CONSTRAINT "service_seller_receivable_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_disputes" ADD CONSTRAINT "service_disputes_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "service_refund_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_requests" ADD CONSTRAINT "service_refund_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_requests" ADD CONSTRAINT "service_refund_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_requests" ADD CONSTRAINT "service_refund_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_requests" ADD CONSTRAINT "service_refund_requests_service_payment_id_fkey" FOREIGN KEY ("service_payment_id") REFERENCES "service_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_requests" ADD CONSTRAINT "service_refund_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_requests" ADD CONSTRAINT "service_refund_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_transactions" ADD CONSTRAINT "service_refund_transactions_service_refund_request_id_fkey" FOREIGN KEY ("service_refund_request_id") REFERENCES "service_refund_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_transactions" ADD CONSTRAINT "service_refund_transactions_service_payment_id_fkey" FOREIGN KEY ("service_payment_id") REFERENCES "service_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_refund_transactions" ADD CONSTRAINT "service_refund_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_booking_settlements" ADD CONSTRAINT "service_booking_settlements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_booking_settlements" ADD CONSTRAINT "service_booking_settlements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_booking_settlements" ADD CONSTRAINT "service_booking_settlements_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reviews" ADD CONSTRAINT "service_reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_review_replies" ADD CONSTRAINT "service_review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "service_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_review_replies" ADD CONSTRAINT "service_review_replies_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiries" ADD CONSTRAINT "b2b_enquiries_business_buyer_id_fkey" FOREIGN KEY ("business_buyer_id") REFERENCES "business_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiries" ADD CONSTRAINT "b2b_enquiries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiries" ADD CONSTRAINT "b2b_enquiries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_responses" ADD CONSTRAINT "b2b_enquiry_responses_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_responses" ADD CONSTRAINT "b2b_enquiry_responses_responder_user_id_fkey" FOREIGN KEY ("responder_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_messages" ADD CONSTRAINT "b2b_enquiry_messages_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_enquiry_messages" ADD CONSTRAINT "b2b_enquiry_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_business_buyer_id_fkey" FOREIGN KEY ("business_buyer_id") REFERENCES "business_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_selected_response_id_fkey" FOREIGN KEY ("selected_response_id") REFERENCES "b2b_enquiry_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_payment_verified_by_id_fkey" FOREIGN KEY ("payment_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_fulfilment_unlocked_by_id_fkey" FOREIGN KEY ("fulfilment_unlocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_events" ADD CONSTRAINT "b2b_order_events_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_events" ADD CONSTRAINT "b2b_order_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_proofs" ADD CONSTRAINT "b2b_payment_proofs_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_proofs" ADD CONSTRAINT "b2b_payment_proofs_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_payment_proofs" ADD CONSTRAINT "b2b_payment_proofs_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_proforma_invoice_revisions" ADD CONSTRAINT "b2b_proforma_invoice_revisions_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_proforma_invoice_revisions" ADD CONSTRAINT "b2b_proforma_invoice_revisions_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_admin_audit_logs" ADD CONSTRAINT "b2b_admin_audit_logs_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_admin_audit_logs" ADD CONSTRAINT "b2b_admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "b2b_order_amendments" ADD CONSTRAINT "b2b_order_amendments_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_amendments" ADD CONSTRAINT "b2b_order_amendments_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_order_amendments" ADD CONSTRAINT "b2b_order_amendments_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_support_case_id_fkey" FOREIGN KEY ("support_case_id") REFERENCES "b2b_support_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_b2b_order_line_id_fkey" FOREIGN KEY ("b2b_order_line_id") REFERENCES "b2b_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "b2b_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_credit_note_tax_document_id_fkey" FOREIGN KEY ("credit_note_tax_document_id") REFERENCES "tax_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_replacement_enquiry_id_fkey" FOREIGN KEY ("replacement_enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_dispute_resolutions" ADD CONSTRAINT "b2b_dispute_resolutions_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_financial_reconciliations" ADD CONSTRAINT "b2b_financial_reconciliations_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_financial_reconciliations" ADD CONSTRAINT "b2b_financial_reconciliations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_erp_connections" ADD CONSTRAINT "b2b_erp_connections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_integration_outbox" ADD CONSTRAINT "b2b_integration_outbox_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "b2b_erp_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_integration_outbox" ADD CONSTRAINT "b2b_integration_outbox_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_erp_export_jobs" ADD CONSTRAINT "b2b_erp_export_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_mutation_records" ADD CONSTRAINT "b2b_mutation_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_mutation_records" ADD CONSTRAINT "b2b_mutation_records_b2b_order_id_fkey" FOREIGN KEY ("b2b_order_id") REFERENCES "b2b_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_media_assets" ADD CONSTRAINT "cms_media_assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_revisions" ADD CONSTRAINT "cms_revisions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cms_menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_b2b_enquiry_id_fkey" FOREIGN KEY ("b2b_enquiry_id") REFERENCES "b2b_enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_support_request_id_fkey" FOREIGN KEY ("support_request_id") REFERENCES "support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_assignments" ADD CONSTRAINT "chat_assignments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_assignments" ADD CONSTRAINT "chat_assignments_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_assignments" ADD CONSTRAINT "chat_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation_events" ADD CONSTRAINT "chat_conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation_events" ADD CONSTRAINT "chat_conversation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_bot_runs" ADD CONSTRAINT "chat_bot_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_bot_runs" ADD CONSTRAINT "chat_bot_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_ai_usage_summaries" ADD CONSTRAINT "chat_ai_usage_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "email_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_trigger_rules" ADD CONSTRAINT "email_trigger_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_customer_notification_id_fkey" FOREIGN KEY ("customer_notification_id") REFERENCES "customer_notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_customer_push_token_id_fkey" FOREIGN KEY ("customer_push_token_id") REFERENCES "customer_push_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_push_campaign_batch_id_fkey" FOREIGN KEY ("push_campaign_batch_id") REFERENCES "push_notification_campaign_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_trigger_rule_id_fkey" FOREIGN KEY ("trigger_rule_id") REFERENCES "email_trigger_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_campaigns" ADD CONSTRAINT "push_notification_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_campaigns" ADD CONSTRAINT "push_notification_campaigns_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_campaign_batches" ADD CONSTRAINT "push_notification_campaign_batches_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "push_notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_receipts" ADD CONSTRAINT "push_notification_receipts_notification_log_id_fkey" FOREIGN KEY ("notification_log_id") REFERENCES "notification_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_receipts" ADD CONSTRAINT "push_notification_receipts_customer_push_token_id_fkey" FOREIGN KEY ("customer_push_token_id") REFERENCES "customer_push_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_receipts" ADD CONSTRAINT "push_notification_receipts_campaign_batch_id_fkey" FOREIGN KEY ("campaign_batch_id") REFERENCES "push_notification_campaign_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
