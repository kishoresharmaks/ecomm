import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { CategorySummary, SellerAddress, SellerSummary } from "./storefront-api";

export type SellerCapability = "RETAIL" | "SERVICE";
export type ApprovalStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type ServiceListingStatus = "DRAFT" | "INACTIVE" | "ACTIVE" | "ARCHIVED";
export type ServiceVisitMode = "CUSTOMER_LOCATION" | "PROVIDER_LOCATION" | "REMOTE";
export type ServicePricingModel = "FIXED_PRICE" | "QUOTE_FIRST" | "INSPECTION_FEE";
export type ServicePaymentMode = "FULL_PAYMENT" | "ADVANCE_PAYMENT" | "INSPECTION_FEE" | "PAY_AT_VISIT";
export type ServiceBookingStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "QUOTE_REJECTED"
  | "QUOTE_EXPIRED"
  | "REJECTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETION_SUBMITTED"
  | "COMPLETION_DISPUTED"
  | "COMPLETED"
  | "CLOSED_AFTER_INSPECTION"
  | "CANCELLED"
  | "CANCELLED_AFTER_DISPUTE";
export type ServiceCancellationPolicy = "FLEXIBLE" | "MODERATE" | "STRICT";
export type ServiceQuoteStatus = "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
export type ServicePaymentPurpose = "INSPECTION_FEE" | "FULL_PAYMENT" | "ADVANCE_PAYMENT" | "FINAL_QUOTE" | "PAY_AT_VISIT";
export type PaymentProvider = "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "NOT_REQUIRED";
export type ServiceDisputeResolution = "COMPLETE_BOOKING" | "CANCEL_AFTER_DISPUTE" | "RELEASE_TO_PROVIDER" | "REFUND_CUSTOMER" | "PARTIAL_REFUND";
export type RefundRequestStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "INITIATED" | "PROCESSING" | "SUCCESS" | "FAILED" | "RETRY_PENDING" | "CANCELLED";
export type RefundMethod = "RAZORPAY" | "COD_CASH" | "BANK_TRANSFER" | "UPI" | "MANUAL";
export type RefundReason =
  | "ORDER_CANCELLED"
  | "ITEM_CANCELLED"
  | "RETURN_REFUND"
  | "RETURN_PARTIAL_REFUND"
  | "SERVICE_BOOKING_CANCELLED"
  | "SERVICE_DISPUTE_REFUND"
  | "SERVICE_DISPUTE_PARTIAL_REFUND"
  | "SELLER_NON_FULFILMENT"
  | "DAMAGED_LOST_SHIPMENT"
  | "GOODWILL_ADJUSTMENT"
  | "RTO_REFUND"
  | "ADMIN_ADJUSTMENT";
export type ServicePaymentCollectionType = "PLATFORM_ONLINE" | "PLATFORM_OFFLINE" | "PROVIDER_CASH";
export type ServicePaymentSettlementTreatment = "PAYOUT_ELIGIBLE" | "PLATFORM_RECEIVABLE" | "TRACK_ONLY";
export type ServiceCashCollectionStatus =
  | "NOT_APPLICABLE"
  | "RECORDED"
  | "CUSTOMER_CONFIRMED"
  | "CUSTOMER_DISPUTED"
  | "ADMIN_VERIFIED"
  | "ADMIN_PARTIALLY_VERIFIED"
  | "REJECTED"
  | "REOPENED";
export type ServiceCashDisputeResolution =
  | "CUSTOMER_CONFIRMED"
  | "ADMIN_FORCE_CONFIRMED"
  | "PARTIALLY_ACCEPTED"
  | "REJECTED"
  | "REOPENED_FOR_EVIDENCE";
export type ServiceSellerReceivableStatus =
  | "PROVISIONAL"
  | "OPEN"
  | "PARTIALLY_SETTLED"
  | "SETTLED"
  | "WAIVER_REQUESTED"
  | "WAIVED"
  | "DISPUTED"
  | "REVERSED"
  | "OFFSET_SCHEDULED"
  | "OFFSET_APPLIED";
