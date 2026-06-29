export type BackendPricingModel = "FIXED_PRICE" | "QUOTE_FIRST" | "INSPECTION_FEE";
export type BackendVisitMode = "CUSTOMER_LOCATION" | "PROVIDER_LOCATION" | "REMOTE";
export type BackendBookingStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "QUOTE_EXPIRED"
  | "QUOTE_REJECTED"
  | "CLOSED_AFTER_INSPECTION"
  | "REJECTED"
  | "CANCELLED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETION_SUBMITTED"
  | "COMPLETION_DISPUTED"
  | "COMPLETED"
  | "CANCELLED_AFTER_DISPUTE";

export type BackendServiceListingStatus = "DRAFT" | "INACTIVE" | "ACTIVE" | "ARCHIVED";
export type BackendServicePaymentMode = "FULL_PAYMENT" | "ADVANCE_PAYMENT" | "INSPECTION_FEE" | "PAY_AT_VISIT";
export type BackendServiceQuoteStatus = "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
export type BackendPaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "NOT_REQUIRED";

export type MobilePricingModel = "fixed_price" | "quote_first" | "inspection_fee";
export type MobileVisitMode = "customer_location" | "provider_location" | "remote";
export type MobileBookingStatus =
  | "requested"
  | "accepted"
  | "quote_sent"
  | "quote_accepted"
  | "quote_expired"
  | "quote_rejected"
  | "closed_after_inspection"
  | "rejected"
  | "cancelled"
  | "scheduled"
  | "in_progress"
  | "completion_submitted"
  | "completion_disputed"
  | "completed"
  | "cancelled_after_dispute";

export type MobilePaymentStatus = "pending" | "paid" | "failed" | "refunded" | "not_required";
export type MobileServiceAction = "accept_quote" | "reject_quote" | "cancel" | "confirm_completion" | "raise_dispute" | "submit_review";

