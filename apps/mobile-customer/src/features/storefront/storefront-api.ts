import { deleteNoContent, getJson, patchJson, postJson, type MobileAuthHeaders } from "../../lib/api";
import type { LocationArea, ProductSummary, SelectedLocation, StorefrontSearchResponse, StorefrontSuggestionsResponse } from "../../types/storefront";
import type { MobileCategory, MobileProduct, MobileStore } from "../../types/mobile-home";

export type MobileCartSummary = {
  id: string;
  status: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPricePaise?: number;
      productVariant?: {
        id: string;
        name?: string | null;
        sku?: string | null;
        pricePaise?: number;
      mrpPaise?: number | null;
      status?: string | null;
        stockQuantity?: number | null;
        product?: {
          categoryId?: string | null;
          id: string;
          name: string;
          slug: string;
          sellerId?: string | null;
          category?: {
            id?: string | null;
            name?: string | null;
            slug?: string | null;
          } | null;
          images?: Array<{ url?: string | null }>;
          seller?: {
            id?: string | null;
            storeName?: string | null;
            slug?: string | null;
          } | null;
        };
      };
  }>;
};

export type MobileCustomerAddress = {
  id: string;
  customerId?: string;
  label?: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string | null;
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  locationSource?: string | null;
  accuracyMeters?: string | number | null;
  locationConfidenceScore?: string | number | null;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MobileCustomerAddressPayload = {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  countryCode?: string;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string | null;
  accuracyMeters?: number | null;
  locationConfidenceScore?: number | null;
  isDefault?: boolean;
};

export type MobileCustomerProfile = {
  id: string;
  displayName?: string | null;
  status?: string;
  user?: {
    id: string;
    email: string;
    phone?: string | null;
    fullName?: string | null;
    status?: string;
  };
  addresses?: MobileCustomerAddress[];
  wishlist?: {
    items?: Array<{ id: string }>;
  } | null;
  _count?: {
    orders?: number;
  };
};

export type MobileCustomerProfilePayload = {
  fullName?: string | null;
  phone?: string | null;
  displayName?: string | null;
};

export type MobileBrowsingLocation = SelectedLocation;

export type MobileBrowsingLocationResponse = {
  location: MobileBrowsingLocation | null;
};

export type MobileLocationCountry = {
  id: string;
  code: string;
  name: string;
  currency: string;
  locale: string;
  phoneCode: string;
  postalCodeLabel: string;
  postalCodePattern?: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type MobileLocationSubdivision = {
  id: string;
  countryId: string;
  code: string;
  name: string;
  type: string;
  country?: MobileLocationCountry;
};

export type MobileLocationCity = {
  id: string;
  subdivisionId: string;
  code: string;
  name: string;
  subdivision?: MobileLocationSubdivision & { country?: MobileLocationCountry };
};

export type MobileMarketCurrency = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  baseCurrency: string;
  rate: number;
  provider: string;
  fetchedAt: string;
  expiresAt?: string | null;
  isStale: boolean;
};

export type MobilePaymentMethod = "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
export type MobileDeliveryPreference = "STORE_PICKUP" | "DELIVER_TO_ADDRESS";

export type MobileCheckoutSummary = {
  itemCount: number;
  subtotalPaise: number;
  payableSubtotalPaise?: number;
  shippingPaise: number;
  platformFeePaise: number;
  couponDiscountPaise?: number;
  totalPaise: number;
  currency: string;
  buyerCountryCode: string;
  buyerCurrency: string;
  buyerSubtotalMinor?: number;
  buyerPayableSubtotalMinor?: number;
  buyerShippingMinor?: number;
  buyerPlatformFeeMinor?: number;
  buyerCouponDiscountMinor?: number;
  buyerTotalMinor: number;
};

export type MobileCheckoutPaymentMethodsResponse = {
  methods: Array<{
    method: MobilePaymentMethod;
    label: string;
    enabled: boolean;
    note: string;
    instructions?: string;
    maxOrderPaise?: number;
    bankTransferDetails?: {
      configured?: boolean;
      accountHolderName?: string;
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      branch?: string;
      upiId?: string;
      instructions?: string;
      referenceRequired?: boolean;
    };
  }>;
};

export type MobileRazorpayOrderResponse = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  orderNumber: string;
};

export type MobileRazorpayVerificationPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type MobileRazorpayVerificationResponse = {
  received: boolean;
  paymentId: string;
  status: string;
};

export type MobileOrderSummary = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalPaise: number;
  currency: string;
  buyerCountryCode?: string | null;
  buyerCurrency?: string | null;
  buyerSubtotalMinor?: number | null;
  buyerPayableSubtotalMinor?: number | null;
  buyerShippingMinor?: number | null;
  buyerPlatformFeeMinor?: number | null;
  buyerCouponDiscountMinor?: number | null;
  buyerTotalMinor?: number | null;
  fxRateFetchedAt?: string | null;
  createdAt?: string;
  items?: Array<{
    id: string;
    productNameSnapshot: string;
    quantity: number;
    lineTotalPaise: number;
    product?: {
      categoryId?: string | null;
      category?: {
        id?: string | null;
        name?: string | null;
        slug?: string | null;
      } | null;
      id?: string | null;
      images?: Array<{ url?: string | null }> | null;
      imageUrl?: string | null;
      slug?: string | null;
    } | null;
    sellerId?: string | null;
    seller?: {
      id?: string | null;
      storeName?: string | null;
      slug?: string | null;
    } | null;
  }>;
};

export type MobileOrderShipment = {
  id: string;
  shipmentNumber?: string | null;
  sellerId?: string | null;
  status: string;
  deliveryMode?: string | null;
  trackingReference?: string | null;
  estimatedDeliveryDate?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  deliveryNote?: string | null;
  seller?: {
    storeName?: string | null;
    slug?: string | null;
  } | null;
};

export type MobileOrderDetail = Omit<MobileOrderSummary, "items"> & {
  subtotalPaise?: number;
  shippingPaise?: number;
  platformFeePaise?: number;
  couponDiscountPaise?: number | null;
  shippingAddressSnapshot?: unknown;
  shippingLocation?: {
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    countryCode?: string | null;
  } | null;
  items: Array<{
    id: string;
    activeQuantity?: number | null;
    cancelledQuantity?: number | null;
    productNameSnapshot: string;
    variantSnapshot?: unknown;
    quantity: number;
    returnedQuantity?: number | null;
    returnPolicySnapshot?: unknown;
    lifecycleStatus?: string | null;
    unitPricePaise: number;
    lineTotalPaise: number;
    currency?: string;
    product?: {
      name?: string | null;
      slug?: string | null;
      imageUrl?: string | null;
    } | null;
    seller?: {
      storeName?: string | null;
      slug?: string | null;
    } | null;
  }>;
  deliveryDetail?: {
    deliveryMode?: string | null;
    partnerName?: string | null;
    partnerPhone?: string | null;
    trackingReference?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    status?: string | null;
    events?: Array<{
      id: string;
      oldStatus?: string | null;
      newStatus?: string | null;
      note?: string | null;
      createdAt?: string;
    }>;
  } | null;
  shipments?: MobileOrderShipment[];
  sellerSplits?: Array<{
    id: string;
    sellerStatus: string;
    shipment?: MobileOrderShipment | null;
    seller?: {
      storeName?: string | null;
      slug?: string | null;
    } | null;
  }>;
  payments?: Array<{
    id: string;
    method: string;
    status: string;
    provider?: string | null;
    amountPaise?: number;
    reference?: string | null;
    createdAt?: string;
  }>;
  statusEvents?: Array<{
    id: string;
    statusType?: string | null;
    oldStatus?: string | null;
    newStatus?: string | null;
    note?: string | null;
    createdAt?: string;
  }>;
  customerDeliveryTimeline?: Array<{
    label?: string;
    status?: string;
    note?: string | null;
    createdAt?: string | null;
  }>;
};

export type MobileOrderListResponse = {
  items: MobileOrderSummary[];
  total?: number;
  nextCursor?: string | null;
};

export type MobileReturnRequestStatus =
  | "PENDING_REVIEW"
  | "AUTO_APPROVED"
  | "APPROVED"
  | "PICKUP_PENDING"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "QC_PASSED"
  | "QC_FAILED"
  | "RESOLVED"
  | "REJECTED"
  | "CANCELLED"
  | string;

export type MobileReturnItemStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PICKUP_PENDING"
  | "PICKED_UP"
  | "RECEIVED"
  | "QC_PASSED"
  | "QC_FAILED"
  | "REFUND_REQUESTED"
  | "REPLACEMENT_CREATED"
  | "CLOSED"
  | string;

