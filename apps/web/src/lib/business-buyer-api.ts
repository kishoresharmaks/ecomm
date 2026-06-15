import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { ProductImage, ProductVariant, SellerSummary } from "./storefront-api";

export type BusinessBuyerUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  status?: string;
};

export type BusinessBuyerAddress = {
  id: string;
  businessBuyerId: string;
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
  createdAt?: string;
  updatedAt?: string;
};

export type BusinessBuyerProfile = {
  id: string;
  userId: string;
  companyName: string;
  gstNumber?: string | null;
  contactName: string;
  contactPhone: string;
  status: string;
  user?: BusinessBuyerUser | null;
  addresses: BusinessBuyerAddress[];
  createdAt?: string;
  updatedAt?: string;
};

export type BusinessBuyerProfilePayload = {
  companyName: string;
  gstNumber?: string | undefined;
  contactName: string;
  contactPhone: string;
};

export type BusinessBuyerAddressPayload = {
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

export type B2BEnquiryProduct = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
};

export type B2BEnquiryResponse = {
  id: string;
  responseMessage: string;
  quotedPricePaise?: number | null;
  createdAt?: string;
  responder?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

export type BusinessBuyerEnquiryStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "RESPONDED"
  | "BUYER_CONFIRMED"
  | "ADMIN_APPROVED"
  | "FINALISED"
  | "CLOSED"
  | "CANCELLED";

export type B2BOrderStatus =
  | "PROFORMA_ISSUED"
  | "PO_SUBMITTED"
  | "PO_ACCEPTED"
  | "IN_FULFILMENT"
  | "FULFILLED"
  | "CANCELLED";

export type BusinessBuyerEnquiry = {
  id: string;
  businessBuyerId: string;
  productId?: string | null;
  sellerId?: string | null;
  quantity: number;
  message: string;
  status: BusinessBuyerEnquiryStatus;
  createdAt?: string;
  updatedAt?: string;
  product?: B2BEnquiryProduct | null;
  seller?: SellerSummary | null;
  responses?: B2BEnquiryResponse[];
  b2bOrder?: B2BOrder | null;
};

export type B2BOrderEvent = {
  id: string;
  status: B2BOrderStatus;
  note?: string | null;
  payload?: unknown;
  createdAt?: string;
  actor?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

export type B2BOrder = {
  id: string;
  orderNumber: string;
  enquiryId: string;
  businessBuyerId: string;
  sellerId?: string | null;
  productId?: string | null;
  selectedResponseId?: string | null;
  status: B2BOrderStatus;
  proformaInvoiceNumber: string;
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
  currency?: string;
  termsSnapshot?: unknown;
  createdAt?: string;
  updatedAt?: string;
  businessBuyer?: BusinessBuyerProfile | null;
  product?: B2BEnquiryProduct | null;
  seller?: SellerSummary | null;
  selectedResponse?: B2BEnquiryResponse | null;
  enquiry?: BusinessBuyerEnquiry | null;
  events?: B2BOrderEvent[];
};

export type PaginatedBusinessBuyerEnquiries = {
  items: BusinessBuyerEnquiry[];
  total: number;
  page: number;
  limit: number;
};

export type PaginatedB2BOrders = {
  items: B2BOrder[];
  total: number;
  page: number;
  limit: number;
};

export type BusinessBuyerEnquiryPayload = {
  productId?: string | undefined;
  sellerId?: string | undefined;
  quantity: number;
  message: string;
};

export type BusinessBuyerPurchaseOrderPayload = {
  purchaseOrderNumber: string;
  purchaseOrderFileKey?: string | undefined;
  note?: string | undefined;
};

export function getBusinessBuyerProfile(auth: IndihubAuthHeaders) {
  return indihubFetch<BusinessBuyerProfile>("/api/b2b/profile", undefined, auth);
}

export function upsertBusinessBuyerProfile(auth: IndihubAuthHeaders, payload: BusinessBuyerProfilePayload) {
  return indihubFetch<BusinessBuyerProfile>(
    "/api/b2b/profile",
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function listBusinessBuyerAddresses(auth: IndihubAuthHeaders) {
  return indihubFetch<BusinessBuyerAddress[]>("/api/b2b/addresses", undefined, auth);
}

export function createBusinessBuyerAddress(auth: IndihubAuthHeaders, payload: BusinessBuyerAddressPayload) {
  return indihubFetch<BusinessBuyerAddress>(
    "/api/b2b/addresses",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function updateBusinessBuyerAddress(
  auth: IndihubAuthHeaders,
  addressId: string,
  payload: Partial<BusinessBuyerAddressPayload>
) {
  return indihubFetch<BusinessBuyerAddress>(
    `/api/b2b/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function deleteBusinessBuyerAddress(auth: IndihubAuthHeaders, addressId: string) {
  return indihubFetch<{ deleted: boolean }>(
    `/api/b2b/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "DELETE"
    },
    auth
  );
}

export function listBusinessBuyerEnquiries(
  auth: IndihubAuthHeaders,
  query: { search?: string; status?: string; page?: number; limit?: number } = {}
) {
  return indihubFetch<PaginatedBusinessBuyerEnquiries>(`/api/b2b/enquiries${queryString(query)}`, undefined, auth);
}

export function createBusinessBuyerEnquiry(auth: IndihubAuthHeaders, payload: BusinessBuyerEnquiryPayload) {
  return indihubFetch<BusinessBuyerEnquiry>(
    "/api/b2b/enquiries",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    auth
  );
}

export function getBusinessBuyerEnquiry(auth: IndihubAuthHeaders, enquiryId: string) {
  return indihubFetch<BusinessBuyerEnquiry>(`/api/b2b/enquiries/${encodeURIComponent(enquiryId)}`, undefined, auth);
}

export function cancelBusinessBuyerEnquiry(auth: IndihubAuthHeaders, enquiryId: string) {
  return indihubFetch<BusinessBuyerEnquiry>(
    `/api/b2b/enquiries/${encodeURIComponent(enquiryId)}/cancel`,
    {
      method: "PATCH"
    },
    auth
  );
}

export function confirmBusinessBuyerEnquiry(auth: IndihubAuthHeaders, enquiryId: string) {
  return indihubFetch<BusinessBuyerEnquiry>(
    `/api/b2b/enquiries/${encodeURIComponent(enquiryId)}/confirm`,
    {
      method: "PATCH"
    },
    auth
  );
}

export function listBusinessBuyerB2BOrders(
  auth: IndihubAuthHeaders,
  query: { search?: string; status?: string; page?: number; limit?: number } = {}
) {
  return indihubFetch<PaginatedB2BOrders>(`/api/b2b/orders${queryString(query)}`, undefined, auth);
}

export function getBusinessBuyerB2BOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<B2BOrder>(`/api/b2b/orders/${encodeURIComponent(orderNumber)}`, undefined, auth);
}

export function submitBusinessBuyerPurchaseOrder(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: BusinessBuyerPurchaseOrderPayload
) {
  return indihubFetch<B2BOrder>(
    `/api/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    auth
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
