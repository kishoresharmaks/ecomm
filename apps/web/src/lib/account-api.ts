import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { OrderSummary, ProductImage, ProductVariant, SellerSummary } from "./storefront-api";

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
  } | null;
  sellerSplits?: Array<{
    id: string;
    sellerId: string;
    sellerSubtotalPaise: number;
    commissionPaise: number;
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
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export type SupportRequest = SupportRequestPayload & {
  id: string;
  userId?: string | null;
  status: string;
  adminNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
