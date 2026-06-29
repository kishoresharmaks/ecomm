import type {
  BackendBookingStatus,
  BackendPaginatedServiceBookings,
  BackendPaginatedServices,
  BackendPaymentStatus,
  BackendPricingModel,
  BackendServiceBooking,
  BackendServiceDispute,
  BackendServiceListing,
  BackendServicePackage,
  BackendServicePayment,
  BackendServiceQuote,
  BackendServiceReview,
  BackendVisitMode,
  MobileBookingStatus,
  MobilePaymentStatus,
  MobilePricingModel,
  MobileServiceAddressSnapshot,
  MobileServiceBooking,
  MobileServiceDetail,
  MobileServiceDispute,
  MobileServiceListing,
  MobileServicePackage,
  MobileServicePayment,
  MobileServiceQuote,
  MobileServiceReview,
  MobileVisitMode,
} from "./types";

export class ServiceMappingError extends Error {
  constructor(field: string, value: string) {
    super(`Unknown service ${field}: ${value}`);
    this.name = "ServiceMappingError";
  }
}

export function assertMapped<TValue extends string>(
  map: Record<string, TValue>,
  value: string,
  field: string,
): TValue {
  const mapped = map[value];
  if (!mapped) {
    throw new ServiceMappingError(field, value);
  }
  return mapped;
}

export function mapPricingModel(raw: BackendPricingModel): MobilePricingModel {
  return assertMapped(
    {
      FIXED_PRICE: "fixed_price",
      QUOTE_FIRST: "quote_first",
      INSPECTION_FEE: "inspection_fee",
    },
    raw,
    "pricingModel",
  );
}

export function mapVisitMode(raw: BackendVisitMode): MobileVisitMode {
  return assertMapped(
    {
      CUSTOMER_LOCATION: "customer_location",
      PROVIDER_LOCATION: "provider_location",
      REMOTE: "remote",
    },
    raw,
    "visitMode",
  );
}

export function toBackendVisitMode(value: MobileVisitMode): BackendVisitMode {
  return assertMapped(
    {
      customer_location: "CUSTOMER_LOCATION",
      provider_location: "PROVIDER_LOCATION",
      remote: "REMOTE",
    },
    value,
    "visitMode",
  );
}

export function mapBookingStatus(raw: BackendBookingStatus): MobileBookingStatus {
  return assertMapped(
    {
      REQUESTED: "requested",
      ACCEPTED: "accepted",
      QUOTE_SENT: "quote_sent",
      QUOTE_ACCEPTED: "quote_accepted",
      QUOTE_EXPIRED: "quote_expired",
      QUOTE_REJECTED: "quote_rejected",
      CLOSED_AFTER_INSPECTION: "closed_after_inspection",
      REJECTED: "rejected",
      CANCELLED: "cancelled",
      SCHEDULED: "scheduled",
      IN_PROGRESS: "in_progress",
      COMPLETION_SUBMITTED: "completion_submitted",
      COMPLETION_DISPUTED: "completion_disputed",
      COMPLETED: "completed",
      CANCELLED_AFTER_DISPUTE: "cancelled_after_dispute",
    },
    raw,
    "bookingStatus",
  );
}

export function mapPaymentStatus(raw: BackendPaymentStatus): MobilePaymentStatus {
  return assertMapped(
    {
      PENDING: "pending",
      PAID: "paid",
      FAILED: "failed",
      REFUNDED: "refunded",
      NOT_REQUIRED: "not_required",
    },
    raw,
    "paymentStatus",
  );
}

export function mapPaginatedServices(raw: BackendPaginatedServices) {
  return {
    ...raw,
    items: raw.items.map(mapServiceListing),
  };
}

export function mapPaginatedServiceBookings(raw: BackendPaginatedServiceBookings) {
  return {
    ...raw,
    items: raw.items.map(mapServiceBooking),
  };
}

export function mapServiceListing(raw: BackendServiceListing): MobileServiceDetail {
  const packages = [...(raw.packages ?? [])]
    .filter((item) => item.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item) => mapServicePackage(item, raw.currency));
  const images = [...(raw.images ?? [])].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const coverImageUrl = images[0]?.url ?? null;

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.title,
    description: raw.description,
    categoryName: raw.category?.name ?? null,
    sellerName: raw.seller?.storeName ?? null,
    pricingModel: mapPricingModel(raw.pricingModel),
    paymentMode: raw.paymentMode ?? null,
    basePricePaise: raw.basePricePaise ?? null,
    inspectionFeePaise: raw.inspectionFeePaise ?? null,
    advanceAmountPaise: raw.advanceAmountPaise ?? null,
    currency: raw.currency,
    coverImageUrl,
    isActive: raw.status === "ACTIVE",
    visitModes: raw.allowedVisitModes.map(mapVisitMode),
    serviceRating: nullableNumber(raw.serviceRating),
    serviceReviewCount: raw.serviceReviewCount ?? 0,
    serviceability: raw.serviceability ?? null,
    packages,
    images,
    highlights: cleanStrings(raw.highlights),
    inclusions: cleanStrings(raw.inclusions),
    exclusions: cleanStrings(raw.exclusions),
    requirements: cleanStrings(raw.requirements),
    reviews: (raw.reviews ?? []).map(mapServiceReview),
  };
}

