import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { LocationSource } from "./maps-api";

export type CategorySummary = {
  id: string;
  parentId?: string | null;
  productTemplateId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  defaultHsnCode?: string | null;
  defaultGstRatePercent?: number | string | null;
  defaultTaxDescription?: string | null;
  sortOrder?: number;
  productTemplate?: ProductTemplateSummary | null;
  children?: CategorySummary[];
  parent?: CategorySummary | null;
  _count?: {
    products?: number;
    children?: number;
  };
};

export type ProductListingMode = "CART" | "ENQUIRY_ONLY" | "CART_AND_ENQUIRY";
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
  listingMode: ProductListingMode;
  sortOrder: number;
  fields?: ProductTemplateField[];
  _count?: {
    categories?: number;
  };
};

export type ProductImage = {
  id: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type ProductVariant = {
  id: string;
  sku: string;
  variantName?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  currency: string;
  stockQuantity: number;
  packageWeightGrams?: number | null;
  packageLengthCm?: number | null;
  packageBreadthCm?: number | null;
  packageHeightCm?: number | null;
  status: string;
  attributes?: Record<string, unknown> | null;
};

export type SellerSummary = {
  id: string;
  storeName: string;
  slug: string;
  sellerType?: string;
  status?: string;
  approvalStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  profile?: {
    logoUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  payoutProfile?: {
    accountHolderName?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    upiId?: string | null;
    isVerified?: boolean;
  } | null;
  user?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

export type SellerAddress = {
  id: string;
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
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationSource?: LocationSource | string | null;
  accuracyMeters?: number | string | null;
  locationConfidenceScore?: number | string | null;
};

export type PublicStoreAddress = {
  area?: string | null;
  city: string;
  state: string;
  country?: string | null;
  countryCode?: string | null;
};

export type StoreLocationMatchLevel = "LOCAL_AREA" | "CITY" | "STATE" | "COUNTRY" | "NONE";

export type StoreProfile = {
  id: string;
  storeName: string;
  slug: string;
  sellerType?: string;
  createdAt?: string;
  profile?: {
    logoUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    createdAt?: string;
  } | null;
  addresses: PublicStoreAddress[];
  locationMatchLevel?: StoreLocationMatchLevel;
  _count?: {
    products?: number;
  };
};

export type StoreLocationQuery = {
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
  pincode?: string;
  limit?: number;
};

export type ProductSummary = {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  approvalStatus: string;
  listingMode?: ProductListingMode;
  attributes?: Record<string, unknown> | null;
  hsnCode?: string | null;
  gstRatePercent?: number | string | null;
  hsnMaster?: HsnMasterEntry | null;
  isFeatured?: boolean;
  category: CategorySummary;
  seller: SellerSummary;
  images: ProductImage[];
  variants: ProductVariant[];
  campaignBadge?: string | null;
  campaignLabel?: string | null;
  campaignDescription?: string | null;
  campaignImageUrl?: string | null;
  campaignLinkUrl?: string | null;
  createdAt?: string;
};

export type HsnMasterEntry = {
  id: string;
  hsnCode: string;
  description: string;
  gstRatePercent: number | string;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type PaginatedProducts = {
  items: ProductSummary[];
  total?: number;
  page?: number;
  limit: number;
  pageInfo?: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

export type CartItem = {
  id: string;
  quantity: number;
  unitPricePaise: number;
  currency: string;
  seller: SellerSummary;
  productVariant: ProductVariant & {
    product: ProductSummary;
  };
};

export type CartSummary = {
  id: string;
  status: string;
  items: CartItem[];
};

export type CheckoutSummary = {
  itemCount: number;
  subtotalPaise: number;
  shippingPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  currency: string;
  buyerCountryCode: string;
  buyerCurrency: string;
  buyerSubtotalMinor: number;
  buyerShippingMinor: number;
  buyerPlatformFeeMinor: number;
  buyerTotalMinor: number;
};

export type CheckoutSummaryOptions = {
  buyerCountryCode?: string;
  deliveryPreference?: "STORE_PICKUP" | "DELIVER_TO_ADDRESS";
  addressId?: string;
  paymentMethod?: "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
  shippingAddress?: {
    countryCode?: string | undefined;
    stateCode?: string | undefined;
    cityCode?: string | undefined;
    pincode?: string | undefined;
    localAreaCode?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    locationSource?: LocationSource | undefined;
    accuracyMeters?: number | undefined;
    locationConfidenceScore?: number | undefined;
  };
};

export type CheckoutAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  area?: string | undefined;
  city: string;
  state: string;
  pincode: string;
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

export type PlaceOrderPayload = {
  addressId?: string;
  shippingAddress?: CheckoutAddress;
  deliveryPreference?: "STORE_PICKUP" | "DELIVER_TO_ADDRESS";
  deliveryMode?: "STORE_PICKUP" | "LOCAL_DELIVERY_PARTNER" | "THIRD_PARTY_COURIER" | "MANUAL_TRANSPORT";
  paymentMethod: "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
  paymentReference?: string;
  buyerCountryCode?: string;
  shippingPaise?: number;
  customerNote?: string;
};

export type ResolveCheckoutDeliveryPayload = {
  deliveryPreference: "STORE_PICKUP" | "DELIVER_TO_ADDRESS";
  addressId?: string;
  shippingAddress?: CheckoutAddress;
  paymentMethod?: PlaceOrderPayload["paymentMethod"];
};

export type CheckoutDeliveryRouteQuote = {
  deliveryPreference: "STORE_PICKUP" | "DELIVER_TO_ADDRESS";
  deliveryMode: "STORE_PICKUP" | "LOCAL_DELIVERY_PARTNER" | "THIRD_PARTY_COURIER" | "MANUAL_TRANSPORT";
  recommendedPartnerUserId: string | null;
  courierProviderCode: string | null;
  matchedRateCardId: string | null;
  shippingChargePaise: number;
  codSurchargePaise: number;
  totalDeliveryChargePaise: number;
  freeShippingApplied: boolean;
  routingFailed: boolean;
  routingFailureReason: string | null;
  routingFailureNote: string | null;
  fallbackReason: string | null;
  shipmentQuotes?: Array<{
    sellerId: string;
    sellerType: string;
    subtotalPaise: number;
    deliveryMode: "STORE_PICKUP" | "LOCAL_DELIVERY_PARTNER" | "THIRD_PARTY_COURIER" | "MANUAL_TRANSPORT";
    shippingChargePaise: number;
    codSurchargePaise: number;
    totalDeliveryChargePaise: number;
    routingFailed: boolean;
    routingFailureReason: string | null;
    routingFailureNote: string | null;
    courierProviderCode: string | null;
    recommendedPartnerUserId: string | null;
    recommendedPartnerName: string | null;
    routingSnapshot?: unknown;
  }>;
  shipmentShippingTotalPaise?: number;
  warnings: string[];
};

export type RazorpayOrderResponse = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  orderNumber: string;
};

export type RazorpayVerificationPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type RazorpayVerificationResponse = {
  received: boolean;
  paymentId: string;
  status: string;
};

export type CheckoutPaymentMethodRecord = {
  method: PlaceOrderPayload["paymentMethod"];
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
};

export type CheckoutPaymentMethodsResponse = {
  methods: CheckoutPaymentMethodRecord[];
};

export type HomepageBanner = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  eyebrow?: string | null;
  ctaLabel?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryLinkUrl?: string | null;
  mobileImageUrl?: string | null;
  imageAlt?: string | null;
  textPosition?: "LEFT" | "CENTER" | "RIGHT" | string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status: string;
  sortOrder: number;
  updatedAt?: string;
};

export type HomepageSectionItem = {
  sourceType?: string;
  sourceId?: string;
  slug?: string;
  label?: string;
  title?: string;
  name?: string;
  description?: string;
  subtitle?: string;
  imageUrl?: string;
  image?: string;
  linkUrl?: string;
  href?: string;
  url?: string;
  badge?: string;
};

export type HomepageSection = {
  id: string;
  title: string;
  sectionType: string;
  config?: {
    eyebrow?: string;
    subtitle?: string;
    description?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    ctaHref?: string;
    items?: HomepageSectionItem[];
    [key: string]: unknown;
  } | null;
  status: string;
  sortOrder: number;
  updatedAt?: string;
};

export type CmsMenuItem = {
  id: string;
  area: string;
  label: string;
  href: string;
  parentId?: string | null;
  status: string;
  sortOrder: number;
  children?: CmsMenuItem[];
};

export type StorefrontHomeStats = {
  liveProducts: number;
  approvedStores: number;
  activeCustomers: number;
  activeCategories: number;
  verifiedSellers: number;
  verifiedSellerPercent: number;
};

export type StorefrontHomePayload = {
  banners: HomepageBanner[];
  homepageSections: HomepageSection[];
  categories: CategorySummary[];
  storesNearYou: StoreProfile[];
  productRails: {
    featured: ProductSummary[];
    latest: ProductSummary[];
    deals: ProductSummary[];
  };
  stats: StorefrontHomeStats;
  menus: {
    header: CmsMenuItem[];
    footer: CmsMenuItem[];
    legal: CmsMenuItem[];
  };
  sellerCta?: HomepageSection | null;
  serviceBadges?: HomepageSection | null;
  generatedAt?: string;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  subtotalPaise: number;
  shippingPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  currency: string;
  buyerCountryCode?: string;
  buyerCurrency?: string;
  buyerSubtotalMinor?: number;
  buyerShippingMinor?: number;
  buyerPlatformFeeMinor?: number;
  buyerTotalMinor?: number;
  fxRate?: string | null;
  fxProvider?: string | null;
  fxRateFetchedAt?: string | null;
  createdAt?: string;
  items: Array<{
    id: string;
    sellerId?: string;
    productNameSnapshot: string;
    variantSnapshot?: {
      sku?: string;
      variantName?: string | null;
    } | null;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
    currency: string;
    product?: ProductSummary;
    seller?: SellerSummary;
  }>;
  shipments?: Array<{
    id: string;
    shipmentNumber: string;
    sellerId: string;
    seller?: SellerSummary | null;
    subtotalPaise: number;
    shippingPaise: number;
    codSurchargePaise?: number;
    deliveryMode: string;
    status: string;
    assignmentStatus?: string | null;
    partnerName?: string | null;
    partnerPhone?: string | null;
    trackingReference?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    packages?: Array<{
      id: string;
      packageNumber: string;
      orderShipmentId: string;
      orderId: string;
      sellerId: string;
      sequence: number;
      deliveryMode: string;
      status: string;
      shippingPaise: number;
      codSurchargePaise?: number;
      declaredValuePaise?: number;
      currency: string;
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
      awbNumber?: string | null;
      courierName?: string | null;
      courierCode?: string | null;
      courierTrackingStatus?: string | null;
      courierTrackingStatusLabel?: string | null;
      trackingUrl?: string | null;
      shipmentBookedAt?: string | null;
      canDownloadLabel?: boolean;
      labelDownloadUrl?: string | null;
    }>;
  }>;
  deliveryDetail?: {
    deliveryMode: string;
    partnerName?: string | null;
    partnerPhone?: string | null;
    assignmentStatus?: string | null;
    assignedAt?: string | null;
    acceptedAt?: string | null;
    trackingReference?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    status: string;
    events?: Array<{
      id: string;
      oldStatus?: string | null;
      newStatus: string;
      note?: string | null;
      createdAt?: string;
    }>;
  } | null;
  customerDeliveryTimeline?: Array<{
    code: string;
    label: string;
    at?: string | null;
    completed: boolean;
  }>;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicSupportPayload = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export type TrackOrderPayload = {
  orderNumber: string;
  contact: string;
};

export type PublicTrackedOrder = Pick<
  OrderSummary,
  | "orderNumber"
  | "orderStatus"
  | "paymentStatus"
  | "deliveryStatus"
  | "subtotalPaise"
  | "shippingPaise"
  | "platformFeePaise"
  | "totalPaise"
  | "currency"
  | "buyerCountryCode"
  | "buyerCurrency"
  | "buyerSubtotalMinor"
  | "buyerShippingMinor"
  | "buyerPlatformFeeMinor"
  | "buyerTotalMinor"
  | "fxRate"
  | "fxProvider"
  | "fxRateFetchedAt"
  | "createdAt"
> & {
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
    variantSnapshot?: {
      sku?: string;
      variantName?: string | null;
    } | null;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
    currency: string;
    product?: {
      name: string;
      slug: string;
      imageUrl?: string | null;
    } | null;
    seller?: {
      storeName: string;
      slug: string;
    } | null;
  }>;
  deliveryDetail?: NonNullable<OrderSummary["deliveryDetail"]> | null;
  customerDeliveryTimeline?: NonNullable<OrderSummary["customerDeliveryTimeline"]>;
  statusEvents?: Array<{
    id: string;
    statusType: string;
    oldStatus?: string | null;
    newStatus: string;
    note?: string | null;
    createdAt?: string;
  }>;
};

export function listCategories() {
  return indihubFetch<CategorySummary[]>("/api/categories");
}

export function searchHsnMaster({
  search,
  categoryId,
  limit = 10,
}: {
  search?: string;
  categoryId?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  if (categoryId) {
    params.set("categoryId", categoryId);
  }
  params.set("limit", String(limit));

  return indihubFetch<HsnMasterEntry[]>(`/api/hsn-master?${params.toString()}`);
}

export function getCategory(slug: string) {
  return indihubFetch<CategorySummary>(`/api/categories/${encodeURIComponent(slug)}`);
}

export function listProducts(
  query: {
    search?: string;
    categoryId?: string;
    sellerId?: string;
    page?: number;
    limit?: number;
    cursor?: string | null;
    pagination?: "offset" | "cursor";
  } = {},
  auth?: IndihubAuthHeaders,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return indihubFetch<PaginatedProducts>(`/api/products${suffix}`, undefined, auth);
}

export function listStorefrontDeals(
  query: {
    search?: string;
    categoryId?: string;
    sellerId?: string;
    page?: number;
    limit?: number;
    cursor?: string | null;
    pagination?: "offset" | "cursor";
  } = {},
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return indihubFetch<PaginatedProducts>(`/api/storefront/deals${suffix}`);
}

export function getProduct(slug: string) {
  return indihubFetch<ProductSummary>(`/api/products/${encodeURIComponent(slug)}`);
}

export function getStoreProfile(slug: string) {
  return indihubFetch<StoreProfile>(`/api/sellers/${encodeURIComponent(slug)}`);
}

export function listStores(query: StoreLocationQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return indihubFetch<StoreProfile[]>(`/api/sellers${suffix}`);
}

export function getStorefrontHome(query: StoreLocationQuery = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const suffix = params.size ? `?${params.toString()}` : "";
  return indihubFetch<StorefrontHomePayload>(`/api/storefront/home${suffix}`);
}

export function getCmsPage(slug: string) {
  return indihubFetch<CmsPage>(`/api/cms/pages/${encodeURIComponent(slug)}`);
}

export function createPublicSupportRequest(payload: PublicSupportPayload) {
  return indihubFetch("/api/support-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function trackOrder(payload: TrackOrderPayload) {
  return indihubFetch<PublicTrackedOrder>("/api/orders/track", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCart(auth: IndihubAuthHeaders) {
  return indihubFetch<CartSummary>("/api/cart", undefined, auth);
}

export function getCheckoutSummary(
  auth: IndihubAuthHeaders,
  options: string | CheckoutSummaryOptions = "IN",
) {
  const summaryOptions = typeof options === "string" ? { buyerCountryCode: options } : options;
  const query = new URLSearchParams();
  query.set("buyerCountryCode", summaryOptions.buyerCountryCode ?? "IN");
  if (summaryOptions.deliveryPreference) {
    query.set("deliveryPreference", summaryOptions.deliveryPreference);
  }
  if (summaryOptions.paymentMethod) {
    query.set("paymentMethod", summaryOptions.paymentMethod);
  }
  if (summaryOptions.addressId) {
    query.set("addressId", summaryOptions.addressId);
  }
  const address = summaryOptions.shippingAddress;
  if (address?.countryCode) {
    query.set("countryCode", address.countryCode);
  }
  if (address?.stateCode) {
    query.set("stateCode", address.stateCode);
  }
  if (address?.cityCode) {
    query.set("cityCode", address.cityCode);
  }
  if (address?.pincode) {
    query.set("pincode", address.pincode);
  }
  if (address?.localAreaCode) {
    query.set("localAreaCode", address.localAreaCode);
  }
  if (address?.latitude !== undefined) {
    query.set("latitude", String(address.latitude));
  }
  if (address?.longitude !== undefined) {
    query.set("longitude", String(address.longitude));
  }

  return indihubFetch<CheckoutSummary>(
    `/api/cart/checkout-summary?${query.toString()}`,
    undefined,
    auth,
  );
}

export function addCartItem(auth: IndihubAuthHeaders, productVariantId: string, quantity: number) {
  return indihubFetch<CartSummary>(
    "/api/cart/items",
    {
      method: "POST",
      body: JSON.stringify({ productVariantId, quantity }),
    },
    auth,
  );
}

export function updateCartItem(auth: IndihubAuthHeaders, cartItemId: string, quantity: number) {
  return indihubFetch<CartSummary>(
    `/api/cart/items/${encodeURIComponent(cartItemId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    },
    auth,
  );
}

export function removeCartItem(auth: IndihubAuthHeaders, cartItemId: string) {
  return indihubFetch<CartSummary>(
    `/api/cart/items/${encodeURIComponent(cartItemId)}`,
    {
      method: "DELETE",
    },
    auth,
  );
}

export function placeOrder(auth: IndihubAuthHeaders, payload: PlaceOrderPayload) {
  return indihubFetch<OrderSummary>(
    "/api/account/orders",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function resolveCheckoutDelivery(
  auth: IndihubAuthHeaders,
  payload: ResolveCheckoutDeliveryPayload,
) {
  return indihubFetch<CheckoutDeliveryRouteQuote>(
    "/api/checkout/resolve-delivery",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function createRazorpayProviderOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<RazorpayOrderResponse>(
    `/api/payments/razorpay/orders/${encodeURIComponent(orderNumber)}`,
    {
      method: "POST",
    },
    auth,
  );
}

export function verifyRazorpayPayment(
  auth: IndihubAuthHeaders,
  payload: RazorpayVerificationPayload,
) {
  return indihubFetch<RazorpayVerificationResponse>(
    "/api/payments/razorpay/verify",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function getCheckoutPaymentMethods(auth: IndihubAuthHeaders) {
  return indihubFetch<CheckoutPaymentMethodsResponse>(
    "/api/payments/checkout-methods",
    undefined,
    auth,
  );
}

export function listHomepageBanners() {
  return indihubFetch<HomepageBanner[]>("/api/cms/banners");
}

export function listHomepageSections() {
  return indihubFetch<HomepageSection[]>("/api/cms/homepage-sections");
}

export function listCmsMenus(area = "header") {
  return indihubFetch<CmsMenuItem[]>(`/api/cms/menus?area=${encodeURIComponent(area)}`);
}

export function getCustomerOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<OrderSummary>(
    `/api/account/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function formatMoney(
  paise?: number | null,
  currency = "INR",
  locale = currency === "INR" ? "en-IN" : "en-US",
) {
  const amount = (paise ?? 0) / 100;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatOrderTotal(
  order: Pick<OrderSummary, "totalPaise" | "currency" | "buyerTotalMinor" | "buyerCurrency">,
) {
  if (
    order.buyerCurrency &&
    order.buyerTotalMinor !== undefined &&
    order.buyerTotalMinor !== null
  ) {
    return formatMoney(order.buyerTotalMinor, order.buyerCurrency);
  }

  return formatMoney(order.totalPaise, order.currency);
}

export function primaryImage(product: ProductSummary) {
  const campaignImage = product.campaignImageUrl?.trim();
  return campaignImage || (product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null);
}

export function isPurchasableVariant(variant: ProductVariant) {
  return variant.status === "ACTIVE" && variant.stockQuantity > 0;
}

export function primaryVariant(product: ProductSummary) {
  return (
    product.variants.find(isPurchasableVariant) ??
    product.variants.find((variant) => variant.status === "ACTIVE") ??
    product.variants[0] ??
    null
  );
}

export function cartTotals(cart?: CartSummary) {
  const subtotalPaise =
    cart?.items.reduce((total, item) => total + item.quantity * item.unitPricePaise, 0) ?? 0;
  const itemCount = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  return { subtotalPaise, itemCount };
}
