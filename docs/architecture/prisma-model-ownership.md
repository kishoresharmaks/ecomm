---
schemaVersion: 1
schema: prisma/schema.prisma
---

# Prisma Model Ownership

This file is both human-readable governance and the machine-readable ownership manifest consumed by `scripts/architecture/check-prisma-ownership.ts`. Every Prisma `model` must appear exactly once as a single backticked bullet under a `## Context:` heading. Relations may cross contexts; write authority and schema-change accountability do not.

## Context: `identity-access`

- `User`
- `Role`
- `Permission`
- `UserRole`
- `AdminCredential`
- `AdminSession`
- `RolePermission`
- `Customer`
- `CustomerPushToken`
- `CustomerAddress`
- `Wishlist`
- `WishlistItem`

## Context: `seller-management`

- `Seller`
- `SellerPushToken`
- `SellerProfile`
- `SellerAddress`
- `SellerServiceArea`
- `SellerServiceTechnician`
- `SellerServiceAvailabilityRule`
- `SellerServiceBlockedWindow`
- `SellerCourierProviderSetting`
- `SellerDocument`
- `PrivateUpload`
- `SellerSubscriptionPlan`
- `SellerSubscription`
- `SellerSubscriptionPayment`
- `SellerSubscriptionProviderEvent`

## Context: `location-routing`

- `LocationCountry`
- `LocationSubdivision`
- `LocationCity`
- `LocationArea`
- `LocationImportSource`
- `LocationImportRun`

## Context: `catalog`

- `Category`
- `HsnMaster`
- `SacMaster`
- `SacMasterImportRun`
- `ProductTemplate`
- `ProductTemplateField`
- `Product`
- `ProductDeliveryMode`
- `ProductImage`
- `ProductVariant`
- `InventoryMovement`

## Context: `merchandising`

- `Deal`
- `DealParticipation`
- `DealProductEnrollment`
- `Coupon`
- `CouponUsageCounter`
- `CouponSellerEligibility`
- `CouponProductEligibility`
- `CouponCategoryEligibility`
- `CouponCustomerEligibility`
- `CouponSellerParticipation`
- `CouponRedemption`
- `CouponRedemptionAdjustment`
- `ProductReview`

## Context: `shopping-experience`

- `Cart`
- `CartItem`
- `CheckoutSession`

## Context: `order-management`

- `DeliveryPushToken`
- `Order`
- `OrderItem`
- `OrderSellerSplit`
- `OrderShipment`
- `OrderShipmentAssignmentEvent`
- `OrderShipmentPackage`
- `OrderStatusEvent`
- `ReturnRequest`
- `ReturnRequestItem`
- `ReturnRequestNote`
- `RefundRequest`
- `RefundRequestItem`
- `ReverseShipment`
- `ReverseShipmentAssignmentAttempt`
- `ReverseShipmentEvent`
- `DeliveryDetail`
- `DeliveryAssignmentAttempt`
- `CourierShipment`
- `CourierConsignment`
- `CourierConsignmentPackage`
- `CourierWebhookEvent`
- `CourierCodRemittance`
- `DeliveryPartnerProfile`
- `DeliveryPartnerApplication`
- `DeliveryPartnerServiceArea`
- `DeliveryAttempt`
- `DeliveryTrackingCounter`
- `DeliveryEvent`
- `DeliveryPartnerWalletEntry`
- `DeliveryPartnerPayout`

## Context: `discovery`

- `SearchDocument`
- `SearchIndexJob`

## Context: `finance-tax`

