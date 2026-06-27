import { deleteJson, getJson, patchJson, postJson, type MobileAuthHeaders } from "../../lib/api";

export type SellerStatus = "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED" | "REJECTED";
export type SellerApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export type SellerProfile = {
  id: string;
  storeName: string;
  slug?: string;
  sellerType?: "MARKETPLACE_SELLER" | "HYPERLOCAL_STORE" | "WHOLESALE_DISTRIBUTOR";
  status: SellerStatus;
  approvalStatus: SellerApprovalStatus;
  subscriptionStatus?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  user?: {
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    status?: string;
  } | null;
  profile?: {
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    businessLegalName?: string | null;
    businessType?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
  } | null;
  payoutProfile?: {
    accountHolderName?: string | null;
    bankName?: string | null;
    maskedAccountNumber?: string | null;
    ifscCode?: string | null;
    maskedUpiId?: string | null;
    isVerified?: boolean;
  } | null;
  addresses?: SellerAddress[];
  subscriptionPlan?: SellerSubscriptionPlan | null;
};

export type SellerAddress = {
  line1?: string;
  line2?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
};

export type SellerDocumentType =
  | "ID_PROOF"
  | "SIGNATURE_PROOF"
  | "GST_CERTIFICATE"
  | "FSSAI_CERTIFICATE"
  | "PAN_CARD"
  | "ADDRESS_PROOF"
  | "BANK_PROOF"
  | "BUSINESS_REGISTRATION"
  | "OTHER";

export type SellerVerificationDocumentPayload = {
  documentType: SellerDocumentType;
  fileUrl: string;
};

export type SellerOnboardingPayload = {
  sellerType: "MARKETPLACE_SELLER" | "HYPERLOCAL_STORE" | "WHOLESALE_DISTRIBUTOR";
  storeName: string;
  contactName: string;
  contactPhone: string;
  businessDescription?: string;
  businessLegalName?: string;
  businessType?: string;
  gstNumber?: string;
  panNumber?: string;
  address: SellerAddress & { line1: string };
  documents?: SellerVerificationDocumentPayload[];
  subscriptionPlanId?: string;
};

export type SellerProfilePayload = {
  storeName?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLegalName?: string;
  businessType?: string;
  gstNumber?: string;
  panNumber?: string;
  payoutProfile?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  address?: SellerAddress;
  documents?: SellerVerificationDocumentPayload[];
};

export type ProductSummary = {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  approvalStatus?: string;
  imageUrl?: string | null;
  images?: Array<{ url: string; altText?: string | null; sortOrder?: number | null; isPrimary?: boolean | null }>;
  description?: string | null;
  attributes?: Record<string, unknown> | null;
  hsnCode?: string | null;
  gstRatePercent?: number | null;
  category?: { id: string; name: string } | null;
  variants?: Array<{
    id: string;
    sku?: string | null;
    variantName?: string | null;
    pricePaise: number;
    mrpPaise?: number | null;
    stockQuantity?: number | null;
    status?: string;
    packageWeightGrams?: number | null;
    packageLengthCm?: number | null;
    packageBreadthCm?: number | null;
    packageHeightCm?: number | null;
  }>;
};

export type SellerProductPayload = {
  categoryId: string;
  name: string;
  description: string;
  attributes?: Record<string, unknown>;
  images?: Array<{ url: string; altText?: string; sortOrder?: number; isPrimary?: boolean }>;
  variants: Array<{
    sku?: string;
    variantName?: string;
    pricePaise: number;
      mrpPaise?: number | null;
    stockQuantity?: number;
    packageWeightGrams?: number;
    packageLengthCm?: number;
    packageBreadthCm?: number;
    packageHeightCm?: number;
    status?: "ACTIVE" | "INACTIVE";
    attributes?: Record<string, unknown>;
  }>;
};

export type SellerProductUpdatePayload = Partial<Omit<SellerProductPayload, "variants">> & {
  variants?: Array<Partial<SellerProductPayload["variants"][number]> & { id?: string }>;
  };

