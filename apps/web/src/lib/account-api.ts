import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { LocationSource } from "./maps-api";
import type {
  OrderSummary,
  ProductImage,
  ProductReviewStatus,
  ProductVariant,
  SellerSummary,
} from "./storefront-api";
import type {
  SupportContactChannel,
  SupportRequesterType,
  SupportRequestSource,
  SupportRequestTopic,
} from "@indihub/shared-types";
import type {
  CursorPage,
  ReturnDetail,
  ReturnListQuery,
  ReturnSummary,
} from "./returns-api";

export type CustomerUser = {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  label?: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  countryCode?: string;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationSource?: LocationSource | string | null;
  accuracyMeters?: number | string | null;
  locationConfidenceScore?: number | string | null;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerProfile = {
  id: string;
  userId: string;
  displayName?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  user: CustomerUser;
  addresses: CustomerAddress[];
  wishlist?: {
    items: Array<{ id: string; productId?: string }>;
  } | null;
  _count?: {
    orders?: number;
  };
};

export type CustomerProfilePayload = {
  fullName?: string;
  phone?: string;
  displayName?: string;
};

export type CustomerAddressPayload = {
  label?: string | undefined;
  fullName: string;
  phone: string;
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
  isDefault?: boolean | undefined;
};

export type WishlistProduct = {
  id: string;
  sellerId: string;
  categoryId?: string | null;
  name: string;
  slug: string;
  description: string;
  status: string;
  approvalStatus: string;
  seller: SellerSummary;
  images: ProductImage[];
  variants: ProductVariant[];
};

export type WishlistSummary = {
  id: string;
  customerId: string;
  items: Array<{
    id: string;
    productId: string;
    createdAt?: string;
    product: WishlistProduct;
  }>;
};

export type AccountOrder = OrderSummary & {
  createdAt?: string;
  updatedAt?: string;
  shippingAddressSnapshot?: {
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string | null;
    area?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    countryCode?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    locationSource?: LocationSource | string | null;
    accuracyMeters?: number | string | null;
    locationConfidenceScore?: number | string | null;
  } | null;
  sellerSplits?: Array<{
    id: string;
    sellerId: string;
    sellerSubtotalPaise: number;
    commissionPaise: number;
    couponDiscountPaise?: number;
    couponPlatformFundedDiscountPaise?: number;
    couponSellerFundedDiscountPaise?: number;
    couponAdjustmentPaise?: number;
    sellerStatus: string;
    seller?: SellerSummary;
  }>;
  statusEvents?: Array<{
    id: string;
    statusType: string;
    oldStatus?: string | null;
    newStatus: string;
    note?: string | null;
    createdAt?: string;
  }>;
  payments?: Array<{
    id: string;
    provider: string;
    method?: string | null;
    amountPaise: number;
    currency: string;
    status: string;
    createdAt?: string;
  }>;
  customerDeliveryTimeline?: Array<{
    code: string;
    label: string;
    at?: string | null;
    completed: boolean;
  }>;
};

export type PaginatedAccountOrders = {
  items: AccountOrder[];
  total: number;
  page: number;
  limit: number;
};

export type SupportRequestPayload = {
  name?: string;
  email?: string;
  phone?: string;
  topic: SupportRequestTopic;
  requesterType?: SupportRequesterType;
  preferredContactChannel: SupportContactChannel;
  subject: string;
  orderNumber?: string;
  message: string;
};

export type SupportRequest = SupportRequestPayload & {
  id: string;
  userId?: string | null;
  source?: SupportRequestSource;
  status: string;
  adminNote?: string | null;
  responseMessage?: string | null;
  respondedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerProductReview = {
  id: string;
  productId: string;
  sellerId: string;
  orderId: string;
  orderItemId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  status: ProductReviewStatus;
  adminNote?: string | null;
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
  seller: {
    id: string;
    storeName: string;
    slug: string;
  };
};

export type OrderReviewOptions = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  eligible: boolean;
  reason?: string | null;
  items: Array<{
    orderItemId: string;
    productId: string;
    productNameSnapshot: string;
    product?: {
      id: string;
      name: string;
      slug: string;
      imageUrl?: string | null;
    } | null;
    seller?: {
      id: string;
      storeName: string;
      slug: string;
    } | null;
    eligible: boolean;
    reason?: string | null;
    existingReview?: CustomerProductReview | null;
  }>;
};

export type SubmitProductReviewPayload = {
  orderItemId: string;
  rating: number;
  title?: string;
  comment?: string;
};

export type CustomerCancellationItemInput = {
  orderItemId: string;
  quantity: number;
};

export type CreateCustomerCancellationPayload = {
  items?: CustomerCancellationItemInput[];
  reason?: string;
  note?: string;
};

export type CustomerCancellationResult = {
  data: {
    orderNumber: string;
    cancelledQuantity: number;
    cancelledGrossPaise: number;
    buyerRefundPaise: number;
    couponAdjustmentPaise: number;
    sellerFundedCouponAdjustmentPaise: number;
    platformFundedCouponAdjustmentPaise: number;
    refundRequest?: {
      id: string;
      refundNumber: string;
      status: string;
      amountPaise: number;
      currency: string;
      createdAt?: string;
    } | null;
    orderStatus: string;
  };
};

export type CreateCustomerReturnPayload = {
  resolution: "REFUND" | "REPLACEMENT" | "PARTIAL_REFUND" | "REJECTED";
  reason: string;
  note?: string;
  items: CustomerCancellationItemInput[];
  reverseShipmentMode?: "PLATFORM_PICKUP" | "CUSTOMER_SELF_SHIP";
};

export function getCustomerProfile(auth: IndihubAuthHeaders) {
  return indihubFetch<CustomerProfile>("/api/account/profile", undefined, auth);
}

export function updateCustomerProfile(auth: IndihubAuthHeaders, payload: CustomerProfilePayload) {
  return indihubFetch<CustomerProfile>(
    "/api/account/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function listCustomerAddresses(auth: IndihubAuthHeaders) {
  return indihubFetch<CustomerAddress[]>("/api/account/addresses", undefined, auth);
}

export function createCustomerAddress(auth: IndihubAuthHeaders, payload: CustomerAddressPayload) {
  return indihubFetch<CustomerAddress>(
    "/api/account/addresses",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function updateCustomerAddress(auth: IndihubAuthHeaders, addressId: string, payload: Partial<CustomerAddressPayload>) {
  return indihubFetch<CustomerAddress>(
    `/api/account/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function deleteCustomerAddress(auth: IndihubAuthHeaders, addressId: string) {
  return indihubFetch<{ deleted: boolean }>(
    `/api/account/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "DELETE"
    },
    auth
  );
}

export function getWishlist(auth: IndihubAuthHeaders) {
  return indihubFetch<WishlistSummary>("/api/account/wishlist", undefined, auth);
}

export function addWishlistItem(auth: IndihubAuthHeaders, productId: string) {
  return indihubFetch<WishlistSummary>(
    "/api/account/wishlist/items",
    {
      method: "POST",
      body: JSON.stringify({ productId })
    },
    auth
  );
}

export function removeWishlistItem(auth: IndihubAuthHeaders, productId: string) {
  return indihubFetch<WishlistSummary>(
    `/api/account/wishlist/items/${encodeURIComponent(productId)}`,
    {
      method: "DELETE"
    },
    auth
  );
}

export function listCustomerOrders(auth: IndihubAuthHeaders, query: { search?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return indihubFetch<PaginatedAccountOrders>(`/api/account/orders${suffix}`, undefined, auth);
}

export function getAccountOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<AccountOrder>(`/api/account/orders/${encodeURIComponent(orderNumber)}`, undefined, auth);
}

export function cancelCustomerOrder(auth: IndihubAuthHeaders, orderNumber: string, note?: string) {
  return indihubFetch<AccountOrder>(
    `/api/account/orders/${encodeURIComponent(orderNumber)}/cancel`,
    {
      method: "PATCH",
      body: JSON.stringify(note?.trim() ? { note: note.trim() } : {})
    },
    auth
  );
}

export function createCustomerItemCancellation(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: CreateCustomerCancellationPayload,
) {
  return indihubFetch<CustomerCancellationResult>(
    `/api/account/orders/${encodeURIComponent(orderNumber)}/cancellations`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function createCustomerReturnRequest(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: CreateCustomerReturnPayload,
) {
  return indihubFetch<ReturnDetail>(
    `/api/account/orders/${encodeURIComponent(orderNumber)}/returns`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function listCustomerReturns(auth: IndihubAuthHeaders, query: ReturnListQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return indihubFetch<CursorPage<ReturnSummary>>(`/api/account/returns${suffix}`, undefined, auth);
}

export function getCustomerReturnDetail(auth: IndihubAuthHeaders, requestNumber: string) {
  return indihubFetch<ReturnDetail>(
    `/api/account/returns/${encodeURIComponent(requestNumber)}`,
    undefined,
    auth,
  );
}

export function getOrderReviewOptions(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<OrderReviewOptions>(
    `/api/account/reviews/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function submitProductReview(auth: IndihubAuthHeaders, payload: SubmitProductReviewPayload) {
  return indihubFetch<CustomerProductReview>(
    "/api/account/reviews",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function createAuthenticatedSupportRequest(auth: IndihubAuthHeaders, payload: SupportRequestPayload) {
  return indihubFetch<SupportRequest>(
    "/api/support-requests/authenticated",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    auth
  );
}