export type ServiceReceivableOffsetPolicy = "MANUAL_ONLY" | "AUTO_OFFSET_NEXT_PAYOUT" | "HOLD_PAYOUT_UNTIL_SETTLED";
export type ServiceReceivableTaxAccrualStatus = "PROVISIONAL" | "ACCRUED" | "REVERSED" | "NOT_APPLICABLE";
export type ServiceReceivableWaiverApprovalStatus = "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";

export type ServiceListingImage = {
  id?: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type ServicePackage = {
  id?: string;
  name: string;
  description?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  currency?: string;
  durationMinutes?: number | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type ServiceArea = {
  id?: string;
  label?: string | null;
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
  pincode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  radiusKm?: number | null;
  isActive?: boolean;
};

export type ServiceReview = {
  id: string;
  rating: number;
  body?: string | null;
  isVisible?: boolean;
  createdAt?: string;
  customer?: { displayName?: string | null; user?: { email?: string | null; fullName?: string | null; phone?: string | null } };
  seller?: SellerSummary;
  listing?: { id: string; title: string; slug: string };
  booking?: { id: string; bookingNumber: string; status: ServiceBookingStatus; completionConfirmedAt?: string | null };
  reply?: { body: string; createdAt?: string; provider?: { fullName?: string | null; email?: string | null } } | null;
};

export type ServiceListing = {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  status: ServiceListingStatus;
  approvalStatus: ApprovalStatus;
  pricingModel: ServicePricingModel;
  paymentMode: ServicePaymentMode;
  cancellationPolicy: ServiceCancellationPolicy;
  basePricePaise?: number | null;
  inspectionFeePaise?: number | null;
  advanceAmountPaise?: number | null;
  currency: string;
  quoteTtlHours?: number;
  serviceDurationMinutes?: number | null;
  allowedVisitModes: ServiceVisitMode[];
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  requirements?: string[];
  serviceRating?: number | string | null;
  serviceReviewCount?: number;
  seller: SellerSummary & {
    serviceRating?: number | string | null;
    serviceReviewCount?: number;
    addresses?: SellerAddress[];
  };
  category?: CategorySummary;
  packages: ServicePackage[];
  images: ServiceListingImage[];
  areas: ServiceArea[];
  reviews?: ServiceReview[];
  serviceability?: {
    serviceable: boolean;
    matchLevel?: string;
    reason?: string;
    distanceKm?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceQuote = {
  id: string;
  quoteNumber: string;
  status: ServiceQuoteStatus;
  subtotalPaise: number;
  totalPaise: number;
  currency: string;
  note?: string | null;
  expiresAt: string;
  sentAt?: string;
  withdrawnAt?: string | null;
  withdrawalNote?: string | null;
  lineItems?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPaise: number;
    totalPaise: number;
  }>;
};

export type ServicePayment = {
  id: string;
  provider: PaymentProvider;
  purpose: ServicePaymentPurpose;
  collectionType?: ServicePaymentCollectionType;
  settlementTreatment?: ServicePaymentSettlementTreatment;
  cashCollectionStatus?: ServiceCashCollectionStatus;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey?: string | null;
  cashCollectionEventId?: string | null;
  attemptNumber?: number;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  referenceNumber?: string | null;
  cashCollectedAt?: string | null;
  customerCashConfirmedAt?: string | null;
  adminCashVerifiedAt?: string | null;
  cashDisputedAt?: string | null;
  cashDisputeReason?: string | null;
  cashDisputeResolution?: ServiceCashDisputeResolution | null;
  cashResolutionNote?: string | null;
  sellerReceivables?: ServiceSellerReceivable[];
  paidAt?: string | null;
  createdAt?: string;
};

export type ServiceSellerReceivable = {
  id: string;
  receivableNumber: string;
  sellerId: string;
  bookingId: string;
  servicePaymentId?: string | null;
  status: ServiceSellerReceivableStatus;
  offsetPolicy: ServiceReceivableOffsetPolicy;
  taxAccrualStatus: ServiceReceivableTaxAccrualStatus;
  waiverApprovalStatus: ServiceReceivableWaiverApprovalStatus;
  grossCashCollectedPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  reversalPaise: number;
  waivedPaise: number;
  settledPaise: number;
  offsetPaise: number;
  amountDueToPlatformPaise: number;
  currency: string;
  cashCollectionEventId?: string | null;
  disputeReason?: string | null;
  resolution?: ServiceCashDisputeResolution | null;
  resolutionNote?: string | null;
  waiverRequestedPaise?: number;
  waiverReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  seller?: SellerSummary;
  booking?: ServiceBooking;
  servicePayment?: ServicePayment | null;
  payoutOffset?: { id: string; payoutNumber: string; status: string; netPayablePaise: number } | null;
  events?: Array<{
    id: string;
    eventType: string;
    oldStatus?: ServiceSellerReceivableStatus | null;
    newStatus?: ServiceSellerReceivableStatus | null;
    resolution?: ServiceCashDisputeResolution | null;
    amountDeltaPaise?: number | null;
    oldAmountDuePaise?: number | null;
    newAmountDuePaise?: number | null;
    note?: string | null;
    createdAt?: string;
  }>;
};

export type ServiceRazorpayOrderResponse = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  bookingNumber: string;
  servicePaymentId: string;
  purpose: ServicePaymentPurpose;
};

export type ServiceRazorpayVerificationPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type ServiceRazorpayVerificationResponse = {
  received: boolean;
  paymentId: string;
  status: PaymentStatus;
  ignored?: boolean;
  reason?: string;
};

export type ServiceTechnician = {
  id?: string;
  sellerId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  skills?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceAvailabilityRule = {
  id?: string;
  sellerId?: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  capacity: number;
  note?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceBlockedWindow = {
  id?: string;
  sellerId?: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  isFullDay?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceDispute = {
  id: string;
  reason: string;
  evidence?: string[];
  evidenceKeys?: string[];
  adminNote?: string | null;
  resolution?: ServiceDisputeResolution | null;
  refundAmountPaise?: number;
  refundRequestId?: string | null;
  refundRequest?: ServiceRefundRequest | null;
  resolvedAt?: string | null;
  createdAt?: string;
};

export type ServiceRefundTransaction = {
  id: string;
  method: RefundMethod;
  status: "INITIATED" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED";
  amountPaise: number;
  currency: string;
  providerRefundId?: string | null;
  manualReference?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  processedAt?: string | null;
  createdAt?: string;
};

export type ServiceRefundRequest = {
  id: string;
  refundNumber: string;
  bookingId: string;
  customerId: string;
  sellerId: string;
  servicePaymentId?: string | null;
  status: RefundRequestStatus;
  reason: RefundReason;
  method?: RefundMethod | null;
  amountPaise: number;
  currency: string;
  note?: string | null;
  providerRefundId?: string | null;
  approvedAt?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  booking?: ServiceBooking;
  servicePayment?: ServicePayment | null;
  transactions?: ServiceRefundTransaction[];
};

export type ServiceBooking = {
  id: string;
  bookingNumber: string;
  status: ServiceBookingStatus;
  visitMode: ServiceVisitMode;
  paymentMode: ServicePaymentMode;
  cancellationPolicy: ServiceCancellationPolicy;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  assignedTechnicianId?: string | null;
  addressSnapshot?: Record<string, unknown> | null;
  customerIssue: string;
  customerNote?: string | null;
  providerNote?: string | null;
  cancellationReason?: string | null;
  cancellationFeePaise?: number;
  cancellationRefundPaise?: number;
  cancellationPolicySnapshot?: Record<string, unknown> | null;
  completionNote?: string | null;
  completionImages?: string[];
  completionProofKeys?: string[];
  completionSubmittedAt?: string | null;
  completionConfirmedAt?: string | null;
  technicianEnRouteAt?: string | null;
  technicianArrivedAt?: string | null;
  technicianCheckInAt?: string | null;
  technicianCheckOutAt?: string | null;
  technicianFieldStatusNote?: string | null;
  technicianFieldProofKeys?: string[];
  technicianLastLatitude?: number | string | null;
  technicianLastLongitude?: number | string | null;
  subtotalPaise: number;
  inspectionFeePaise: number;
  advanceAmountPaise: number;
  totalPayablePaise: number;
  paidAmountPaise: number;
  currency: string;
  customer?: { displayName?: string | null; user?: { email?: string | null; fullName?: string | null; phone?: string | null } };
  seller: SellerSummary;
  listing: ServiceListing;
  package?: ServicePackage | null;
  assignedTechnician?: ServiceTechnician | null;
  quotes?: ServiceQuote[];
  payments?: ServicePayment[];
  sellerReceivables?: ServiceSellerReceivable[];
  disputes?: ServiceDispute[];
  refundRequests?: ServiceRefundRequest[];
  settlement?: {
    grossAmountPaise: number;
    commissionPaise: number;
    netPayablePaise: number;
    status: string;
  } | null;
  reviews?: ServiceReview[];
  createdAt?: string;
  updatedAt?: string;
};

export type PaginatedServices = { items: ServiceListing[]; total: number; page: number; limit: number };
export type PaginatedServiceBookings = { items: ServiceBooking[]; total: number; page: number; limit: number };
export type PaginatedServiceReceivables = { items: ServiceSellerReceivable[]; total: number; page: number; limit: number };
export type PaginatedServiceRefunds = { items: ServiceRefundRequest[]; total: number; page: number; limit: number };
export type PaginatedServiceReviews = { items: ServiceReview[]; total: number; page: number; limit: number };
export type ServiceCalendar = {
  availabilityRules: ServiceAvailabilityRule[];
  blockedWindows: ServiceBlockedWindow[];
  technicians: ServiceTechnician[];
  bookings: ServiceBooking[];
  diagnostics?: {
    hasCustomAvailability?: boolean;
    scheduledBookingCount?: number;
    unscheduledBookingCount?: number;
  };
};

export type ServiceListingPayload = {
  categoryId: string;
  title: string;
  description: string;
  pricingModel: ServicePricingModel;
  paymentMode: ServicePaymentMode;
  cancellationPolicy?: ServiceCancellationPolicy;
  basePricePaise?: number;
  inspectionFeePaise?: number;
  advanceAmountPaise?: number;
  currency?: string;
  quoteTtlHours?: number;
  serviceDurationMinutes?: number;
  allowedVisitModes: ServiceVisitMode[];
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  requirements?: string[];
  images?: ServiceListingImage[];
  packages?: ServicePackage[];
  areas?: ServiceArea[];
};

export type ServiceQuery = {
  search?: string;
  categoryId?: string;
  sellerId?: string;
  status?: string;
  approvalStatus?: string;
  taxAccrualStatus?: string;
  offsetPolicy?: string;
  waiverApprovalStatus?: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  page?: number;
  limit?: number;
};

export type ServiceBookingPayload = {
  serviceSlug: string;
  servicePackageId?: string;
  visitMode: ServiceVisitMode;
  scheduledStartAt?: string;
  customerIssue: string;
  customerNote?: string;
  addressId?: string;
  addressSnapshot?: Record<string, unknown>;
};

export type ServiceCalendarPayload = {
  availabilityRules?: ServiceAvailabilityRule[];
  blockedWindows?: ServiceBlockedWindow[];
  technicians?: ServiceTechnician[];
};

export function listPublicServices(query: ServiceQuery = {}) {
  return indihubFetch<PaginatedServices>(`/api/services${queryString(query)}`);
}

export function getPublicService(slug: string, query: ServiceQuery = {}) {
  return indihubFetch<ServiceListing>(`/api/services/${encodeURIComponent(slug)}${queryString(query)}`);
}

export function listSellerServices(auth: IndihubAuthHeaders, query: ServiceQuery = {}) {
  return indihubFetch<PaginatedServices>(`/api/seller/services${queryString(query)}`, undefined, auth);
}

export function getSellerService(auth: IndihubAuthHeaders, serviceId: string) {
  return indihubFetch<ServiceListing>(`/api/seller/services/${encodeURIComponent(serviceId)}`, undefined, auth);
}

export function createSellerService(auth: IndihubAuthHeaders, payload: ServiceListingPayload) {
  return indihubFetch<ServiceListing>("/api/seller/services", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function updateSellerService(auth: IndihubAuthHeaders, serviceId: string, payload: ServiceListingPayload) {
  return indihubFetch<ServiceListing>(
    `/api/seller/services/${encodeURIComponent(serviceId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function archiveSellerService(auth: IndihubAuthHeaders, serviceId: string) {
  return indihubFetch<{ deleted: boolean }>(`/api/seller/services/${encodeURIComponent(serviceId)}`, { method: "DELETE" }, auth);
}

export function listSellerServiceBookings(auth: IndihubAuthHeaders, query: { status?: string; page?: number; limit?: number } = {}) {
  return indihubFetch<PaginatedServiceBookings>(`/api/seller/service-bookings${queryString(query)}`, undefined, auth);
}

export function getSellerServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(`/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}`, undefined, auth);
}

export function getSellerServiceCalendar(auth: IndihubAuthHeaders) {
  return indihubFetch<ServiceCalendar>("/api/seller/service-calendar", undefined, auth);
}

export function updateSellerServiceCalendar(auth: IndihubAuthHeaders, payload: ServiceCalendarPayload) {
  return indihubFetch<ServiceCalendar>("/api/seller/service-calendar", { method: "PATCH", body: JSON.stringify(payload) }, auth);
}

export function sellerAcceptServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string, payload: { note?: string; scheduledStartAt?: string; assignedTechnicianId?: string }) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/accept`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function sellerRescheduleServiceBooking(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: { scheduledStartAt: string; assignedTechnicianId?: string; note?: string },
) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/reschedule`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function sellerRejectServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string, reason: string) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/reject`,
    { method: "PATCH", body: JSON.stringify({ reason }) },
    auth,
  );
}

export function sellerSendServiceQuote(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: { lineItems: Array<{ description: string; quantity?: number; unitPaise: number }>; note?: string; ttlHours?: number },
) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/quotes`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function sellerWithdrawServiceQuote(auth: IndihubAuthHeaders, bookingNumber: string, payload: { note?: string } = {}) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/quotes/withdraw`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function sellerUpdateServiceFieldStatus(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: { status: "EN_ROUTE" | "ARRIVED" | "CHECKED_IN" | "CHECKED_OUT"; latitude?: number; longitude?: number; note?: string; fieldProofKeys?: string[] },
) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/field-status`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function listSellerServiceReviews(
  auth: IndihubAuthHeaders,
  query: { status?: string; rating?: number; search?: string; page?: number; limit?: number } = {},
) {
  return indihubFetch<PaginatedServiceReviews>(`/api/seller/service-reviews${queryString(query)}`, undefined, auth);
}

export function replyToSellerServiceReview(auth: IndihubAuthHeaders, reviewId: string, payload: { body: string }) {
  return indihubFetch<ServiceReview>(
    `/api/seller/service-reviews/${encodeURIComponent(reviewId)}/reply`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function sellerMarkServiceInProgress(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/in-progress`,
    { method: "PATCH" },
    auth,
  );
}

export function sellerSubmitServiceCompletion(auth: IndihubAuthHeaders, bookingNumber: string, payload: { completionNote: string; completionImages?: string[]; completionProofKeys?: string[] }) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/submit-completion`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function recordSellerServicePayment(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: { provider: PaymentProvider; purpose: ServicePaymentPurpose; amountPaise: number; referenceNumber?: string; markPaid?: boolean },
) {
  return indihubFetch<ServicePayment>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/payments`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function recordSellerServiceCashCollection(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: {
    amountPaise: number;
    purpose?: ServicePaymentPurpose;
    idempotencyKey?: string;
    cashCollectionEventId?: string;
    attemptNumber?: number;
    note?: string;
  },
) {
  return indihubFetch<ServicePayment>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/cash-collections`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function createCustomerServiceBooking(auth: IndihubAuthHeaders, payload: ServiceBookingPayload) {
  return indihubFetch<ServiceBooking>("/api/account/service-bookings", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function listCustomerServiceBookings(auth: IndihubAuthHeaders, query: { status?: string; page?: number; limit?: number } = {}) {
  return indihubFetch<PaginatedServiceBookings>(`/api/account/service-bookings${queryString(query)}`, undefined, auth);
}

export function getCustomerServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(`/api/account/service-bookings/${encodeURIComponent(bookingNumber)}`, undefined, auth);
}

export function createCustomerServiceRazorpayOrder(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  paymentId: string,
) {
  return indihubFetch<ServiceRazorpayOrderResponse>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/payments/${encodeURIComponent(paymentId)}/razorpay-order`,
    { method: "POST" },
    auth,
  );
}

export function verifyCustomerServiceRazorpayPayment(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: ServiceRazorpayVerificationPayload,
) {
  return indihubFetch<ServiceRazorpayVerificationResponse>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/payments/razorpay/verify`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function confirmCustomerServiceCashCollection(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  paymentId: string,
  payload: { note?: string } = {},
) {
  return indihubFetch<ServiceBooking>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/cash-collections/${encodeURIComponent(paymentId)}/confirm`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function disputeCustomerServiceCashCollection(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  paymentId: string,
  payload: { reason: string },
) {
  return indihubFetch<ServiceBooking>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/cash-collections/${encodeURIComponent(paymentId)}/dispute`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function acceptCustomerServiceQuote(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/quotes/accept`,
    { method: "PATCH" },
    auth,
  );
}

export function rejectCustomerServiceQuote(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/quotes/reject`,
    { method: "PATCH" },
    auth,
  );
}

export function confirmCustomerServiceCompletion(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/confirm-completion`,
    { method: "PATCH" },
    auth,
  );
}

export function raiseCustomerServiceDispute(auth: IndihubAuthHeaders, bookingNumber: string, payload: { reason: string; evidence?: string[]; evidenceKeys?: string[] }) {
  return indihubFetch<ServiceBooking>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/disputes`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function createCustomerServiceReview(auth: IndihubAuthHeaders, bookingNumber: string, payload: { rating: number; body?: string }) {
  return indihubFetch<ServiceReview>(
    `/api/account/service-bookings/${encodeURIComponent(bookingNumber)}/reviews`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminListServices(auth: IndihubAuthHeaders, query: ServiceQuery = {}) {
  return indihubFetch<PaginatedServices>(`/api/admin/services${queryString(query)}`, undefined, auth);
}

export function adminUpdateServiceApproval(
  auth: IndihubAuthHeaders,
  serviceId: string,
  payload: { approvalStatus: ApprovalStatus; status?: ServiceListingStatus; note?: string },
) {
  return indihubFetch<ServiceListing>(
    `/api/admin/services/${encodeURIComponent(serviceId)}/approval`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminListServiceBookings(auth: IndihubAuthHeaders, query: { status?: string; page?: number; limit?: number } = {}) {
  return indihubFetch<PaginatedServiceBookings>(`/api/admin/service-bookings${queryString(query)}`, undefined, auth);
}

export function adminCancelServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string, reason: string) {
  return indihubFetch<ServiceBooking>(
    `/api/admin/service-bookings/${encodeURIComponent(bookingNumber)}/cancel`,
    { method: "PATCH", body: JSON.stringify({ reason }) },
    auth,
  );
}

export function adminRecordServicePayment(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  payload: { provider: PaymentProvider; purpose: ServicePaymentPurpose; amountPaise: number; referenceNumber?: string; markPaid?: boolean },
) {
  return indihubFetch<ServicePayment>(
    `/api/admin/service-bookings/${encodeURIComponent(bookingNumber)}/payments`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminListServiceReceivables(auth: IndihubAuthHeaders, query: ServiceQuery = {}) {
  return indihubFetch<PaginatedServiceReceivables>(`/api/admin/service-receivables${queryString(query)}`, undefined, auth);
}

export function adminListServiceRefunds(auth: IndihubAuthHeaders, query: ServiceQuery = {}) {
  return indihubFetch<PaginatedServiceRefunds>(`/api/admin/service-refunds${queryString(query)}`, undefined, auth);
}

export function adminListServiceReviews(
  auth: IndihubAuthHeaders,
  query: { status?: string; rating?: number; search?: string; page?: number; limit?: number } = {},
) {
  return indihubFetch<PaginatedServiceReviews>(`/api/admin/service-reviews${queryString(query)}`, undefined, auth);
}

export function adminHideServiceReview(auth: IndihubAuthHeaders, reviewId: string) {
  return indihubFetch<ServiceReview>(
    `/api/admin/service-reviews/${encodeURIComponent(reviewId)}/hide`,
    { method: "PATCH" },
    auth,
  );
}

export function adminRestoreServiceReview(auth: IndihubAuthHeaders, reviewId: string) {
  return indihubFetch<ServiceReview>(
    `/api/admin/service-reviews/${encodeURIComponent(reviewId)}/restore`,
    { method: "PATCH" },
    auth,
  );
}

export function adminApproveServiceRefund(auth: IndihubAuthHeaders, refundNumber: string, payload: { note?: string } = {}) {
  return indihubFetch<ServiceRefundRequest>(
    `/api/admin/service-refunds/${encodeURIComponent(refundNumber)}/approve`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminInitiateServiceRefund(auth: IndihubAuthHeaders, refundNumber: string, payload: { method?: RefundMethod; note?: string } = {}) {
  return indihubFetch<ServiceRefundRequest>(
    `/api/admin/service-refunds/${encodeURIComponent(refundNumber)}/initiate`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminRecordManualServiceRefund(
  auth: IndihubAuthHeaders,
  refundNumber: string,
  payload: { method: Exclude<RefundMethod, "RAZORPAY">; manualReference: string; paidAt: string; note?: string },
) {
  return indihubFetch<ServiceRefundRequest>(
    `/api/admin/service-refunds/${encodeURIComponent(refundNumber)}/manual-record`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminResolveServiceReceivable(
  auth: IndihubAuthHeaders,
  receivableNumber: string,
  payload: { resolution: ServiceCashDisputeResolution; acceptedCashPaise?: number; note: string },
) {
  return indihubFetch<ServiceSellerReceivable>(
    `/api/admin/service-receivables/${encodeURIComponent(receivableNumber)}/resolve`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminSettleServiceReceivable(
  auth: IndihubAuthHeaders,
  receivableNumber: string,
  payload: { amountPaise: number; referenceNumber?: string; note?: string },
) {
  return indihubFetch<ServiceSellerReceivable>(
    `/api/admin/service-receivables/${encodeURIComponent(receivableNumber)}/settle`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminRequestServiceReceivableWaiver(
  auth: IndihubAuthHeaders,
  receivableNumber: string,
  payload: { amountPaise: number; reason: string; waiverLimitPaise?: number },
) {
  return indihubFetch<ServiceSellerReceivable>(
    `/api/admin/service-receivables/${encodeURIComponent(receivableNumber)}/waiver-request`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminDecideServiceReceivableWaiver(
  auth: IndihubAuthHeaders,
  receivableNumber: string,
  payload: { decision: Exclude<ServiceReceivableWaiverApprovalStatus, "NOT_REQUESTED" | "PENDING">; note?: string },
) {
  return indihubFetch<ServiceSellerReceivable>(
    `/api/admin/service-receivables/${encodeURIComponent(receivableNumber)}/waiver-decision`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminSetServiceReceivableOffsetPolicy(
  auth: IndihubAuthHeaders,
  receivableNumber: string,
  payload: { offsetPolicy: ServiceReceivableOffsetPolicy; note?: string },
) {
  return indihubFetch<ServiceSellerReceivable>(
    `/api/admin/service-receivables/${encodeURIComponent(receivableNumber)}/offset-policy`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function adminResolveServiceDispute(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  disputeId: string,
  payload: { resolution: ServiceDisputeResolution; adminNote: string; refundAmountPaise?: number },
) {
  return indihubFetch<ServiceBooking>(
    `/api/admin/service-bookings/${encodeURIComponent(bookingNumber)}/disputes/${encodeURIComponent(disputeId)}/resolve`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function updateSellerCapabilities(
  auth: IndihubAuthHeaders,
  sellerId: string,
  payload: { enabledCapabilities: SellerCapability[]; primaryCapability: SellerCapability; reason: string },
) {
  return indihubFetch(
    `/api/admin/sellers/${encodeURIComponent(sellerId)}/capabilities`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return params.size ? `?${params.toString()}` : "";
}
