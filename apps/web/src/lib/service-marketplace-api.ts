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
export type ServiceDisputeResolution = "COMPLETE_BOOKING" | "CANCEL_BOOKING" | "RELEASE_TO_PROVIDER" | "REFUND_CUSTOMER";

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
  customer?: { displayName?: string | null; user?: { email?: string | null } };
  reply?: { body: string; createdAt?: string } | null;
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
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  referenceNumber?: string | null;
  paidAt?: string | null;
  createdAt?: string;
};

export type ServiceDispute = {
  id: string;
  reason: string;
  evidence?: string[];
  adminNote?: string | null;
  resolution?: ServiceDisputeResolution | null;
  resolvedAt?: string | null;
  createdAt?: string;
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
  addressSnapshot?: Record<string, unknown> | null;
  customerIssue: string;
  customerNote?: string | null;
  providerNote?: string | null;
  cancellationReason?: string | null;
  completionNote?: string | null;
  completionImages?: string[];
  completionSubmittedAt?: string | null;
  completionConfirmedAt?: string | null;
  subtotalPaise: number;
  inspectionFeePaise: number;
  advanceAmountPaise: number;
  totalPayablePaise: number;
  paidAmountPaise: number;
  currency: string;
  customer?: { displayName?: string | null; user?: { email?: string | null } };
  seller: SellerSummary;
  listing: ServiceListing;
  package?: ServicePackage | null;
  quotes?: ServiceQuote[];
  payments?: ServicePayment[];
  disputes?: ServiceDispute[];
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

export function sellerAcceptServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string, payload: { note?: string; scheduledStartAt?: string }) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/accept`,
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

export function sellerMarkServiceInProgress(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(
    `/api/seller/service-bookings/${encodeURIComponent(bookingNumber)}/in-progress`,
    { method: "PATCH" },
    auth,
  );
}

export function sellerSubmitServiceCompletion(auth: IndihubAuthHeaders, bookingNumber: string, payload: { completionNote: string; completionImages?: string[] }) {
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

export function createCustomerServiceBooking(auth: IndihubAuthHeaders, payload: ServiceBookingPayload) {
  return indihubFetch<ServiceBooking>("/api/account/service-bookings", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function listCustomerServiceBookings(auth: IndihubAuthHeaders, query: { status?: string; page?: number; limit?: number } = {}) {
  return indihubFetch<PaginatedServiceBookings>(`/api/account/service-bookings${queryString(query)}`, undefined, auth);
}

export function getCustomerServiceBooking(auth: IndihubAuthHeaders, bookingNumber: string) {
  return indihubFetch<ServiceBooking>(`/api/account/service-bookings/${encodeURIComponent(bookingNumber)}`, undefined, auth);
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

export function raiseCustomerServiceDispute(auth: IndihubAuthHeaders, bookingNumber: string, payload: { reason: string; evidence?: string[] }) {
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

export function adminResolveServiceDispute(
  auth: IndihubAuthHeaders,
  bookingNumber: string,
  disputeId: string,
  payload: { resolution: ServiceDisputeResolution; adminNote: string },
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
