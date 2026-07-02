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
  transportChargePaise?: number | null;
  transportEta?: string | null;
  transportNote?: string | null;
  createdAt?: string;
  responder?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
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

export type B2BEnquiryMessagePage = {
  items: B2BEnquiryMessage[];
  nextCursor: string | null;
};

export type BusinessBuyerEnquiryStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "RESPONDED"
  | "NEGOTIATING"
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

export type B2BPaymentStatus =
  | "PENDING"
  | "SUBMITTED_FOR_VERIFICATION"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "REFUNDED"
  | "NOT_REQUIRED";

export type B2BPaymentMethod = "BANK_TRANSFER" | "MANUAL" | "RAZORPAY";
export type B2BProofStatus = "SUBMITTED" | "VERIFIED" | "REJECTED" | "RAZORPAY_FAILED";
export type B2BTransportMode = "STORE_PICKUP" | "SELLER_ARRANGED_TRANSPORT";
export type B2BTransportStatus =
  | "NOT_REQUIRED"
  | "REQUESTED"
  | "QUOTED"
  | "READY_FOR_PICKUP"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type B2BBankTransferDetails = {
  configured: boolean;
  accountHolderName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branch?: string | null;
  upiId?: string | null;
  instructions?: string | null;
  referenceRequired?: boolean;
};

export type B2BPaymentInstructions = {
  bankTransfer?: {
    enabled: boolean;
    configured: boolean;
    label?: string;
    note?: string;
    instructions?: string | null;
    bankTransferDetails?: B2BBankTransferDetails | null;
  } | null;
};

export type B2BPaymentProof = {
  id: string;
  b2bOrderId: string;
  method: B2BPaymentMethod;
  amountPaise: number;
  currency: string;
  overpaymentAmountPaise?: number;
  referenceNumber?: string | null;
  proofFileKey?: string | null;
  submittedByUserId: string;
  submittedAt?: string;
  status: B2BProofStatus;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  note?: string | null;
  reviewedBy?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

export type BusinessBuyerEnquiry = {
  id: string;
  businessBuyerId: string;
  productId?: string | null;
  sellerId?: string | null;
  quantity: number;
  message: string;
  transportMode?: B2BTransportMode;
  transportNote?: string | null;
  status: BusinessBuyerEnquiryStatus;
  createdAt?: string;
  updatedAt?: string;
  product?: B2BEnquiryProduct | null;
  seller?: SellerSummary | null;
  responses?: B2BEnquiryResponse[];
  messages?: B2BEnquiryMessagePage;
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
  taxInvoiceNumber?: string | null;
  taxInvoiceIssuedAt?: string | null;
  taxInvoiceFileKey?: string | null;
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
  proformaInvoiceFileKey?: string | null;
  paymentStatus?: B2BPaymentStatus;
  paymentMethod?: B2BPaymentMethod | null;
  buyerPayableAmountPaise?: number | null;
  transportMode?: B2BTransportMode;
  transportStatus?: B2BTransportStatus;
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
  paymentOverdueAt?: string | null;
  paymentVerifiedAt?: string | null;
  fulfilmentUnlockedAt?: string | null;
  termsSnapshot?: unknown;
  createdAt?: string;
  updatedAt?: string;
  businessBuyer?: BusinessBuyerProfile | null;
  product?: B2BEnquiryProduct | null;
  seller?: SellerSummary | null;
  selectedResponse?: B2BEnquiryResponse | null;
  enquiry?: BusinessBuyerEnquiry | null;
  events?: B2BOrderEvent[];
  paymentProofs?: B2BPaymentProof[];
  paymentInstructions?: B2BPaymentInstructions;
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
  transportMode?: B2BTransportMode | undefined;
  transportNote?: string | undefined;
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

export function getBusinessBuyerEnquiryDetail(
  auth: IndihubAuthHeaders,
  enquiryId: string,
  query: { messageCursor?: string; messageLimit?: number } = {}
) {
  return indihubFetch<BusinessBuyerEnquiry>(
    `/api/b2b/enquiries/${encodeURIComponent(enquiryId)}${queryString(query)}`,
    undefined,
    auth
  );
}

export function sendBusinessBuyerB2BMessage(auth: IndihubAuthHeaders, enquiryId: string, message: string) {
  return indihubFetch<B2BEnquiryMessage>(
    `/api/b2b/enquiries/${encodeURIComponent(enquiryId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    },
    auth
  );
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

export function confirmBusinessBuyerEnquiry(auth: IndihubAuthHeaders, enquiryId: string, responseId?: string) {
  return indihubFetch<BusinessBuyerEnquiry>(
    `/api/b2b/enquiries/${encodeURIComponent(enquiryId)}/confirm`,
    {
      method: "PATCH",
      body: JSON.stringify(responseId ? { responseId } : {})
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

export type B2BPaymentProofPayload = {
  method: "BANK_TRANSFER";
  amountPaise: number;
  currency: string;
  referenceNumber: string;
  proofFileKey: string;
};

export function submitBusinessBuyerPaymentProof(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: B2BPaymentProofPayload,
) {
  return indihubFetch<B2BOrder>(
    `/api/b2b/orders/${encodeURIComponent(orderNumber)}/payment-proof`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
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