export type ProductTemplateFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "SELECT"
  | "MULTI_SELECT"
  | "BOOLEAN"
  | "DATE";

export type ProductTemplateFieldScope = "PRODUCT" | "VARIANT";

export type ProductTemplateField = {
  id: string;
  productTemplateId: string;
  label: string;
  fieldKey: string;
  fieldType: ProductTemplateFieldType;
  scope: ProductTemplateFieldScope;
  isRequired: boolean;
  options?: string[] | null;
  placeholder?: string | null;
  helpText?: string | null;
  isFilterable?: boolean;
  isSearchable?: boolean;
  sortOrder: number;
};

export type ProductTemplateSummary = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  listingMode?: "CART" | "ENQUIRY_ONLY" | "CART_AND_ENQUIRY";
  sortOrder?: number;
  fields?: ProductTemplateField[];
};

export type CategorySummary = {
  id: string;
  parentId?: string | null;
  productTemplateId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  defaultHsnCode?: string | null;
  defaultGstRatePercent?: number | null;
  defaultTaxDescription?: string | null;
  sortOrder?: number;
  productTemplate?: ProductTemplateSummary | null;
  children?: CategorySummary[];
};

export type HsnMasterEntry = {
  id: string;
  hsnCode: string;
  description: string;
  gstRatePercent: number;
  categoryId?: string | null;
  isActive: boolean;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type SellerOrder = {
  id: string;
  orderNumber: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  currency?: string;
  totalPaise?: number;
  createdAt?: string;
  items?: Array<{ id: string; productNameSnapshot?: string; quantity?: number; lineTotalPaise?: number }>;
  sellerSplits?: Array<{
    id: string;
    sellerStatus?: string;
    settlementStatus?: string;
    sellerSubtotalPaise?: number;
    shipment?: SellerOrderShipment | null;
  }>;
  payments?: Array<{
    id: string;
    provider?: string | null;
    method?: string | null;
    amountPaise?: number | null;
    currency?: string | null;
    status?: string | null;
  }>;
  shipments?: SellerOrderShipment[];
  deliveryDetail?: SellerOrderDeliveryDetail | null;
  statusEvents?: SellerOrderStatusEvent[];
};

export type SellerOrderStatusPayload = {
  sellerStatus: "PENDING" | "ACCEPTED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  note?: string;
};

export type SellerDeliveryPayload = {
  deliveryMode?: "STORE_PICKUP" | "LOCAL_DELIVERY_PARTNER" | "THIRD_PARTY_COURIER" | "MANUAL_TRANSPORT";
  partnerName?: string;
  partnerPhone?: string;
  trackingReference?: string;
  estimatedDeliveryDate?: string;
  deliveryNote?: string;
  receiverName?: string;
  proofNote?: string;
  proofReference?: string;
  codCollected?: boolean;
  codCollectedAmountPaise?: number;
  codCollectionNote?: string;
  status?: "NOT_ASSIGNED" | "PENDING" | "PACKED" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
};

export type SellerOrderStatusEvent = {
  id: string;
  statusType?: string;
  oldStatus?: string | null;
  newStatus?: string;
  note?: string | null;
  createdAt?: string;
};

export type SellerOrderPackage = {
  id: string;
  packageNumber?: string;
  orderShipmentId?: string;
  orderId?: string;
  sellerId?: string;
  sequence?: number;
  deliveryMode?: string;
  status?: string;
  shippingPaise?: number;
  codSurchargePaise?: number;
  declaredValuePaise?: number;
  currency?: string;
  weightGrams?: number | null;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
  itemAllocations?: unknown;
  readyForBookingAt?: string | null;
  bookedAt?: string | null;
  pickupScheduledAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  awbNumber?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  courierTrackingStatus?: string | null;
  courierTrackingStatusLabel?: string | null;
  trackingUrl?: string | null;
  shippingZone?: string | null;
  providerRawStatus?: string | null;
  providerRawStatusCode?: string | null;
  shipmentBookedAt?: string | null;
  canDownloadLabel?: boolean;
  labelDownloadUrl?: string | null;
};

export type SellerOrderShipment = {
  id: string;
  shipmentNumber?: string;
  sellerId?: string;
  subtotalPaise?: number;
  shippingPaise?: number;
  codSurchargePaise?: number;
  deliveryMode?: string;
  courierProviderCode?: string | null;
  routedAt?: string | null;
  routingFailed?: boolean | null;
  routingFailureReason?: string | null;
  routingFailureNote?: string | null;
  routingFirstFailedAt?: string | null;
  routingLastAttemptAt?: string | null;
  routingRetryCount?: number | null;
  routingPermanentFailureAt?: string | null;
  status?: string;
  assignmentStatus?: string | null;
  assignmentExpiresAt?: string | null;
  deliveryPartnerUserId?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  trackingReference?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveryNote?: string | null;
  codCollectionStatus?: string | null;
  codCollectedAmountPaise?: number | null;
  codCollectedAt?: string | null;
  codVerifiedAt?: string | null;
  packages?: SellerOrderPackage[];
};

export type SellerOrderDeliveryDetail = {
  deliveryMode?: string;
  partnerName?: string | null;
  partnerPhone?: string | null;
  deliveryPartner?: {
    id: string;
    fullName?: string | null;
    phone?: string | null;
    vehicleNumber?: string | null;
  } | null;
  assignmentStatus?: string | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  assignmentExpiresAt?: string | null;
  trackingReference?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveryNote?: string | null;
  receiverName?: string | null;
  proofNote?: string | null;
  proofReference?: string | null;
  status?: string;
  codCollectionStatus?: string | null;
  codCollectedAmountPaise?: number | null;
  codCollectedAt?: string | null;
  codCollectionNote?: string | null;
  codVerifiedAt?: string | null;
  codVerificationNote?: string | null;
  events?: Array<{
    id: string;
    oldStatus?: string | null;
    newStatus?: string;
    note?: string | null;
    createdAt?: string;
  }>;
};

export type SellerSalesReport = {
  summary: {
    orderCount: number;
    totalSalesPaise: number;
    commissionPaise: number;
    netSalesPaise: number;
    products: number;
    lowStockCount: number;
    b2bEnquiries: number;
  };
  recentOrders: Array<{ id: string; sellerSubtotalPaise: number; sellerStatus: string; order: SellerOrder }>;
  lowStockProducts: Array<{ id: string; stockQuantity?: number | null; product: ProductSummary }>;
};

export type SellerPayoutAvailability = {
  requestEnabled: boolean;
  sellerReady: boolean;
  hasPayoutMethod: boolean;
  eligibleSplitCount: number;
  netPayablePaise: number;
  currency: string;
  canRequest: boolean;
  blockers: string[];
};

export type SellerPayout = {
  id: string;
  payoutNumber: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED" | "HELD";
  netPayablePaise?: number;
  currency?: string;
  createdAt?: string;
  approvedAt?: string | null;
  paidAt?: string | null;
};

export type SellerLedgerEntry = {
  id: string;
  entryType?: string;
  amountPaise: number;
  currency?: string;
  description?: string | null;
  createdAt?: string;
};

export type SellerStatement = {
  id: string;
  statementNumber?: string;
  status?: string;
  currency?: string;
  netPayablePaise?: number;
  generatedAt?: string;
};

export function getSellerProfile(auth: MobileAuthHeaders) {
  return getJson<SellerProfile>({ path: "/seller/profile", auth });
}

export function onboardSeller(auth: MobileAuthHeaders, payload: SellerOnboardingPayload) {
  return postJson<SellerProfile>({ path: "/sellers/register", auth, body: payload });
}

export function updateSellerProfile(auth: MobileAuthHeaders, payload: SellerProfilePayload) {
  return patchJson<SellerProfile>({ path: "/seller/profile", auth, body: payload });
}

export function registerSellerPushToken(
  auth: MobileAuthHeaders,
  payload: { appVersion?: string; deviceId?: string; platform: "android" | "ios"; token: string },
) {
  return postJson<{ registered: boolean; tokenId: string }>({ path: "/seller/push-tokens", auth, body: payload });
}

export function revokeSellerPushToken(auth: MobileAuthHeaders, token: string) {
  return postJson<{ revoked: boolean }>({ path: "/seller/push-tokens/revoke", auth, body: { token } });
}

export function listSellerProducts(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<ProductSummary>>({ path: "/seller/products", auth, searchParams: query });
}

export function getSellerProduct(auth: MobileAuthHeaders, productId: string) {
  return getJson<ProductSummary>({ path: `/seller/products/${encodeURIComponent(productId)}`, auth });
}

export function listCategories(auth: MobileAuthHeaders) {
  return getJson<CategorySummary[]>({ path: "/categories", auth });
}

export function searchHsnMaster(auth: MobileAuthHeaders, query: { search?: string; categoryId?: string; limit?: number }) {
  return getJson<HsnMasterEntry[]>({ path: "/hsn-master", auth, searchParams: query });
}

export function createSellerProduct(auth: MobileAuthHeaders, payload: SellerProductPayload) {
  return postJson<ProductSummary>({ path: "/seller/products", auth, body: payload });
}

export function updateSellerProduct(auth: MobileAuthHeaders, productId: string, payload: SellerProductUpdatePayload) {
  return patchJson<ProductSummary>({ path: `/seller/products/${encodeURIComponent(productId)}`, auth, body: payload });
}

export function archiveSellerProduct(auth: MobileAuthHeaders, productId: string) {
  return deleteJson<ProductSummary>({ path: `/seller/products/${encodeURIComponent(productId)}`, auth });
}

export function listSellerOrders(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerOrder>>({ path: "/seller/orders", auth, searchParams: query });
}

export function getSellerOrder(auth: MobileAuthHeaders, orderNumber: string) {
  return getJson<SellerOrder>({ path: `/seller/orders/${encodeURIComponent(orderNumber)}`, auth });
}

export function updateSellerOrderStatus(auth: MobileAuthHeaders, orderNumber: string, payload: SellerOrderStatusPayload) {
  return patchJson<SellerOrder>({ path: `/seller/orders/${encodeURIComponent(orderNumber)}/status`, auth, body: payload });
}

export function updateSellerDelivery(auth: MobileAuthHeaders, orderNumber: string, payload: SellerDeliveryPayload) {
  return patchJson<SellerOrder>({ path: `/seller/orders/${encodeURIComponent(orderNumber)}/delivery`, auth, body: payload });
}

export function updateSellerPackage(
  auth: MobileAuthHeaders,
  packageId: string,
  payload: {
    weightGrams?: number;
    lengthCm?: number;
    breadthCm?: number;
    heightCm?: number;
    markReadyForBooking?: boolean;
  },
) {
  return patchJson<SellerOrderPackage>({ path: `/seller/packages/${encodeURIComponent(packageId)}`, auth, body: payload });
}

export function getSellerSalesReport(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<SellerSalesReport>({ path: "/seller/reports/sales", auth, searchParams: query });
}

export function getSellerPayoutAvailability(auth: MobileAuthHeaders) {
  return getJson<SellerPayoutAvailability>({ path: "/seller/finance/payouts/availability", auth });
}

export function requestSellerPayout(auth: MobileAuthHeaders, payload: { note?: string }) {
  return postJson<SellerPayout>({ path: "/seller/finance/payout-requests", auth, body: payload });
}

export function listSellerPayouts(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerPayout>>({ path: "/seller/finance/payouts", auth, searchParams: query });
}

export function listSellerLedger(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerLedgerEntry>>({ path: "/seller/finance/ledger", auth, searchParams: query });
}

export function listSellerStatements(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerStatement>>({ path: "/seller/finance/statements", auth, searchParams: query });
}

// B2B Enquiries
export type B2BEnquiryStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "RESPONDED"
  | "BUYER_CONFIRMED"
  | "ADMIN_APPROVED"
  | "FINALISED"
  | "CLOSED"
  | "CANCELLED";

export type B2BEnquiry = {
  id: string;
  businessBuyerId?: string | null;
  productId?: string | null;
  sellerId?: string | null;
  quantity?: number | null;
  message: string;
  status: B2BEnquiryStatus;
  businessBuyer?: {
    id?: string;
    companyName: string;
    contactName?: string | null;
    contactPhone?: string | null;
    user?: {
      email?: string | null;
    } | null;
    addresses?: Array<SellerAddress>;
  } | null;
  product?: ProductSummary | null;
  seller?: SellerProfile | null;
  createdAt: string;
  updatedAt: string;
  responses?: Array<{
    id: string;
    responseMessage: string;
    quotedPricePaise?: number | null;
    source?: string;
    createdAt?: string;
    responder?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
  b2bOrder?: B2BOrder | null;
};

export type B2BEnquiryResponsePayload = {
  responseMessage: string;
  quotedPricePaise?: number;
};

export function listB2BEnquiries(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<B2BEnquiry>>({ path: "/seller/b2b-enquiries", auth, searchParams: query });
}

export function getB2BEnquiry(auth: MobileAuthHeaders, enquiryId: string) {
  return getJson<B2BEnquiry>({ path: `/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}`, auth });
}

export function respondToB2BEnquiry(auth: MobileAuthHeaders, enquiryId: string, payload: B2BEnquiryResponsePayload) {
  return postJson<B2BEnquiry>({ path: `/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}/responses`, auth, body: payload });
}

// B2B Orders
export type B2BOrderStatus =
  | "PROFORMA_ISSUED"
  | "PO_SUBMITTED"
  | "PO_ACCEPTED"
  | "IN_FULFILMENT"
  | "FULFILLED"
  | "CANCELLED";

export type B2BOrder = {
  id: string;
  orderNumber: string;
  enquiryId: string;
  businessBuyerId: string;
  sellerId?: string | null;
  productId?: string | null;
  selectedResponseId?: string | null;
  status: B2BOrderStatus;
  proformaInvoiceNumber?: string;
  proformaIssuedAt?: string;
  proformaExpiresAt?: string | null;
  purchaseOrderNumber?: string | null;
  purchaseOrderFileKey?: string | null;
  purchaseOrderNote?: string | null;
  purchaseOrderSubmittedAt?: string | null;
  purchaseOrderAcceptedAt?: string | null;
  fulfilledAt?: string | null;
  quantity: number;
  unitPricePaise?: number | null;
  subtotalPaise?: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  businessBuyer?: B2BEnquiry["businessBuyer"] | null;
  product?: ProductSummary | null;
  seller?: SellerProfile | null;
  selectedResponse?: NonNullable<B2BEnquiry["responses"]>[number] | null;
  enquiry?: B2BEnquiry | null;
  events?: Array<{
    id: string;
    status: B2BOrderStatus;
    note?: string | null;
    createdAt?: string;
    actor?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
};

export type B2BOrderDocumentAccess = {
  documentUrl: string;
  expiresAt: string;
};

export function listB2BOrders(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<B2BOrder>>({ path: "/seller/b2b-orders", auth, searchParams: query });
}

export function getB2BOrder(auth: MobileAuthHeaders, orderNumber: string) {
  return getJson<B2BOrder>({ path: `/seller/b2b-orders/${encodeURIComponent(orderNumber)}`, auth });
}

export function getB2BOrderDocumentAccess(auth: MobileAuthHeaders, orderNumber: string) {
  return getJson<B2BOrderDocumentAccess>({ path: `/seller/b2b-orders/${encodeURIComponent(orderNumber)}/purchase-order/document-access`, auth });
}

// Returns
export type SellerReturn = {
  id: string;
  requestNumber: string;
  status: "PENDING_REVIEW" | "APPROVED" | "PICKUP_PENDING" | "RECEIVED" | "QC_PASSED" | "RESOLVED" | "REJECTED" | "CANCELLED";
  orderNumber: string;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  returnReason: string;
  returnImages?: string[] | null;
  conditionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  sellerNotes?: Array<{
    id: string;
    note: string;
    createdAt: string;
  }> | null;
};

export function listSellerReturns(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerReturn>>({ path: "/seller/returns", auth, searchParams: query });
}

export function getSellerReturn(auth: MobileAuthHeaders, requestNumber: string) {
  return getJson<SellerReturn>({ path: `/seller/returns/${encodeURIComponent(requestNumber)}`, auth });
}

export function addSellerReturnNote(auth: MobileAuthHeaders, requestNumber: string, payload: { note: string }) {
  return postJson<SellerReturn>({ path: `/seller/returns/${encodeURIComponent(requestNumber)}/notes`, auth, body: payload });
}

// Reviews
export type SellerReview = {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  product: {
    id: string;
    name: string;
  };
  customer: {
    displayName: string;
  };
  order: {
    orderNumber: string;
  };
  isVerifiedPurchase: boolean;
  createdAt: string;
};

export type SellerReviewSummary = {
  summary: {
    reviewCount: number;
    averageRating: number;
  };
  statusCounts: {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    HIDDEN: number;
  };
};

export function getSellerReviewSummary(auth: MobileAuthHeaders) {
  return getJson<SellerReviewSummary>({ path: "/seller/reviews/summary", auth });
}

export function listSellerReviews(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerReview>>({ path: "/seller/reviews", auth, searchParams: query });
}

// Coupons
export type SellerCouponParticipation = {
  id: string;
  couponId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REMOVED";
  lockedAt?: string | null;
  coupon: {
    id: string;
    code: string;
    title: string;
    status: "ACTIVE" | "ARCHIVED";
    discountType: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
    discountValueBps?: number | null;
    discountAmountPaise?: number | null;
    fundingSource: "PLATFORM_FUNDED" | "SELLER_FUNDED";
    redemptions?: Array<{
      id: string;
      sellerFundedDiscountPaise: number;
    }> | null;
  };
};

export function listSellerCoupons(auth: MobileAuthHeaders, query: Record<string, string | number | undefined> = {}) {
  return getJson<PageResult<SellerCouponParticipation>>({ path: "/seller/coupons", auth, searchParams: query });
}

export function acceptSellerCoupon(auth: MobileAuthHeaders, couponId: string) {
  return postJson<SellerCouponParticipation>({ path: `/seller/coupons/${encodeURIComponent(couponId)}/accept`, auth });
}

export function declineSellerCoupon(auth: MobileAuthHeaders, couponId: string) {
  return postJson<SellerCouponParticipation>({ path: `/seller/coupons/${encodeURIComponent(couponId)}/decline`, auth });
}

// Deals
export type SellerDeal = {
  id: string;
  title: string;
  description?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  discountBps: number;
  startsAt: string;
  endsAt: string;
  joinDeadline: string;
  sellerParticipation?: {
    status: "PENDING" | "ACCEPTED" | "DECLINED";
  } | null;
  sellerEligibleProductCount?: number | null;
  eligibleProducts?: Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
    pricePaise: number;
  }> | null;
  productEnrollments?: Array<{
    id: string;
    productId: string;
    status: "ENROLLED" | "REMOVED";
  }> | null;
};

export function listSellerDeals(auth: MobileAuthHeaders) {
  return getJson<{ items: SellerDeal[] }>({ path: "/seller/deals", auth });
}

export function getSellerDeal(auth: MobileAuthHeaders, dealId: string) {
  return getJson<SellerDeal>({ path: `/seller/deals/${encodeURIComponent(dealId)}`, auth });
}

export function acceptSellerDeal(auth: MobileAuthHeaders, dealId: string) {
  return postJson<SellerDeal>({ path: `/seller/deals/${encodeURIComponent(dealId)}/accept`, auth });
}

export function declineSellerDeal(auth: MobileAuthHeaders, dealId: string) {
  return postJson<SellerDeal>({ path: `/seller/deals/${encodeURIComponent(dealId)}/decline`, auth });
}

export function enrollSellerDealProducts(auth: MobileAuthHeaders, dealId: string, productIds: string[]) {
  return postJson<SellerDeal>({ path: `/seller/deals/${encodeURIComponent(dealId)}/products`, auth, body: { productIds } });
}

export function removeSellerDealProduct(auth: MobileAuthHeaders, dealId: string, productId: string) {
  return deleteJson<SellerDeal>({ path: `/seller/deals/${encodeURIComponent(dealId)}/products/${encodeURIComponent(productId)}`, auth });
}

// Subscription
export type SellerSubscriptionPlan = {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  pricePaise: number;
  currency?: string;
  billingCycle: "MONTHLY" | "YEARLY" | "LIFETIME";
  features?: string[];
  isDefault?: boolean;
  isActive: boolean;
  productLimit?: number | null;
  featuredProductLimit?: number | null;
  b2bEnquiryLimit?: number | null;
  commissionDiscountBps?: number | null;
};

export type SellerSubscriptionStatus = "TRIALING" | "ACTIVE" | "PENDING_PAYMENT" | "EXPIRED" | "CANCELLED";
export type SellerPaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "NOT_REQUIRED";

export type SellerSubscription = {
  id: string;
  plan?: SellerSubscriptionPlan | null;
  status: SellerSubscriptionStatus;
  currentPeriodEnd?: string | null;
  razorpaySubscriptionId?: string | null;
  createdAt: string;
};

export type SellerSubscriptionSummary = {
  sellerId: string;
  subscriptionStatus: SellerSubscriptionStatus;
  subscriptionStartedAt?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  plan?: SellerSubscriptionPlan | null;
  currentSubscription?: SellerSubscription | null;
  payments?: Array<{
    id: string;
    amountPaise: number;
    currency?: string;
    status: SellerPaymentStatus;
    paidAt?: string | null;
    failedAt?: string | null;
    createdAt?: string;
  }>;
  billing?: {
    requiresPayment: boolean;
    canAuthorize: boolean;
    canCancel: boolean;
    gracePeriodEndsAt?: string | null;
    cancelAtPeriodEnd: boolean;
    providerStatus?: string | null;
    lastPaymentStatus?: SellerPaymentStatus | null;
    paymentFailureCount: number;
  };
};

export type RazorpayCheckoutAuth = {
  requiresPayment: boolean;
  subscriptionId: string;
  razorpaySubscriptionId?: string;
  keyId?: string;
  currency?: string;
  amountPaise?: number;
  name?: string;
  description?: string;
  status?: SellerSubscriptionStatus;
  plan?: SellerSubscriptionPlan;
  checkout?: {
    key: string;
    subscription_id: string;
    name?: string;
    description?: string;
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

export function listSellerSubscriptionPlans() {
  return getJson<{ items: SellerSubscriptionPlan[] }>({ path: "/seller/subscription-plans", auth: {} });
}

export function getSellerSubscription(auth: MobileAuthHeaders) {
  return getJson<SellerSubscriptionSummary>({ path: "/seller/subscription", auth });
}

export function authorizeSellerSubscription(auth: MobileAuthHeaders) {
  return postJson<RazorpayCheckoutAuth>({ path: "/seller/subscription/authorize", auth });
}

export function verifySellerSubscription(auth: MobileAuthHeaders, payload: { razorpaySubscriptionId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  return postJson<SellerSubscriptionSummary>({ path: "/seller/subscription/verify", auth, body: payload });
}

export function cancelSellerSubscription(auth: MobileAuthHeaders) {
  return postJson<SellerSubscriptionSummary>({ path: "/seller/subscription/cancel", auth });
}