export type BackendServicePackage = {
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

export type BackendServiceImage = {
  id?: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type BackendServiceListing = {
  id: string;
  sellerId?: string;
  categoryId?: string;
  title: string;
  slug: string;
  description: string;
  status: BackendServiceListingStatus;
  pricingModel: BackendPricingModel;
  paymentMode?: BackendServicePaymentMode;
  basePricePaise?: number | null;
  inspectionFeePaise?: number | null;
  advanceAmountPaise?: number | null;
  currency: string;
  serviceDurationMinutes?: number | null;
  allowedVisitModes: BackendVisitMode[];
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  requirements?: string[];
  serviceRating?: number | string | null;
  serviceReviewCount?: number;
  seller?: {
    id?: string;
    storeName?: string | null;
    slug?: string | null;
    serviceRating?: number | string | null;
    serviceReviewCount?: number;
  };
  category?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
  };
  packages?: BackendServicePackage[];
  images?: BackendServiceImage[];
  reviews?: BackendServiceReview[];
  serviceability?: {
    serviceable: boolean;
    matchLevel?: string;
    reason?: string;
    distanceKm?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type BackendPaginatedServices = {
  items: BackendServiceListing[];
  total: number;
  page: number;
  limit: number;
};

export type BackendServiceQuote = {
  id: string;
  quoteNumber?: string;
  status: BackendServiceQuoteStatus;
  subtotalPaise: number;
  totalPaise: number;
  currency: string;
  note?: string | null;
  expiresAt?: string;
  sentAt?: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
};

export type BackendServicePayment = {
  id: string;
  provider?: string;
  purpose?: string;
  amountPaise: number;
  currency: string;
  status: BackendPaymentStatus;
  referenceNumber?: string | null;
  paidAt?: string | null;
  createdAt?: string;
};

export type BackendServiceDispute = {
  id: string;
  reason: string;
  evidence?: string[] | null;
  resolution?: string | null;
  adminNote?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
};

export type BackendServiceReview = {
  id: string;
  rating: number;
  body?: string | null;
  isVisible?: boolean;
  createdAt?: string;
};

export type BackendServiceBooking = {
  id: string;
  bookingNumber: string;
  status: BackendBookingStatus;
  visitMode: BackendVisitMode;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  addressSnapshot?: Record<string, unknown> | null;
  customerIssue: string;
  customerNote?: string | null;
  providerNote?: string | null;
  cancellationReason?: string | null;
  completionNote?: string | null;
  completionSubmittedAt?: string | null;
  completionConfirmedAt?: string | null;
  subtotalPaise: number;
  inspectionFeePaise: number;
  advanceAmountPaise: number;
  totalPayablePaise: number;
  paidAmountPaise: number;
  currency: string;
  seller?: {
    id?: string;
    storeName?: string | null;
    slug?: string | null;
  };
  listing: BackendServiceListing;
  package?: BackendServicePackage | null;
  quotes?: BackendServiceQuote[];
  payments?: BackendServicePayment[];
  disputes?: BackendServiceDispute[];
  reviews?: BackendServiceReview[];
  createdAt?: string;
  updatedAt?: string;
};

export type BackendPaginatedServiceBookings = {
  items: BackendServiceBooking[];
  total: number;
  page: number;
  limit: number;
};

export type MobileServiceAddressSnapshot = {
  label?: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  countryCode: string;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type MobileServicePackage = {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number | null;
  currency: string;
  durationMinutes: number | null;
};

export type MobileServiceListing = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryName: string | null;
  sellerName: string | null;
  pricingModel: MobilePricingModel;
  paymentMode: BackendServicePaymentMode | null;
  basePricePaise: number | null;
  inspectionFeePaise: number | null;
  advanceAmountPaise: number | null;
  currency: string;
  coverImageUrl: string | null;
  isActive: boolean;
  visitModes: MobileVisitMode[];
  serviceRating: number | null;
  serviceReviewCount: number;
  serviceability: BackendServiceListing["serviceability"] | null;
};

export type MobileServiceDetail = MobileServiceListing & {
  packages: MobileServicePackage[];
  images: BackendServiceImage[];
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  requirements: string[];
  reviews: MobileServiceReview[];
};

export type MobileServiceQuote = {
  id: string;
  status: BackendServiceQuoteStatus;
  amountPaise: number;
  currency: string;
  note: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

export type MobileServicePayment = {
  id: string;
  amountPaise: number;
  currency: string;
  status: MobilePaymentStatus;
  provider: string | null;
  purpose: string | null;
  paidAt: string | null;
  description: string | null;
};

export type MobileServiceDispute = {
  id: string;
  reason: string;
  evidence: string[] | null;
  status: "open" | "resolved";
  raisedAt: string | null;
  resolvedAt: string | null;
};

export type MobileServiceReview = {
  id: string;
  rating: number;
  body: string | null;
  submittedAt: string | null;
};

export type MobileServiceBooking = {
  id: string;
  bookingNumber: string;
  serviceSlug: string;
  serviceName: string;
  packageId: string | null;
  packageName: string | null;
  status: MobileBookingStatus;
  visitMode: MobileVisitMode;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  location: MobileServiceAddressSnapshot | null;
  customerIssue: string;
  customerNote: string | null;
  providerName: string | null;
  pricingModel: MobilePricingModel;
  subtotalPaise: number;
  inspectionFeePaise: number;
  advanceAmountPaise: number;
  totalPayablePaise: number;
  paidAmountPaise: number;
  currency: string;
  quote: MobileServiceQuote | null;
  payments: MobileServicePayment[];
  dispute: MobileServiceDispute | null;
  review: MobileServiceReview | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MobileServiceBookingFormValues = {
  idempotencyKey?: string | null;
  serviceSlug: string;
  selectedPackageId: string | null;
  visitMode: MobileVisitMode;
  savedAddressId: string | null;
  addressSnapshot: MobileServiceAddressSnapshot | null;
  preferredDate: string | null;
  preferredTimeSlot: string | null;
  customerIssue: string;
  customerNote: string | null;
};

export type BackendCreateServiceBookingPayload = {
  idempotencyKey?: string;
  serviceSlug: string;
  servicePackageId?: string;
  visitMode: BackendVisitMode;
  scheduledStartAt?: string;
  customerIssue: string;
  customerNote?: string;
  addressId?: string;
  addressSnapshot?: MobileServiceAddressSnapshot;
};