export function mapServiceListingSummary(raw: BackendServiceListing): MobileServiceListing {
  const detail = mapServiceListing(raw);
  const { packages: _packages, images: _images, highlights: _highlights, inclusions: _inclusions, exclusions: _exclusions, requirements: _requirements, reviews: _reviews, ...summary } = detail;
  return summary;
}

export function mapServicePackage(raw: BackendServicePackage, fallbackCurrency: string): MobileServicePackage {
  return {
    id: raw.id ?? raw.name,
    name: raw.name,
    description: raw.description ?? null,
    pricePaise: typeof raw.pricePaise === "number" ? raw.pricePaise : null,
    currency: raw.currency ?? fallbackCurrency,
    durationMinutes: raw.durationMinutes ?? null,
  };
}

export function mapServiceBooking(raw: BackendServiceBooking): MobileServiceBooking {
  const listing = mapServiceListing(raw.listing);
  const quotes = [...(raw.quotes ?? [])].sort(sortByLatestQuote);
  const disputes = [...(raw.disputes ?? [])].sort(sortByCreatedAt);
  const reviews = [...(raw.reviews ?? [])].sort(sortByCreatedAt);

  return {
    id: raw.id,
    bookingNumber: raw.bookingNumber,
    serviceSlug: raw.listing.slug,
    serviceName: raw.listing.title,
    packageId: raw.package?.id ?? null,
    packageName: raw.package?.name ?? null,
    status: mapBookingStatus(raw.status),
    visitMode: mapVisitMode(raw.visitMode),
    scheduledStartAt: raw.scheduledStartAt ?? null,
    scheduledEndAt: raw.scheduledEndAt ?? null,
    location: mapAddressSnapshot(raw.addressSnapshot),
    customerIssue: raw.customerIssue,
    customerNote: raw.customerNote ?? null,
    providerName: raw.seller?.storeName ?? null,
    pricingModel: listing.pricingModel,
    subtotalPaise: raw.subtotalPaise,
    inspectionFeePaise: raw.inspectionFeePaise,
    advanceAmountPaise: raw.advanceAmountPaise,
    totalPayablePaise: raw.totalPayablePaise,
    paidAmountPaise: raw.paidAmountPaise,
    currency: raw.currency,
    quote: quotes[0] ? mapServiceQuote(quotes[0]) : null,
    payments: (raw.payments ?? []).map(mapServicePayment),
    dispute: disputes[0] ? mapServiceDispute(disputes[0]) : null,
    review: reviews[0] ? mapServiceReview(reviews[0]) : null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function mapServiceQuote(raw: BackendServiceQuote): MobileServiceQuote {
  return {
    id: raw.id,
    status: raw.status,
    amountPaise: raw.totalPaise,
    currency: raw.currency,
    note: raw.note ?? null,
    sentAt: raw.sentAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    acceptedAt: raw.acceptedAt ?? null,
    rejectedAt: raw.rejectedAt ?? null,
  };
}

export function mapServicePayment(raw: BackendServicePayment): MobileServicePayment {
  return {
    id: raw.id,
    amountPaise: raw.amountPaise,
    currency: raw.currency,
    status: mapPaymentStatus(raw.status),
    provider: raw.provider ?? null,
    purpose: raw.purpose ?? null,
    paidAt: raw.paidAt ?? null,
    description: raw.referenceNumber ?? null,
  };
}

export function mapServiceDispute(raw: BackendServiceDispute): MobileServiceDispute {
  return {
    id: raw.id,
    reason: raw.reason,
    evidence: raw.evidence?.length ? raw.evidence : null,
    status: raw.resolvedAt || raw.resolution ? "resolved" : "open",
    raisedAt: raw.createdAt ?? null,
    resolvedAt: raw.resolvedAt ?? null,
  };
}

export function mapServiceReview(raw: BackendServiceReview): MobileServiceReview {
  return {
    id: raw.id,
    rating: raw.rating,
    body: raw.body ?? null,
    submittedAt: raw.createdAt ?? null,
  };
}

function mapAddressSnapshot(raw?: Record<string, unknown> | null): MobileServiceAddressSnapshot | null {
  if (!raw) {
    return null;
  }

  const fullName = stringValue(raw.fullName);
  const phone = stringValue(raw.phone);
  const line1 = stringValue(raw.line1);
  const city = stringValue(raw.city);
  const state = stringValue(raw.state);
  const pincode = stringValue(raw.pincode);
  const country = stringValue(raw.country) || "India";
  const countryCode = stringValue(raw.countryCode) || "IN";
  if (!fullName || !phone || !line1 || !city || !state || !pincode) {
    return null;
  }

  return {
    label: nullableString(raw.label),
    fullName,
    phone,
    line1,
    line2: nullableString(raw.line2),
    area: nullableString(raw.area),
    city,
    state,
    pincode,
    country,
    countryCode,
    stateCode: nullableString(raw.stateCode),
    cityCode: nullableString(raw.cityCode),
    localAreaCode: nullableString(raw.localAreaCode),
    latitude: nullableNumber(raw.latitude),
    longitude: nullableNumber(raw.longitude),
  };
}

function cleanStrings(values?: string[]) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sortByLatestQuote(a: BackendServiceQuote, b: BackendServiceQuote) {
  return timestamp(b.sentAt ?? b.expiresAt) - timestamp(a.sentAt ?? a.expiresAt);
}

function sortByCreatedAt(a: { createdAt?: string }, b: { createdAt?: string }) {
  return timestamp(b.createdAt) - timestamp(a.createdAt);
}

function timestamp(value?: string | null) {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
