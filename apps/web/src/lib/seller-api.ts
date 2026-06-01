import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { AccountOrder } from "./account-api";
import type { SellerDocumentType } from "./seller-document-upload";
import type {
  CategorySummary,
  ProductImage,
  ProductSummary,
  ProductVariant,
  SellerAddress,
  SellerSummary,
} from "./storefront-api";

type SellerProfileDetails = NonNullable<SellerSummary["profile"]> & {
  businessLegalName?: string | null;
  businessType?: SellerBusinessType | null;
  gstNumber?: string | null;
  panNumber?: string | null;
};

export type SellerProfile = Omit<SellerSummary, "profile"> & {
  id: string;
  userId: string;
  profile?: SellerProfileDetails | null;
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
  addresses: SellerAddress[];
  courierProviderSettings?: Array<{
    id: string;
    providerCode: string;
    pickupLocationName?: string | null;
    isActive: boolean;
    settingsSnapshot?: Record<string, unknown> | null;
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

export type SellerVerificationDocument = {
  id?: string;
  documentType: SellerDocumentType;
  fileUrl: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
  updatedAt?: string;
};

export type SellerSubscriptionBillingCycle = "MONTHLY" | "YEARLY" | "LIFETIME";
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
  pricePaise: number;
  currency: string;
  billingCycle: SellerSubscriptionBillingCycle;
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
  };
  courierSettings?: Array<{
    providerCode: string;
    pickupLocationName?: string | undefined;
    isActive?: boolean | undefined;
  }>;
  documents?: Array<{
    documentType: SellerDocumentType;
    fileUrl: string;
  }>;
};

export type SellerOnboardingPayload = {
  sellerType: "VENDOR" | "NEARBY_STORE" | "LOCAL_SHOP";
  storeName: string;
  businessLegalName?: string;
  businessType?: SellerBusinessType;
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
  };
};

export type SellerProductPayload = {
  categoryId: string;
  name: string;
  description: string;
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

export type SellerOrder = AccountOrder & {
  items: Array<
    AccountOrder["items"][number] & {
      sellerId?: string;
      productVariant?: ProductVariant;
      product?: ProductSummary;
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
};

export type B2BEnquiry = {
  id: string;
  businessBuyerId?: string | null;
  productId?: string | null;
  sellerId?: string | null;
  enquiryType?: string;
  quantity?: number | null;
  message: string;
  status:
    | "SUBMITTED"
    | "IN_REVIEW"
    | "RESPONDED"
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
    source?: string;
    createdAt?: string;
    responder?: {
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

export function listSellerSubscriptionPlans() {
  return indihubFetch<SellerSubscriptionPlanList>("/api/seller/subscription-plans");
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
    orderStatus?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
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

export function getSellerB2BEnquiry(auth: IndihubAuthHeaders, enquiryId: string) {
  return indihubFetch<B2BEnquiry>(
    `/api/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}`,
    undefined,
    auth,
  );
}

export function respondSellerB2BEnquiry(
  auth: IndihubAuthHeaders,
  enquiryId: string,
  payload: { responseMessage: string; quotedPricePaise?: number },
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

export function flattenCategories(categories: CategorySummary[]) {
  const flattened: CategorySummary[] = [];

  for (const category of categories) {
    flattened.push(category);
    if (category.children?.length) {
      flattened.push(...category.children);
    }
  }

  return flattened;
}

export function primarySellerImage(images?: ProductImage[]) {
  return images?.find((image) => image.isPrimary)?.url ?? images?.[0]?.url ?? "";
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
