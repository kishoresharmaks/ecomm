import { IndihubApiError, apiBaseUrl, buildAuthHeaders, indihubFetch, type IndihubAuthHeaders } from "./api";
import type { AccountOrder } from "./account-api";
import type { B2BFinalDocumentType } from "./business-buyer-api";
import {
  downloadAuthenticatedCsv,
  downloadAuthenticatedFile,
  type GstCsvExport,
  type GstDocumentFilters,
  type GstDocumentPage,
  type GstFilingPeriod,
  type GstReport,
  type GstReportOverview,
} from "./gst-report-api";
import type { LocationSource } from "./maps-api";
import type { SellerDocumentType } from "./seller-document-upload";
import type {
  CategorySummary,
  ProductImage,
  ProductReviewStatus,
  ProductReviewSummary,
  ProductSummary,
  ProductVariant,
  SellerAddress,
  SellerSummary,
} from "./storefront-api";

type SellerProfileDetails = NonNullable<SellerSummary["profile"]> & {
  businessLegalName?: string | null;
  businessType?: SellerBusinessType | null;
  taxRegistrationStatus?: SellerTaxRegistrationStatus;
  gstNumber?: string | null;
  panNumber?: string | null;
};

type SellerProfileAddress = Omit<SellerAddress, "id"> & {
  id?: string;
};

type SellerPayoutProfileSummary = {
  accountHolderName?: string | null;
  bankName?: string | null;
  maskedAccountNumber?: string | null;
  ifscCode?: string | null;
  maskedUpiId?: string | null;
  isVerified?: boolean;
};

export type SellerServiceArea = {
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
  createdAt?: string;
  updatedAt?: string;
};

export type SellerProfile = Omit<SellerSummary, "profile"> & {
  id: string;
  primaryCapability?: SellerCapability;
  enabledCapabilities?: SellerCapability[];
  serviceRating?: number | string | null;
  serviceReviewCount?: number;
  profile?: SellerProfileDetails | null;
  payoutProfile?: SellerPayoutProfileSummary | null;
  operatingCurrency?: string;
  subscriptionStatus?: SellerSubscriptionStatus;
  subscriptionStartedAt?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionPlan?: SellerSubscriptionPlan | null;
  subscriptions?: SellerSubscription[];
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    status?: string;
  } | null;
  addresses: SellerProfileAddress[];
  serviceAreas?: SellerServiceArea[];
  courierProviderSettings?: Array<{
    providerCode: string;
    pickupLocationName?: string | null;
    isActive: boolean;
  }>;
  documents?: SellerVerificationDocument[];
  createdAt?: string;
  updatedAt?: string;
};

export type SellerBusinessType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "LLP"
  | "PRIVATE_LIMITED"
  | "PUBLIC_LIMITED"
  | "OTHER";

export type SellerTaxRegistrationStatus =
  | "GST_REGISTERED"
  | "NOT_REGISTERED"
  | "COMPOSITION";

export type ProductTaxClassification =
  | "TAXABLE"
  | "NIL_RATED"
  | "EXEMPT"
  | "NON_GST";

export type SellerCapability = "RETAIL" | "SERVICE";

export type SellerVerificationDocument = {
  documentType: SellerDocumentType;
  fileUrl?: string;
  fileName?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
  updatedAt?: string;
};

export type SellerSubscriptionBillingCycle = "MONTHLY" | "YEARLY" | "LIFETIME";
export type SellerSubscriptionPlanAudience = "RETAIL" | "SERVICE" | "ALL";
export type SellerSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PENDING_PAYMENT"
  | "EXPIRED"
  | "CANCELLED";

export type SellerSubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  audience: SellerSubscriptionPlanAudience;
  pricePaise: number;
  currency: string;
  billingCycle: SellerSubscriptionBillingCycle;
  trialDays: number;
  productLimit?: number | null;
  featuredProductLimit?: number | null;
  b2bEnquiryLimit?: number | null;
  commissionDiscountBps?: number | null;
  providerPlanId?: string | null;
  providerPlanVersion?: number | null;
  providerPlanSyncedAt?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    currentSellers?: number;
    subscriptions?: number;
  };
};

export type SellerSubscription = {
  id: string;
  sellerId: string;
  planId: string;
  status: SellerSubscriptionStatus;
  isCurrent: boolean;
  startedAt?: string;
  currentPeriodEnd?: string | null;
  cancelledAt?: string | null;
  provider?: string | null;
  providerSubscriptionId?: string | null;
  providerPlanId?: string | null;
  providerStatus?: string | null;
  authorizedAt?: string | null;
  nextBillingAt?: string | null;
  gracePeriodEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  providerCancelAtCycleEnd?: boolean;
  lastPaymentStatus?: PaymentStatus | null;
  paymentFailureCount?: number;
  note?: string | null;
  plan?: SellerSubscriptionPlan | null;
  payments?: SellerSubscriptionPayment[];
};

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "NOT_REQUIRED";