export type MobileReturnResolution = "REFUND" | "REPLACEMENT" | "PARTIAL_REFUND" | "REJECTED";
export type MobileCreateReturnResolution = "REFUND" | "REPLACEMENT";
export type MobileReverseShipmentMode = "PLATFORM_PICKUP" | "CUSTOMER_SELF_SHIP";

export type MobileReturnAddress = {
  area?: string | null;
  city?: string | null;
  country?: string | null;
  fullName?: string | null;
  line1?: string | null;
  line2?: string | null;
  phone?: string | null;
  pincode?: string | null;
  state?: string | null;
};

export type MobileReturnRequestItem = {
  id: string;
  orderItemId?: string;
  productName: string;
  quantity: number;
  status: MobileReturnItemStatus;
  sellerId?: string | null;
  sellerName?: string | null;
  seller?: {
    storeName?: string | null;
    slug?: string | null;
  } | null;
  product?: Partial<MobileProduct> & {
    imageUrl?: string | null;
    images?: Array<{ url?: string | null; altText?: string | null }> | null;
  } | null;
  variantSnapshot?: unknown;
  resolution?: MobileReturnResolution | null;
  reason?: string | null;
  requestedRefundPaise?: number | null;
  approvedRefundPaise?: number | null;
  qcNote?: string | null;
  sellerNote?: string | null;
};

export type MobileReverseShipment = {
  id: string;
  sellerId?: string | null;
  mode: MobileReverseShipmentMode;
  status: string;
  assignmentStatus?: string | null;
  awbNumber?: string | null;
  courierName?: string | null;
  trackingReference?: string | null;
  trackingUrl?: string | null;
  estimatedPickupDate?: string | null;
  pickedUpAt?: string | null;
  receivedAt?: string | null;
  pickupNote?: string | null;
  deliveryNote?: string | null;
  proofNote?: string | null;
};

export type MobileReturnRequest = {
  id: string;
  requestNumber: string;
  status: MobileReturnRequestStatus;
  resolution: MobileReturnResolution;
  reason: string;
  note?: string | null;
  autoApproved?: boolean;
  totalQuantity: number;
  requestedAmountPaise?: number | null;
  approvedAmountPaise?: number | null;
  couponAdjustmentPaise?: number | null;
  currency: string;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    orderStatus?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
  };
  pickupAddress?: MobileReturnAddress | null;
  customerName?: string | null;
  items: MobileReturnRequestItem[];
  reverseShipments?: MobileReverseShipment[];
  notes?: Array<{ note?: string | null }>;
};

export type MobileReturnListQuery = {
  cursor?: string | null;
  limit?: number;
  search?: string;
  status?: string;
};

export type MobileReturnListResponse = {
  items: MobileReturnRequest[];
  limit?: number;
  pageInfo?: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
  nextCursor?: string | null;
};

export type MobileCreateReturnPayload = {
  resolution: MobileCreateReturnResolution;
  reason: string;
  note?: string;
  reverseShipmentMode?: MobileReverseShipmentMode;
  items: Array<{
    orderItemId: string;
    quantity: number;
  }>;
};

export type MobileTrackedOrder = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  subtotalPaise?: number;
  shippingPaise?: number;
  platformFeePaise?: number;
  couponDiscountPaise?: number | null;
  totalPaise: number;
  currency: string;
  buyerCurrency?: string | null;
  buyerSubtotalMinor?: number | null;
  buyerPayableSubtotalMinor?: number | null;
  buyerShippingMinor?: number | null;
  buyerPlatformFeeMinor?: number | null;
  buyerCouponDiscountMinor?: number | null;
  buyerTotalMinor?: number | null;
  createdAt?: string;
  updatedAt?: string;
  shippingLocation?: {
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    countryCode?: string | null;
  } | null;
  items: Array<{
    id: string;
    productNameSnapshot: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
    currency: string;
    product?: {
      name?: string | null;
      slug?: string | null;
      imageUrl?: string | null;
    } | null;
    seller?: {
      storeName?: string | null;
      slug?: string | null;
    } | null;
  }>;
  deliveryDetail?: MobileOrderDetail["deliveryDetail"];
  customerDeliveryTimeline?: MobileOrderDetail["customerDeliveryTimeline"];
  statusEvents?: MobileOrderDetail["statusEvents"];
};

