// B2B buyer TypeScript types for apps/mobile-customer.
// Mirrors web/src/lib/business-buyer-api.ts — keep in sync with backend DTOs.

export type BusinessBuyerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "UNDER_REVIEW";

export type B2BEnquiryStatus =
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
  status: BusinessBuyerStatus;
  user?: BusinessBuyerUser | null;
  addresses: BusinessBuyerAddress[];
  createdAt?: string;
  updatedAt?: string;
};

export type BusinessBuyerProfilePayload = {
  companyName: string;
  gstNumber?: string;
  contactName: string;
  contactPhone: string;
};

export type BusinessBuyerAddressPayload = {
  line1: string;
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

export type B2BEnquirySellerSummary = {
  id: string;
  storeName?: string | null;
  slug?: string | null;
};

export type B2BEnquiryProduct = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
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

export type B2BEnquiryMessage = {
  id: string;
  enquiryId: string;
  senderUserId: string;
  message: string;
  createdAt?: string;
  updatedAt?: string;
  sending?: boolean;
  failed?: boolean;
  sender?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

export type B2BEnquiryMessagePage = {
  items: B2BEnquiryMessage[];
  nextCursor: string | null;
};

export type BusinessBuyerEnquiry = {
  id: string;
  businessBuyerId: string;
  productId?: string | null;
  sellerId?: string | null;
  quantity: number;
  message: string;
  status: B2BEnquiryStatus;
  createdAt?: string;
  updatedAt?: string;
  product?: B2BEnquiryProduct | null;
  seller?: B2BEnquirySellerSummary | null;
  responses?: B2BEnquiryResponse[];
  messages?: B2BEnquiryMessagePage;
  b2bOrder?: { id: string; orderNumber: string } | null;
};

export type B2BOrderEvent = {
  id: string;
  status: B2BOrderStatus;
  note?: string | null;
  createdAt?: string;
  actor?: { email?: string | null; fullName?: string | null } | null;
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
  commissionRateBps?: number;
  commissionAmountPaise?: number;
  sellerPayoutAmountPaise?: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  businessBuyer?: BusinessBuyerProfile | null;
  product?: B2BEnquiryProduct | null;
  seller?: B2BEnquirySellerSummary | null;
  selectedResponse?: B2BEnquiryResponse | null;
  enquiry?: BusinessBuyerEnquiry | null;
  events?: B2BOrderEvent[];
};

export type PaginatedB2BEnquiries = {
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
  idempotencyKey?: string;
  productId?: string;
  sellerId?: string;
  quantity: number;
  message: string;
};

export type BusinessBuyerPurchaseOrderPayload = {
  purchaseOrderNumber: string;
  purchaseOrderFileKey?: string;
  note?: string;
};

export type POUploadRequestResponse = {
  /** Present when backend storage is S3-compatible. Preferred upload path. */
  presignedUrl?: string | null;
  /** Present when backend storage is local/multipart fallback. */
  uploadUrl?: string | null;
  assetKey: string;
  expiresAt?: string | null;
};

export type POUploadRequestPayload = {
  contentType: string;
  fileName: string;
  sizeBytes: number;
};

export type PODocumentAccessResponse = {
  url?: string | null;
  assetKey?: string | null;
  expiresAt?: string | null;
};