export type SellerSubscriptionPayment = {
  id: string;
  sellerId: string;
  sellerSubscriptionId: string;
  provider: string;
  providerSubscriptionId?: string | null;
  providerInvoiceId?: string | null;
  providerPaymentId?: string | null;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SellerSubscriptionPlanList = {
  items: SellerSubscriptionPlan[];
  defaultPlanId?: string | null;
};

export type SellerSubscriptionSummary = {
  sellerId: string;
  subscriptionStatus: SellerSubscriptionStatus;
  subscriptionStartedAt?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  plan?: SellerSubscriptionPlan | null;
  currentSubscription?: SellerSubscription | null;
  payments?: SellerSubscriptionPayment[];
  billing?: {
    requiresPayment: boolean;
    canAuthorize: boolean;
    canCancel: boolean;
    gracePeriodEndsAt?: string | null;
    cancelAtPeriodEnd: boolean;
    providerStatus?: string | null;
    lastPaymentStatus?: PaymentStatus | null;
    paymentFailureCount: number;
  };
};

export type SellerSubscriptionAuthorization = {
  requiresPayment: boolean;
  keyId?: string;
  sellerId: string;
  subscriptionId?: string;
  razorpaySubscriptionId?: string;
  amountPaise?: number;
  currency?: string;
  plan?: SellerSubscriptionPlan;
  status?: SellerSubscriptionStatus;
  checkout?: {
    key: string;
    subscription_id: string;
    name: string;
    description: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    theme?: {
      color?: string;
    };
  };
};

export type SellerProfilePayload = {
  storeName?: string | undefined;
  logoUrl?: string | null | undefined;
  bannerUrl?: string | null | undefined;
  description?: string | undefined;
  businessLegalName?: string | undefined;
  businessType?: SellerBusinessType | undefined;
  taxRegistrationStatus?: SellerTaxRegistrationStatus | undefined;
  gstNumber?: string | undefined;
  panNumber?: string | undefined;
  contactName?: string | undefined;
  contactPhone?: string | undefined;
  contactEmail?: string | undefined;
  payoutProfile?: {
    accountHolderName?: string | undefined;
    bankName?: string | undefined;
    accountNumber?: string | undefined;
    ifscCode?: string | undefined;
    upiId?: string | undefined;
  };
  address?: {
    line1?: string | undefined;
    line2?: string | undefined;
    area?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    country?: string | undefined;
    countryCode?: string | undefined;
    stateCode?: string | undefined;
    cityCode?: string | undefined;
    localAreaCode?: string | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    locationSource?: LocationSource | null | undefined;
    accuracyMeters?: number | null | undefined;
    locationConfidenceScore?: number | null | undefined;
  };
  courierSettings?: Array<{
    providerCode: string;
    pickupLocationName?: string | undefined;
    isActive?: boolean | undefined;
  }>;
  serviceAreas?: SellerServiceArea[];
  documents?: Array<{
    documentType: SellerDocumentType;
    fileUrl: string;
  }>;
};

export type SellerCourierPickupSyncResult = {
  providerCode: string;
  pickupLocationName: string;
  providerPickupId?: string | null;
  statusLabel?: string | null;
  seller?: SellerProfile;
};

export type SellerOnboardingPayload = {
  sellerType: "MARKETPLACE_SELLER" | "HYPERLOCAL_STORE" | "WHOLESALE_DISTRIBUTOR" | "SERVICE_PROVIDER";
  primaryCapability?: SellerCapability;
  enabledCapabilities?: SellerCapability[];
  storeName: string;
  businessLegalName?: string;
  businessType?: SellerBusinessType;
  taxRegistrationStatus?: SellerTaxRegistrationStatus;
  gstNumber?: string;
  panNumber?: string;
  contactName: string;
  contactPhone: string;
  businessDescription?: string;
  subscriptionPlanId?: string;
  documents?: Array<{
    documentType: SellerDocumentType;
    fileUrl: string;
  }>;
  address: {
    line1: string;
    line2?: string | undefined;
    area?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    country?: string | undefined;
    countryCode?: string | undefined;
    stateCode?: string | undefined;
    cityCode?: string | undefined;
    localAreaCode?: string | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    locationSource?: LocationSource | null | undefined;
    accuracyMeters?: number | null | undefined;
    locationConfidenceScore?: number | null | undefined;
  };
};

export type SellerProductPayload = {
  categoryId: string;
  name: string;
  description: string;
  taxClassification?: ProductTaxClassification;
  deliveryModes?: Array<"STORE_PICKUP" | "LOCAL_DELIVERY_PARTNER" | "THIRD_PARTY_COURIER" | "MANUAL_TRANSPORT">;
  manualTransport?: {
    freeDistanceKm: number;
    chargePerKmPaise: number;
    note: string;
  };
  attributes?: Record<string, unknown>;
  images?: Array<{
    url: string;
    altText?: string;
    sortOrder?: number;
    isPrimary?: boolean;
  }>;
  variants: Array<{
    id?: string | undefined;
    sku?: string | undefined;
    variantName?: string | undefined;
    pricePaise: number;
    mrpPaise?: number | undefined;
    stockQuantity?: number | undefined;
    packageWeightGrams?: number | undefined;
    packageLengthCm?: number | undefined;
    packageBreadthCm?: number | undefined;
    packageHeightCm?: number | undefined;
    status?: "ACTIVE" | "INACTIVE" | undefined;
    attributes?: Record<string, unknown>;
  }>;
};

export type PaginatedSellerProducts = {
  items: ProductSummary[];
  total: number;
  page: number;
  limit: number;
};

export type SellerOrder = Omit<AccountOrder, "sellerSplits" | "items"> & {
  sellerCurrencySnapshot?: {
    currency: string;
    baseCurrency: string;
    rate: number;
    source: "ORDER_ITEM_PRICE_SNAPSHOT" | "BASE_CURRENCY_FALLBACK";
    sellerSubtotalMinor: number;
    commissionMinor: number;
    gstOnCommissionMinor: number;
    tdsMinor: number;
    tcsMinor: number;
    platformFeeMinor: number;
    couponSellerFundedDiscountMinor: number;
    couponPlatformFundedDiscountMinor: number;
    couponAdjustmentMinor: number;
    refundAdjustmentMinor: number;
    netPayableMinor: number;
    itemAmounts: Record<string, { unitPriceMinor: number; lineTotalMinor: number }>;
  };
  items: Array<
    AccountOrder["items"][number] & {
      sellerId?: string;
      productVariant?: ProductVariant;
      product?: ProductSummary;
      sellerUnitPriceMinor?: number;
      sellerLineTotalMinor?: number;
      sellerCurrency?: string;
    }
  >;
  sellerSplits?: Array<
    Exclude<AccountOrder["sellerSplits"], undefined>[number] & {
      commissionPaise?: number | null;
      gstOnCommissionPaise?: number | null;
      tdsPaise?: number | null;
      tcsPaise?: number | null;
      platformFeePaise?: number | null;
      refundAdjustmentPaise?: number | null;
      netPayablePaise?: number | null;
    }
  >;
};

export type PaginatedSellerOrders = {
  items: SellerOrder[];
  total: number;
  page: number;
  limit: number;
};

export type SellerOrderStatusPayload = {
  sellerStatus: "PENDING" | "ACCEPTED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  note?: string | undefined;
};

export type SellerDeliveryPayload = {
  deliveryMode?:
    | "STORE_PICKUP"
    | "LOCAL_DELIVERY_PARTNER"
    | "THIRD_PARTY_COURIER"
    | "MANUAL_TRANSPORT"
    | undefined;
  partnerName?: string | undefined;
  partnerPhone?: string | undefined;
  trackingReference?: string | undefined;
  estimatedDeliveryDate?: string | undefined;
  deliveryNote?: string | undefined;
  status?:
    | "NOT_ASSIGNED"
    | "PENDING"
    | "PACKED"
    | "DISPATCHED"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "CANCELLED"
    | undefined;
  codCollected?: boolean | undefined;
  codCollectedAmountPaise?: number | undefined;
  codCollectionNote?: string | undefined;
};

export type B2BEnquiry = {
  id: string;
  businessBuyerId?: string | null;
  productId?: string | null;
  sellerId?: string | null;
  enquiryType?: string;
  quantity?: number | null;
  message: string;
  transportMode?: SellerB2BTransportMode;
  transportNote?: string | null;
  status:
    | "SUBMITTED"
    | "IN_REVIEW"
    | "RESPONDED"
    | "NEGOTIATING"
    | "BUYER_CONFIRMED"
    | "ADMIN_APPROVED"
    | "FINALISED"
    | "CLOSED"
    | "CANCELLED";
  createdAt?: string;
  updatedAt?: string;
  businessBuyer?: {
    companyName: string;
    contactName: string;
    contactPhone: string;
    user?: {
      email?: string | null;
    } | null;
  } | null;
  product?: ProductSummary | null;
  seller?: SellerSummary | null;
  responses?: Array<{
    id: string;
    responseMessage: string;
    quotedPricePaise?: number | null;
    transportChargePaise?: number | null;
    transportEta?: string | null;
    transportNote?: string | null;
    source?: string;
    createdAt?: string;
    responder?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
  messages?: {
    items: B2BEnquiryMessage[];
    nextCursor: string | null;
  };
  b2bOrder?: SellerB2BOrder | null;
};

export type SellerCapabilitiesPayload = {
  enabledCapabilities: SellerCapability[];
  primaryCapability?: SellerCapability;
  reason?: string;
};

export type B2BEnquiryMessage = {
  id: string;
  enquiryId: string;
  senderUserId: string;
  message: string;
  createdAt?: string;
  updatedAt?: string;
  sender?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

export type SellerB2BOrderStatus =
  | "PROFORMA_ISSUED"
  | "PO_SUBMITTED"
  | "PO_ACCEPTED"
  | "IN_FULFILMENT"
  | "FULFILLED"
  | "CANCELLED";

export type SellerB2BPaymentStatus =
  | "PENDING"
  | "SUBMITTED_FOR_VERIFICATION"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "REFUNDED"
  | "NOT_REQUIRED";

export type SellerB2BTransportMode = "STORE_PICKUP" | "SELLER_ARRANGED_TRANSPORT";
export type SellerB2BTransportStatus =
  | "NOT_REQUIRED"
  | "REQUESTED"
  | "QUOTED"
  | "READY_FOR_PICKUP"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type SellerServiceBookingStatus =
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

export type SellerServicePaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "NOT_REQUIRED";

export type SellerB2BOrder = {
  id: string;
  orderNumber: string;
  enquiryId: string;
  businessBuyerId: string;
  sellerId?: string | null;
  productId?: string | null;
  selectedResponseId?: string | null;
  status: SellerB2BOrderStatus;
  proformaInvoiceNumber: string;
  proformaIssuedAt?: string;
  proformaExpiresAt?: string | null;
  taxInvoiceNumber?: string | null;
  taxInvoiceIssuedAt?: string | null;
  taxInvoiceFileKey?: string | null;
  finalDocumentType?: B2BFinalDocumentType;
  purchaseOrderNumber?: string | null;
  purchaseOrderFileKey?: string | null;
  purchaseOrderNote?: string | null;
  purchaseOrderSubmittedAt?: string | null;
  purchaseOrderAcceptedAt?: string | null;
  fulfilledAt?: string | null;
  payoutId?: string | null;
  settlementStatus?: "NOT_ELIGIBLE" | "ELIGIBLE" | "DRAFTED" | "APPROVED" | "PAID" | "CANCELLED" | "ADJUSTED";
  settlementEligibleAt?: string | null;
  settledAt?: string | null;
  quantity: number;
  unitPricePaise?: number | null;
  subtotalPaise?: number | null;
  commissionRateBps?: number;
  commissionAmountPaise?: number;
  sellerPayoutAmountPaise?: number;
  currency?: string;
  paymentStatus?: SellerB2BPaymentStatus;
  paymentMethod?: "BANK_TRANSFER" | "MANUAL" | "RAZORPAY" | null;
  buyerPayableAmountPaise?: number | null;
  transportMode?: SellerB2BTransportMode;
  transportStatus?: SellerB2BTransportStatus;
  transportChargePaise?: number | null;
  transportChargeLockedAt?: string | null;
  transportQuotedAt?: string | null;
  transportPartnerName?: string | null;
  transportPartnerPhone?: string | null;
  transportTrackingRef?: string | null;
  transportEta?: string | null;
  transportDispatchedAt?: string | null;
  transportDeliveredAt?: string | null;
  transportPickupAddress?: string | null;
  transportNote?: string | null;
  paidAmountPaise?: number | null;
  paymentDueAt?: string | null;
  paymentVerifiedAt?: string | null;
  fulfilmentUnlockedAt?: string | null;
  businessBuyer?: B2BEnquiry["businessBuyer"] | null;
  product?: ProductSummary | null;
  seller?: SellerSummary | null;
  selectedResponse?: NonNullable<B2BEnquiry["responses"]>[number] | null;
  enquiry?: B2BEnquiry | null;
  events?: Array<{
    id: string;
    status: SellerB2BOrderStatus;
    note?: string | null;
    createdAt?: string;
    actor?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
};

export type PaginatedB2BEnquiries = {
  items: B2BEnquiry[];
  total: number;
  page: number;
  limit: number;
};

export type PaginatedSellerB2BOrders = {
  items: SellerB2BOrder[];
  total: number;
  page: number;
  limit: number;
};

export type SellerSalesReport = {
  currency?: string;
  baseCurrency?: string;
  fxRate?: number;
  seller?: {
    id: string;
    primaryCapability?: SellerCapability;
    enabledCapabilities?: SellerCapability[];
  };
  summary: {
    orderCount: number;
    totalSalesPaise: number;
    commissionPaise: number;
    gstOnCommissionPaise: number;
    tdsPaise: number;
    tcsPaise: number;
    platformFeePaise: number;
    couponSellerFundedDiscountPaise: number;
    couponAdjustmentPaise: number;
    refundAdjustmentPaise: number;
    netSalesPaise: number;
    products: number;
    lowStockCount: number;
    b2bEnquiries: number;
    b2bOrders?: number;
    b2bOrderValuePaise?: number;
    serviceBookings?: number;
    serviceRevenuePaise?: number;
    serviceListings?: number;
  };
  b2b?: {
    enquiryCount: number;
    orderCount: number;
    subtotalPaise: number;
    buyerPayablePaise: number;
    paidAmountPaise: number;
    commissionPaise: number;
    sellerPayoutPaise: number;
    byEnquiryStatus: Array<{ status: B2BEnquiry["status"]; count: number }>;
    byOrderStatus: Array<{
      status: SellerB2BOrderStatus;
      count: number;
      buyerPayablePaise: number;
      sellerPayoutPaise: number;
    }>;
    byPaymentStatus: Array<{
      status: SellerB2BPaymentStatus;
      count: number;
      paidAmountPaise: number;
      buyerPayablePaise: number;
    }>;
    recentOrders: SellerB2BOrder[];
  };
  services?: {
    listingCount: number;
    activeListingCount: number;
    bookingCount: number;
    totalPayablePaise: number;
    paidAmountPaise: number;
    paidPaymentCount: number;
    paidPaymentPaise: number;
    byBookingStatus: Array<{
      status: SellerServiceBookingStatus;
      count: number;
      totalPayablePaise: number;
      paidAmountPaise: number;
    }>;
    byPaymentStatus: Array<{
      status: SellerServicePaymentStatus;
      count: number;
      amountPaise: number;
    }>;
    recentBookings: Array<{
      id: string;
      bookingNumber: string;
      status: SellerServiceBookingStatus;
      visitMode: "CUSTOMER_LOCATION" | "PROVIDER_LOCATION" | "REMOTE";
      paymentMode: "FULL_PAYMENT" | "ADVANCE_PAYMENT" | "INSPECTION_FEE" | "PAY_AT_VISIT";
      scheduledStartAt?: string | null;
      totalPayablePaise: number;
      paidAmountPaise: number;
      currency: string;
      createdAt?: string;
      listing?: {
        id: string;
        title: string;
        slug: string;
      } | null;
      customer?: {
        displayName?: string | null;
        user?: {
          email?: string | null;
          fullName?: string | null;
          phone?: string | null;
        } | null;
      } | null;
    }>;
  };
  recentOrders: Array<{
    id: string;
    sellerId: string;
    sellerSubtotalPaise: number;
    commissionPaise: number;
    sellerStatus: string;
    createdAt?: string;
    order: SellerOrder;
  }>;
  lowStockProducts: Array<ProductVariant & { product: ProductSummary }>;
};

export type SellerReviewRecord = {
  id: string;
  productId: string;
  orderItemId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  status: ProductReviewStatus;
  isVerifiedPurchase: boolean;
  submittedAt?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
  };
  customer: {
    displayName: string;
  };
  order: {
    orderNumber: string;
    createdAt?: string;
  };
  orderItem: {
    id: string;
    productNameSnapshot: string;
  };
};

export type PaginatedSellerReviews = {
  items: SellerReviewRecord[];
  total: number;
  page: number;
  limit: number;
};

export type SellerReviewSummary = {
  seller: {
    id: string;
    storeName: string;
    slug: string;
  };
  summary: ProductReviewSummary;
  statusCounts: Record<ProductReviewStatus, number>;
};

export function getSellerProfile(auth: IndihubAuthHeaders) {
  return indihubFetch<SellerProfile>("/api/seller/profile", undefined, auth);
}

export function updateSellerProfile(auth: IndihubAuthHeaders, payload: SellerProfilePayload) {
  return indihubFetch<SellerProfile>(
    "/api/seller/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function syncSellerCourierPickup(auth: IndihubAuthHeaders, providerCode: string) {
  return indihubFetch<SellerCourierPickupSyncResult>(
    `/api/seller/profile/courier-pickups/${encodeURIComponent(providerCode)}/sync`,
    {
      method: "POST",
    },
    auth,
  );
}

export function onboardSeller(auth: IndihubAuthHeaders, payload: SellerOnboardingPayload) {
  return indihubFetch<SellerProfile>(
    "/api/sellers/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateSellerCapabilities(auth: IndihubAuthHeaders, payload: SellerCapabilitiesPayload) {
  return indihubFetch<SellerProfile>(
    "/api/sellers/capabilities",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function listSellerSubscriptionPlans(query: { audience?: SellerSubscriptionPlanAudience } = {}) {
  return indihubFetch<SellerSubscriptionPlanList>(`/api/seller/subscription-plans${queryString(query)}`);
}

export function getSellerSubscription(auth: IndihubAuthHeaders) {
  return indihubFetch<SellerSubscriptionSummary>("/api/seller/subscription", undefined, auth);
}

export function authorizeSellerSubscription(auth: IndihubAuthHeaders) {
  return indihubFetch<SellerSubscriptionAuthorization>(
    "/api/seller/subscription/authorize",
    {
      method: "POST",
    },
    auth,
  );
}

export function verifySellerSubscription(
  auth: IndihubAuthHeaders,
  payload: {
    razorpaySubscriptionId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
) {
  return indihubFetch<SellerSubscriptionSummary>(
    "/api/seller/subscription/verify",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function cancelSellerSubscription(auth: IndihubAuthHeaders) {
  return indihubFetch<SellerSubscriptionSummary>(
    "/api/seller/subscription/cancel",
    {
      method: "POST",
    },
    auth,
  );
}

export function listSellerProducts(
  auth: IndihubAuthHeaders,
  query: {
    search?: string;
    status?: string;
    approvalStatus?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  return indihubFetch<PaginatedSellerProducts>(
    `/api/seller/products${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerProduct(auth: IndihubAuthHeaders, productId: string) {
  return indihubFetch<ProductSummary>(
    `/api/seller/products/${encodeURIComponent(productId)}`,
    undefined,
    auth,
  );
}

export function createSellerProduct(auth: IndihubAuthHeaders, payload: SellerProductPayload) {
  return indihubFetch<ProductSummary>(
    "/api/seller/products",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateSellerProduct(
  auth: IndihubAuthHeaders,
  productId: string,
  payload: SellerProductPayload,
) {
  return indihubFetch<ProductSummary>(
    `/api/seller/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function archiveSellerProduct(auth: IndihubAuthHeaders, productId: string) {
  return indihubFetch<ProductSummary>(
    `/api/seller/products/${encodeURIComponent(productId)}`,
    {
      method: "DELETE",
    },
    auth,
  );
}

export function listSellerOrders(
  auth: IndihubAuthHeaders,
  query: {
    search?: string;
    orderStatus?: string[];
    paymentStatus?: string[];
    deliveryStatus?: string[];
    paymentMethod?: string[];
    page?: number;
    limit?: number;
  } = {},
) {
  return indihubFetch<PaginatedSellerOrders>(
    `/api/seller/orders${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<SellerOrder>(
    `/api/seller/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function updateSellerOrderStatus(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: SellerOrderStatusPayload,
) {
  return indihubFetch<SellerOrder>(
    `/api/seller/orders/${encodeURIComponent(orderNumber)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateSellerDelivery(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: SellerDeliveryPayload,
) {
  return indihubFetch<SellerOrder>(
    `/api/seller/orders/${encodeURIComponent(orderNumber)}/delivery`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export async function fetchSellerPackageLabel(
  auth: IndihubAuthHeaders,
  labelDownloadUrl: string,
) {
  const response = await fetch(`${apiBaseUrl}${labelDownloadUrl}`, {
    headers: await buildAuthHeaders(auth),
  });
  if (!response.ok) {
    throw new IndihubApiError("Courier label could not be downloaded.", response.status);
  }
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);

  return {
    blob: await response.blob(),
    fileName: fileNameMatch?.[1] ?? "courier-label.pdf",
  };
}

export type SellerPackageUpdatePayload = {
  weightGrams?: number | undefined;
  lengthCm?: number | undefined;
  breadthCm?: number | undefined;
  heightCm?: number | undefined;
  markReadyForBooking?: boolean | undefined;
};

export function updateSellerPackage(
  auth: IndihubAuthHeaders,
  packageId: string,
  payload: SellerPackageUpdatePayload,
) {
  return indihubFetch(
    `/api/seller/packages/${encodeURIComponent(packageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function listSellerB2BEnquiries(
  auth: IndihubAuthHeaders,
  query: { search?: string; status?: string; page?: number; limit?: number } = {},
) {
  return indihubFetch<PaginatedB2BEnquiries>(
    `/api/seller/b2b-enquiries${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerB2BEnquiry(
  auth: IndihubAuthHeaders,
  enquiryId: string,
  query: { messageCursor?: string; messageLimit?: number } = {},
) {
  return indihubFetch<B2BEnquiry>(
    `/api/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}${queryString(query)}`,
    undefined,
    auth,
  );
}

export function respondSellerB2BEnquiry(
  auth: IndihubAuthHeaders,
  enquiryId: string,
  payload: {
    responseMessage: string;
    quotedPricePaise?: number;
    transportChargePaise?: number;
    transportEta?: string;
    transportNote?: string;
  },
) {
  return indihubFetch<B2BEnquiry>(
    `/api/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}/responses`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function sendSellerB2BMessage(auth: IndihubAuthHeaders, enquiryId: string, message: string) {
  return indihubFetch<B2BEnquiryMessage>(
    `/api/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
    auth,
  );
}

export function listSellerB2BOrders(
  auth: IndihubAuthHeaders,
  query: { search?: string; status?: string; page?: number; limit?: number } = {},
) {
  return indihubFetch<PaginatedSellerB2BOrders>(
    `/api/seller/b2b-orders${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerB2BOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<SellerB2BOrder>(
    `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export type SellerB2BTransportPayload = {
  transportMode?: SellerB2BTransportMode;
  transportStatus?: SellerB2BTransportStatus;
  transportChargePaise?: number;
  transportPartnerName?: string;
  transportPartnerPhone?: string;
  transportTrackingRef?: string;
  transportEta?: string;
  transportPickupAddress?: string;
  transportNote?: string;
};

export function updateSellerB2BTransport(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: SellerB2BTransportPayload,
) {
  return indihubFetch<SellerB2BOrder>(
    `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/transport`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function getSellerSalesReport(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerSalesReport>(
    `/api/seller/reports/sales${queryString(query)}`,
    undefined,
    auth,
  );
}

// ─── Reports Hub Overview ────────────────────────────────────────────────────
export type SellerReportsOverview = {
  currency?: string;
  baseCurrency?: string;
  fxRate?: number;
  totalSalesPaise: number;
  netSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  orderCount: number;
  products: number;
  lowStockCount: number;
  paidPayoutsPaise: number;
  paidPayoutsCount: number;
  b2bOrderCount: number;
  returnCount: number;
};

export function getSellerReportsOverview(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerReportsOverview>(
    `/api/seller/reports/overview${queryString(query)}`,
    undefined,
    auth,
  );
}

// ─── Inventory Report ────────────────────────────────────────────────────────
export type SellerInventoryVariant = {
  id: string;
  sku: string | null;
  variantName: string | null;
  stockQuantity: number;
  product: { id: string; name: string; status: string };
};
export type SellerTopSoldItem = {
  productId: string;
  productName: string;
  quantitySold: number;
  revenuePaise: number;
};
export type SellerInventoryReport = {
  summary: { productCount: number; activeProductCount: number; variantCount: number; lowStockCount: number };
  lowStockVariants: SellerInventoryVariant[];
  variants: SellerInventoryVariant[];
  topSoldItems: SellerTopSoldItem[];
  splits: { id: string; sellerSubtotalPaise: number; createdAt: string }[];
};

export function getSellerInventoryReport(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerInventoryReport>(
    `/api/seller/reports/inventory${queryString(query)}`,
    undefined,
    auth,
  );
}

// ─── Finance Report ──────────────────────────────────────────────────────────
export type SellerPayoutRecord = {
  id: string;
  payoutNumber: string;
  periodFrom: string;
  periodTo: string;
  status: string;
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  currency: string;
  paymentMode: string | null;
  transactionReference: string | null;
  paidAt: string | null;
  createdAt: string;
};
export type SellerLedgerRecord = {
  id: string;
  entryType: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  balanceAfterPaise: number;
  currency: string;
  createdAt: string;
};
export type SellerFinanceReport = {
  currency?: string;
  baseCurrency?: string;
  fxRate?: number;
  summary: {
    grossSalesPaise: number; commissionPaise: number; netPayablePaise: number; refundAdjustmentPaise: number; platformFeePaise: number; orderCount: number;
    pendingPayoutsPaise: number; pendingPayoutsCount: number; paidPayoutsPaise: number; paidPayoutsCount: number; eligiblePaise: number; eligibleCount: number;
  };
  recentPayouts: SellerPayoutRecord[];
  ledgerEntries: SellerLedgerRecord[];
};

export function getSellerFinanceReport(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerFinanceReport>(
    `/api/seller/reports/finance${queryString(query)}`,
    undefined,
    auth,
  );
}

// ─── Tax Report ──────────────────────────────────────────────────────────────
export type SellerTaxSplit = {
  id: string;
  sellerSubtotalPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  netPayablePaise: number;
  createdAt: string;
  order: { orderNumber: string; createdAt: string; currency: string };
};
export type SellerTaxReport = {
  currency?: string;
  baseCurrency?: string;
  fxRate?: number;
  summary: {
    orderCount: number; grossSalesPaise: number; commissionPaise: number; gstOnCommissionPaise: number; tdsPaise: number; tcsPaise: number;
    platformFeePaise: number; couponDiscountPaise: number; netPayablePaise: number; totalDeductionsPaise: number;
  };
  splits: SellerTaxSplit[];
};

export type SellerGstReport = GstReport;
export type SellerGstOverview = GstReportOverview;

export function getSellerTaxReport(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerTaxReport>(
    `/api/seller/reports/tax${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerGstReport(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerGstReport>(
    `/api/seller/reports/gst${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerGstOverview(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerGstOverview>(
    `/api/seller/reports/gst/overview${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getSellerGstDocuments(
  auth: IndihubAuthHeaders,
  filters: Omit<GstDocumentFilters, "sellerId">,
) {
  return indihubFetch<GstDocumentPage>(
    `/api/seller/reports/gst-documents${queryString(filters)}`,
    undefined,
    auth,
  );
}

export function downloadSellerGstDocumentPdf(
  auth: IndihubAuthHeaders,
  documentId: string,
) {
  return downloadAuthenticatedFile(
    auth,
    `/api/seller/reports/gst-documents/${encodeURIComponent(documentId)}/download`,
    "gst-document.pdf",
    "The tax document could not be downloaded.",
  );
}

export function getSellerGstReportCsvUrl(
  type: GstCsvExport,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return `/api/seller/reports/export/${type}${queryString(query)}`;
}

export function downloadSellerGstReportCsv(
  auth: IndihubAuthHeaders,
  type: GstCsvExport,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return downloadAuthenticatedCsv(
    auth,
    getSellerGstReportCsvUrl(type, query),
    `${type}.csv`,
  );
}

export function lockSellerGstFilingPeriod(
  auth: IndihubAuthHeaders,
  input: { returnPeriod: string; notes?: string },
) {
  return indihubFetch<GstFilingPeriod>(
    "/api/seller/reports/filing-periods/lock",
    { method: "POST", body: JSON.stringify(input) },
    auth,
  );
}

export function markSellerGstFilingPeriodFiled(
  auth: IndihubAuthHeaders,
  input: { returnPeriod: string; filingReference: string },
) {
  return indihubFetch<GstFilingPeriod>(
    "/api/seller/reports/filing-periods/file",
    { method: "POST", body: JSON.stringify(input) },
    auth,
  );
}

export function reopenSellerGstFilingPeriod(
  auth: IndihubAuthHeaders,
  input: { returnPeriod: string },
) {
  return indihubFetch<GstFilingPeriod>(
    "/api/seller/reports/filing-periods/reopen",
    { method: "POST", body: JSON.stringify(input) },
    auth,
  );
}

export function createSellerGstDebitNote(
  auth: IndihubAuthHeaders,
  input: {
    originalDocumentId: string;
    reason: string;
    lines: Array<{
      description: string;
      hsnSacCode?: string;
      quantity: number;
      lineValuePaise: number;
      gstRatePercent: number;
    }>;
  },
) {
  return indihubFetch<GstReport["documents"][number]>(
    "/api/seller/reports/debit-notes",
    { method: "POST", body: JSON.stringify(input) },
    auth,
  );
}

export function recordSellerTaxDocumentCompliance(
  auth: IndihubAuthHeaders,
  documentId: string,
  input: {
    eInvoiceStatus?: string;
    irn?: string;
    acknowledgementNumber?: string;
    acknowledgementDate?: string;
    eInvoiceProvider?: string;
    eInvoiceProviderRef?: string;
    eInvoiceError?: string;
    eWayBillStatus?: string;
    eWayBillNumber?: string;
    eWayBillGeneratedAt?: string;
    eWayBillValidUntil?: string;
    eWayBillProvider?: string;
    eWayBillProviderRef?: string;
    eWayBillError?: string;
  },
) {
  return indihubFetch(
    `/api/seller/reports/gst-documents/${documentId}/compliance`,
    { method: "PATCH", body: JSON.stringify(input) },
    auth,
  );
}

// ─── Returns Report ──────────────────────────────────────────────────────────
export type SellerReturnRecord = {
  id: string;
  requestNumber: string;
  status: string;
  resolution: string;
  reason: string;
  requestedAmountPaise: number;
  approvedAmountPaise: number;
  requestedAt: string;
  order: { orderNumber: string };
};
export type SellerReturnsReport = {
  summary: { totalCount: number; approvedCount: number; pendingCount: number; requestedAmountPaise: number; approvedAmountPaise: number; itemCount: number };
  byStatus: { status: string; count: number; requestedAmountPaise: number; approvedAmountPaise: number }[];
  recentReturns: SellerReturnRecord[];
};

export function getSellerReturnsReport(
  auth: IndihubAuthHeaders,
  query: { dateFrom?: string; dateTo?: string } = {},
) {
  return indihubFetch<SellerReturnsReport>(
    `/api/seller/reports/returns${queryString(query)}`,
    undefined,
    auth,
  );
}

// ─── CSV Export helper ────────────────────────────────────────────────────────
export function getSellerReviewSummary(auth: IndihubAuthHeaders) {
  return indihubFetch<SellerReviewSummary>("/api/seller/reviews/summary", undefined, auth);
}

export function listSellerReviews(
  auth: IndihubAuthHeaders,
  query: {
    search?: string;
    status?: ProductReviewStatus;
    rating?: number;
    productId?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  return indihubFetch<PaginatedSellerReviews>(
    `/api/seller/reviews${queryString(query)}`,
    undefined,
    auth,
  );
}

export function flattenCategories(categories: CategorySummary[]) {
  return sellerCategoryOptions(categories).map((option) => option.category);
}

export type SellerCategoryOption = {
  category: CategorySummary;
  label: string;
  depth: number;
  hasChildren: boolean;
};

export function sellerCategoryOptions(categories: CategorySummary[]) {
  const options: SellerCategoryOption[] = [];
  const seenCategoryIds = new Set<string>();

  function visit(category: CategorySummary, ancestors: string[] = []) {
    if (seenCategoryIds.has(category.id)) {
      return;
    }

    seenCategoryIds.add(category.id);
    const path = [...ancestors, category.name];
    options.push({
      category,
      label: path.join(" / "),
      depth: ancestors.length,
      hasChildren: Boolean(category.children?.length),
    });

    if (category.children?.length) {
      for (const child of category.children) {
        visit(child, path);
      }
    }
  }

  for (const category of categories) {
    visit(category);
  }

  return options;
}

export function sellerCategoryLabel(categories: CategorySummary[], categoryId: string) {
  return sellerCategoryOptions(categories).find((option) => option.category.id === categoryId)?.label ?? "";
}

export function primarySellerImage(images?: ProductImage[]) {
  return images?.find((image) => image.isPrimary)?.url ?? images?.[0]?.url ?? "";
}

function queryString(query: Record<string, string | number | undefined | string[]>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== "") {
            params.append(key, String(item));
          }
        }
      } else if (key === "dateFrom" && typeof value === "string" && value.length === 10) {
        const [y, m, d] = value.split("-");
        const date = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
        params.append(key, date.toISOString());
      } else if (key === "dateTo" && typeof value === "string" && value.length === 10) {
        const [y, m, d] = value.split("-");
        const date = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
        params.append(key, date.toISOString());
      } else {
        params.append(key, String(value));
      }
    }
  }

  const str = params.toString();
  return str ? `?${str}` : "";
}