- `SellerPayoutProfile`
- `RefundTransaction`
- `TaxDocumentSequence`
- `TaxDocument`
- `TaxDocumentCompliance`
- `TaxDocumentLine`
- `GstFilingPeriod`
- `GstReconciliationRun`
- `GstReportExport`
- `ReportExportJob`
- `MarketplaceTaxDocumentSequence`
- `MarketplaceTaxDocument`
- `Payment`
- `RazorpayWebhookEvent`
- `CurrencyRate`
- `FxProviderSetting`
- `CommissionRule`
- `SellerSettlementRun`
- `SellerPayout`
- `SellerPayoutEvent`
- `SellerLedgerEntry`
- `SellerCashReceivable`
- `SellerCashReceivableEvent`
- `SellerStatement`
- `PaymentEvent`

## Context: `services-marketplace`

- `ServiceListing`
- `ServicePackage`
- `ServiceListingImage`
- `ServiceArea`
- `ServiceBooking`
- `ServiceQuote`
- `ServiceQuoteLineItem`
- `ServicePayment`
- `ServicePaymentEvent`
- `ServiceSellerReceivable`
- `ServiceSellerReceivableEvent`
- `ServiceDispute`
- `ServiceRefundRequest`
- `ServiceRefundTransaction`
- `ServiceBookingSettlement`
- `ServiceReview`
- `ServiceReviewReply`

## Context: `b2b-commerce`

- `BusinessBuyer`
- `BusinessBuyerAddress`
- `B2BEnquiry`
- `B2BEnquiryResponse`
- `B2BEnquiryMessage`
- `B2BOrder`
- `B2BOrderEvent`
- `B2BPaymentProof`
- `B2BProformaInvoiceRevision`
- `B2BAdminAuditLog`
- `SellerStaffMembership`
- `B2BEnquiryLine`
- `B2BQuotationLine`
- `B2BOrderLine`
- `B2BPoReview`
- `BusinessBuyerCreditProfile`
- `B2BCreditDecision`
- `B2BPaymentSchedule`
- `B2BInventoryReservation`
- `B2BFulfilmentPlan`
- `B2BProcurementOrder`
- `B2BProductionJob`
- `B2BWarehouseTask`
- `B2BWarehouseTaskItem`
- `B2BPackage`
- `B2BQcInspection`
- `B2BShipment`
- `B2BShipmentEvent`
- `B2BProofOfDelivery`
- `B2BReceivable`
- `B2BReceivableEntry`
- `B2BPaymentRecord`
- `B2BPaymentAllocation`
- `B2BReceiptVoucher`
- `B2BCollectionTask`
- `B2BSupportCase`
- `B2BOrderAmendment`
- `B2BDisputeResolution`
- `B2BFinancialReconciliation`
- `B2BErpConnection`
- `B2BIntegrationOutbox`
- `B2BErpExportJob`
- `B2BMutationRecord`

## Context: `content-support`

- `CmsAnnouncement`
- `CmsPopupAnnouncement`
- `Banner`
- `CmsPage`
- `HomepageSection`
- `SeoEntry`
- `CmsRedirect`
- `CmsMediaAsset`
- `CmsRevision`
- `CmsMenuItem`
- `SupportRequest`
- `ChatConversation`
- `ChatMessage`
- `ChatAssignment`
- `ChatConversationEvent`
- `ChatBotRun`
- `ChatRateLimitBucket`
- `ChatAiUsageSummary`

## Context: `communications`

- `NotificationTemplate`
- `EmailTriggerRule`
- `EmailTheme`
- `NotificationLog`
- `CustomerNotification`
- `PushNotificationCampaign`
- `PushNotificationCampaignBatch`
- `PushNotificationReceipt`
- `EmailSetting`

## Context: `platform`

- `Setting`
- `ShippingRateCard`
- `CourierProviderSetting`
- `AuditLog`

## Change protocol

1. The owning context approves changes to its models and migrations.
2. A relation to another context does not transfer ownership; the foreign context consumes an identifier or an explicit contract.
3. Moving a model requires an ADR or an accepted debt-register action, updates to this manifest, and passing `pnpm architecture:check`.
4. Adding, deleting, or renaming a Prisma model without updating this manifest fails the ownership fitness function.