export type MobileTrackOrderPayload = {
  orderNumber: string;
  contact: string;
};

export type MobileProductQuery = {
  search?: string;
  categoryId?: string;
  sellerId?: string;
  page?: number;
  limit?: number;
  cursor?: string | null;
  pagination?: "offset" | "cursor";
};

export type MobileProductListResponse = {
  items: ProductSummary[];
  total?: number;
  page?: number;
  limit: number;
  pageInfo?: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

export type MobileWishlistSummary = {
  id: string;
  items: Array<{
    id: string;
    productId: string;
    createdAt?: string;
    product: ProductSummary;
  }>;
};

export const mobileSupportTopics = ["ORDER", "PAYMENT", "DELIVERY", "SELLER", "B2B", "DOWNLOAD_APP", "GENERAL"] as const;
export const mobileSupportContactChannels = ["EMAIL", "PHONE", "WHATSAPP"] as const;

export type MobileSupportTopic = (typeof mobileSupportTopics)[number];
export type MobileSupportContactChannel = (typeof mobileSupportContactChannels)[number];

export type MobileStorefrontContactConfig = {
  supportEmail?: string | null;
  supportPhone?: string | null;
  whatsappNumber?: string | null;
  whatsappUrl?: string | null;
  whatsappLink?: string | null;
  businessAddress?: string | null;
  workingHours?: string | null;
  responseSla?: string | null;
  enabledChannels?: MobileSupportContactChannel[];
};

export type MobileSupportRequest = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  topic: MobileSupportTopic;
  requesterType?: string;
  preferredContactChannel: MobileSupportContactChannel;
  source?: string;
  orderNumber?: string | null;
  subject: string;
  message: string;
  status: string;
  adminNote?: string | null;
  responseMessage?: string | null;
  respondedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MobileSupportRequestPayload = {
  name?: string;
  email?: string;
  phone?: string;
  topic: MobileSupportTopic;
  requesterType?: "CUSTOMER";
  preferredContactChannel: MobileSupportContactChannel;
  subject: string;
  orderNumber?: string;
  message: string;
};

export type MobileStoreLocationQuery = {
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
  pincode?: string;
  limit?: number;
};

export type MobilePlaceOrderPayload = {
  addressId?: string;
  deliveryPreference: MobileDeliveryPreference;
  idempotencyKey?: string;
  paymentMethod: MobilePaymentMethod;
  paymentReference?: string;
  buyerCountryCode?: string;
  customerNote?: string;
};

export function listLocationCountries() {
  return getJson<MobileLocationCountry[]>({
    path: "/locations/countries",
  });
}

export function listLocationStates(countryCode = "IN") {
  return getJson<MobileLocationSubdivision[]>({
    path: "/locations/states",
    searchParams: {
      countryCode,
    },
  });
}

export function listLocationCities(query: { countryCode?: string; stateCode?: string } = {}) {
  return getJson<MobileLocationCity[]>({
    path: "/locations/cities",
    searchParams: {
      countryCode: query.countryCode,
      stateCode: query.stateCode,
    },
  });
}

export function getMarketCurrency(countryCode = "IN") {
  return getJson<MobileMarketCurrency>({
    path: "/market/currency",
    searchParams: {
      countryCode,
    },
  });
}

export function listLocationAreas(
  query: {
    countryCode?: string;
    stateCode?: string | null;
    cityCode?: string | null;
    search?: string;
    postalCode?: string;
    limit?: number;
  } = {},
) {
  return getJson<LocationArea[]>({
    path: "/locations/areas",
    searchParams: {
      countryCode: query.countryCode,
      stateCode: query.stateCode,
      cityCode: query.cityCode,
      search: query.search,
      postalCode: query.postalCode,
      limit: query.limit ?? 12,
    },
  });
}

export function searchLocationAreas(search: string, countryCode = "IN") {
  return listLocationAreas({ countryCode, search, limit: 12 });
}

export function searchStorefront(query: {
  q: string;
  type?: "all" | "product" | "store" | "category";
  limit?: number;
  cursor?: string | null;
}) {
  const type = query.type && query.type !== "all" ? query.type : undefined;

  return getJson<StorefrontSearchResponse>({
    path: "/search",
    searchParams: {
      q: query.q,
      type,
      limit: query.limit ?? 20,
      cursor: query.cursor,
    },
  });
}

export function getSearchSuggestions(q: string) {
  return getJson<StorefrontSuggestionsResponse>({
    path: "/search/suggestions",
    searchParams: {
      q,
      limit: 8,
    },
  });
}

export function getProduct(slug: string) {
  return getJson<ProductSummary>({
    path: `/products/${encodeURIComponent(slug)}`,
  });
}

export function listCategories() {
  return getJson<MobileCategory[]>({
    path: "/categories",
  });
}

export function getCategory(slug: string) {
  return getJson<MobileCategory>({
    path: `/categories/${encodeURIComponent(slug)}`,
  });
}

export function listProducts(
  query: MobileProductQuery = {},
) {
  return getJson<MobileProductListResponse>({
    path: "/products",
    searchParams: query,
  });
}

export function listStorefrontDeals(query: MobileProductQuery = {}) {
  return getJson<MobileProductListResponse>({
    path: "/storefront/deals",
    searchParams: query,
  });
}

export function listStores(query: MobileStoreLocationQuery = {}) {
  return getJson<MobileStore[]>({
    path: "/sellers",
    searchParams: query,
  });
}

export function getStoreProfile(slug: string) {
  return getJson<MobileStore>({
    path: `/sellers/${encodeURIComponent(slug)}`,
  });
}

export function getCart(auth: MobileAuthHeaders) {
  return getJson<MobileCartSummary>({
    path: "/cart",
    auth,
  });
}

export function getCustomerProfile(auth: MobileAuthHeaders) {
  return getJson<MobileCustomerProfile>({
    path: "/account/profile",
    auth,
  });
}

export function updateCustomerProfile(auth: MobileAuthHeaders, payload: MobileCustomerProfilePayload) {
  return patchJson<MobileCustomerProfile>({
    path: "/account/profile",
    auth,
    body: payload,
  });
}

export function getBrowsingLocation(auth: MobileAuthHeaders) {
  return getJson<MobileBrowsingLocationResponse>({
    path: "/account/browsing-location",
    auth,
  });
}

export function updateBrowsingLocation(auth: MobileAuthHeaders, payload: MobileBrowsingLocation) {
  return patchJson<MobileBrowsingLocationResponse>({
    path: "/account/browsing-location",
    auth,
    body: payload,
  });
}

export function clearBrowsingLocation(auth: MobileAuthHeaders) {
  return deleteNoContent({
    path: "/account/browsing-location",
    auth,
  });
}

export function listCustomerAddresses(auth: MobileAuthHeaders) {
  return getJson<MobileCustomerAddress[]>({
    path: "/account/addresses",
    auth,
  });
}

export function createCustomerAddress(auth: MobileAuthHeaders, payload: MobileCustomerAddressPayload) {
  return postJson<MobileCustomerAddress>({
    path: "/account/addresses",
    auth,
    body: payload,
  });
}

export function updateCustomerAddress(auth: MobileAuthHeaders, addressId: string, payload: Partial<MobileCustomerAddressPayload>) {
  return patchJson<MobileCustomerAddress>({
    path: `/account/addresses/${addressId}`,
    auth,
    body: payload,
  });
}

export function deleteCustomerAddress(auth: MobileAuthHeaders, addressId: string) {
  return deleteNoContent({
    path: `/account/addresses/${addressId}`,
    auth,
  });
}

export function getCheckoutSummary(
  auth: MobileAuthHeaders,
  options: {
    buyerCountryCode?: string;
    deliveryPreference?: MobileDeliveryPreference;
    paymentMethod?: MobilePaymentMethod;
    addressId?: string | null;
  } = {},
) {
  return getJson<MobileCheckoutSummary>({
    path: "/cart/checkout-summary",
    auth,
    searchParams: {
      buyerCountryCode: options.buyerCountryCode ?? "IN",
      deliveryPreference: options.deliveryPreference,
      paymentMethod: options.paymentMethod,
      addressId: options.addressId,
    },
  });
}

export function getCheckoutPaymentMethods(auth: MobileAuthHeaders) {
  return getJson<MobileCheckoutPaymentMethodsResponse>({
    path: "/payments/checkout-methods",
    auth,
  });
}

export function placeOrder(auth: MobileAuthHeaders, payload: MobilePlaceOrderPayload) {
  return postJson<MobileOrderSummary>({
    path: "/account/orders",
    auth,
    body: payload,
  });
}

export function createRazorpayProviderOrder(auth: MobileAuthHeaders, orderNumber: string) {
  return postJson<MobileRazorpayOrderResponse>({
    path: `/payments/razorpay/orders/${encodeURIComponent(orderNumber)}`,
    auth,
  });
}

export function verifyRazorpayPayment(auth: MobileAuthHeaders, payload: MobileRazorpayVerificationPayload) {
  return postJson<MobileRazorpayVerificationResponse>({
    path: "/payments/razorpay/verify",
    auth,
    body: payload,
  });
}

export function listCustomerOrders(auth: MobileAuthHeaders, limit = 20) {
  return getJson<MobileOrderListResponse>({
    path: "/account/orders",
    auth,
    searchParams: { limit },
  });
}

export function getCustomerOrder(auth: MobileAuthHeaders, orderNumber: string) {
  return getJson<MobileOrderDetail>({
    path: `/account/orders/${encodeURIComponent(orderNumber)}`,
    auth,
  });
}

export function cancelCustomerOrder(auth: MobileAuthHeaders, orderNumber: string, reason?: string) {
  return patchJson<MobileOrderDetail>({
    path: `/account/orders/${encodeURIComponent(orderNumber)}/cancel`,
    auth,
    body: {
      ...(reason?.trim() ? { note: reason.trim() } : {}),
    },
  });
}

export function createCustomerReturn(auth: MobileAuthHeaders, orderNumber: string, payload: MobileCreateReturnPayload) {
  return postJson<MobileReturnRequest>({
    path: `/account/orders/${encodeURIComponent(orderNumber)}/returns`,
    auth,
    body: payload,
  });
}

export function listCustomerReturns(auth: MobileAuthHeaders, query: MobileReturnListQuery = {}) {
  return getJson<MobileReturnListResponse>({
    path: "/account/returns",
    auth,
    searchParams: {
      cursor: query.cursor,
      limit: query.limit ?? 25,
      search: query.search,
      status: query.status,
    },
  });
}

export function getCustomerReturn(auth: MobileAuthHeaders, requestNumber: string) {
  return getJson<MobileReturnRequest>({
    path: `/account/returns/${encodeURIComponent(requestNumber)}`,
    auth,
  });
}

export function trackOrder(payload: MobileTrackOrderPayload) {
  return postJson<MobileTrackedOrder>({
    path: "/orders/track",
    body: payload,
  });
}

export function getWishlist(auth: MobileAuthHeaders) {
  return getJson<MobileWishlistSummary>({
    path: "/account/wishlist",
    auth,
  });
}

export function addWishlistItem(auth: MobileAuthHeaders, productId: string) {
  return postJson<MobileWishlistSummary>({
    path: "/account/wishlist/items",
    auth,
    body: { productId },
  });
}

export function removeWishlistItem(auth: MobileAuthHeaders, productId: string) {
  return deleteNoContent({
    path: `/account/wishlist/items/${productId}`,
    auth,
  });
}

export function getStorefrontContact() {
  return getJson<MobileStorefrontContactConfig>({
    path: "/storefront/contact",
  });
}

export function listCustomerSupportRequests(auth: MobileAuthHeaders) {
  return getJson<MobileSupportRequest[]>({
    path: "/support-requests/me",
    auth,
  });
}

export function createAuthenticatedSupportRequest(auth: MobileAuthHeaders, payload: MobileSupportRequestPayload) {
  return postJson<MobileSupportRequest>({
    path: "/support-requests/authenticated",
    auth,
    body: {
      ...payload,
      requesterType: payload.requesterType ?? "CUSTOMER",
    },
  });
}

export function addCartItem(auth: MobileAuthHeaders, productVariantId: string, quantity: number) {
  return postJson<MobileCartSummary>({
    path: "/cart/items",
    auth,
    body: { productVariantId, quantity },
  });
}

export function updateCartItem(auth: MobileAuthHeaders, cartItemId: string, quantity: number) {
  return patchJson<MobileCartSummary>({
    path: `/cart/items/${cartItemId}`,
    auth,
    body: { quantity },
  });
}

export function removeCartItem(auth: MobileAuthHeaders, cartItemId: string) {
  return deleteNoContent({
    path: `/cart/items/${cartItemId}`,
    auth,
  });
}
