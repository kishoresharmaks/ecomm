import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type ReturnRequestStatus =
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
  | "CANCELLED";

export type ReturnRequestItemStatus =
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
  | "CLOSED";

export type ReturnRequestResolution = "REFUND" | "REPLACEMENT" | "PARTIAL_REFUND" | "REJECTED";

export type RefundRequestStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "INITIATED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "RETRY_PENDING"
  | "CANCELLED";

export type RefundMethod = "RAZORPAY" | "COD_CASH" | "BANK_TRANSFER" | "UPI" | "MANUAL";

export type ReverseShipmentStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "FAILED"
  | "CANCELLED";

export type DeliveryAssignmentStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED";

export type ReturnAddressSnapshot = {
  fullName?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CursorPage<T> = {
  items: T[];
  limit: number;
  pageInfo?: {
    hasNextPage: boolean;
    nextCursor?: string | null;
  };
};

export type ReturnSummary = {
  id: string;
  requestNumber: string;
  status: ReturnRequestStatus;
  resolution: ReturnRequestResolution;
  reason: string;
  totalQuantity: number;
  requestedAmountPaise: number;
  approvedAmountPaise: number;
  currency: string;
  createdAt?: string;
  order: {
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    deliveryStatus: string;
  };
  customerName?: string | null;
  customerEmail?: string | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    status: ReturnRequestItemStatus;
    sellerId: string;
    sellerName: string;
  }>;
};

export type ReturnDetail = Omit<ReturnSummary, "items"> & {
  note?: string | null;
  autoApproved?: boolean;
  couponAdjustmentPaise?: number;
  requestedAt?: string;
  reviewedAt?: string | null;
  customer?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  pickupAddress?: ReturnAddressSnapshot | null;
  items: Array<
    {
      id: string;
      orderItemId: string;
      productName: string;
      product?: { id: string; name: string; slug: string } | null;
      seller?: { id: string; storeName: string; slug: string };
      sellerId?: string;
      sellerName?: string;
      variantSnapshot?: string | null;
      quantity: number;
      status: ReturnRequestItemStatus;
      resolution: ReturnRequestResolution;
      reason: string;
      requestedRefundPaise: number;
      approvedRefundPaise: number;
      couponAdjustmentPaise: number;
      qcNote?: string | null;
      sellerNote?: string | null;
    }
  >;
  reverseShipments: Array<{
    id: string;
    sellerId: string;
    mode: "PLATFORM_PICKUP" | "CUSTOMER_SELF_SHIP";
    status: ReverseShipmentStatus;
    assignmentStatus?: DeliveryAssignmentStatus;
    awbNumber?: string | null;
    courierName?: string | null;
    trackingReference?: string | null;
    proofReference?: string | null;
    pickupProofReference?: string | null;
    receiptProofReference?: string | null;
    pickupNote?: string | null;
    receivedByName?: string | null;
    assignedAt?: string | null;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
    assignmentExpiresAt?: string | null;
    assignmentNote?: string | null;
    pickedUpAt?: string | null;
    receivedAt?: string | null;
    seller?: {
      id: string;
      storeName: string;
      slug: string;
      contactName?: string | null;
      contactPhone?: string | null;
      destinationAddress?: ReturnAddressSnapshot | null;
    };
    assignedPartner?: { id: string; fullName?: string | null; phone?: string | null } | null;
    events?: Array<{
      id: string;
      oldStatus?: ReverseShipmentStatus | null;
      newStatus: ReverseShipmentStatus;
      note?: string | null;
      createdAt?: string;
    }>;
    assignmentAttempts?: Array<{
      id: string;
      source: string;
      status: DeliveryAssignmentStatus;
      note?: string | null;
      respondedAt?: string | null;
      createdAt?: string;
      partner?: { id: string; fullName?: string | null; email?: string | null; phone?: string | null };
      assignedBy?: { id: string; fullName?: string | null; email?: string | null } | null;
    }>;
  }>;
  refunds: Array<{
    id: string;
    refundNumber: string;
    status: RefundRequestStatus;
    amountPaise: number;
    currency: string;
    createdAt?: string;
  }>;
  notes: Array<{
    id: string;
    note: string;
    sellerId?: string | null;
    createdAt?: string;
    createdBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  }>;
};

export type RefundSummary = {
  id: string;
  refundNumber: string;
  status: RefundRequestStatus;
  reason: string;
  method?: RefundMethod | null;
  amountPaise: number;
  currency: string;
  createdAt?: string;
  orderNumber: string;
  paymentStatus: string;
  customerName?: string | null;
  customerEmail?: string | null;
};

export type RefundDetail = RefundSummary & {
  note?: string | null;
  couponAdjustmentPaise: number;
  sellerFundedCouponAdjustmentPaise: number;
  platformFundedCouponAdjustmentPaise: number;
  approvedAt?: string | null;
  reviewedAt?: string | null;
  order: {
    id: string;
    orderNumber: string;
    paymentStatus: string;
    totalPaise: number;
    currency: string;
    createdAt?: string;
  };
  customer: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  payment?: {
    id: string;
    provider: string;
    status: string;
    providerPaymentId?: string | null;
  } | null;
  returnRequest?: {
    requestNumber: string;
    status: ReturnRequestStatus;
    resolution: ReturnRequestResolution;
  } | null;
  items: Array<{
    id: string;
    orderItemId: string;
    productName: string;
    seller?: { id: string; storeName: string; slug: string };
    quantity: number;
    amountPaise: number;
    couponAdjustmentPaise: number;
    sellerFundedCouponAdjustmentPaise: number;
    platformFundedCouponAdjustmentPaise: number;
    returnRequestItem?: { id: string; status: ReturnRequestItemStatus } | null;
  }>;
  transactions: Array<{
    id: string;
    provider: string;
    providerRefundId?: string | null;
    status: string;
    amountPaise: number;
    currency: string;
    idempotencyKey?: string | null;
    errorMessage?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

export type ReturnListQuery = {
  status?: ReturnRequestStatus | "";
  assignmentStatus?: DeliveryAssignmentStatus | "";
  search?: string;
  limit?: number;
  cursor?: string | null;
};

export type RefundListQuery = {
  status?: RefundRequestStatus | "";
  search?: string;
  limit?: number;
  cursor?: string | null;
};

export function listAdminReturns(auth: IndihubAuthHeaders, query: ReturnListQuery = {}) {
  return indihubFetch<CursorPage<ReturnSummary>>(`/api/admin/returns${queryString(query)}`, undefined, auth);
}

export function getAdminReturn(auth: IndihubAuthHeaders, requestNumber: string) {
  return indihubFetch<ReturnDetail>(`/api/admin/returns/${encodeURIComponent(requestNumber)}`, undefined, auth);
}

export function listAdminReturnPickups(auth: IndihubAuthHeaders, query: ReturnListQuery = {}) {
  return indihubFetch<CursorPage<ReturnSummary>>(`/api/admin/returns/pickups${queryString(query)}`, undefined, auth);
}

export function updateAdminReturnStatus(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  payload: { status: ReturnRequestStatus; note?: string },
) {
  return indihubFetch<ReturnDetail>(
    `/api/admin/returns/${encodeURIComponent(requestNumber)}/status`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function recordAdminReturnQc(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  payload: { status: "QC_PASSED" | "QC_FAILED"; note?: string },
) {
  return indihubFetch<ReturnDetail>(
    `/api/admin/returns/${encodeURIComponent(requestNumber)}/qc`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function autoAssignAdminReversePickup(auth: IndihubAuthHeaders, requestNumber: string) {
  return indihubFetch<ReturnDetail>(
    `/api/admin/returns/${encodeURIComponent(requestNumber)}/reverse-pickup/auto-assign`,
    { method: "POST" },
    auth,
  );
}

export function updateAdminReversePickupAssignment(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  payload: { deliveryPartnerUserId?: string | null; assignmentNote?: string },
) {
  return indihubFetch<ReturnDetail>(
    `/api/admin/returns/${encodeURIComponent(requestNumber)}/reverse-pickup/assignment`,
    { method: "PATCH", body: JSON.stringify(removeEmptyValues(payload)) },
    auth,
  );
}

export function releaseAdminReversePickupAssignment(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  payload: { note?: string } = {},
) {
  return indihubFetch<ReturnDetail>(
    `/api/admin/returns/${encodeURIComponent(requestNumber)}/reverse-pickup/release`,
    { method: "POST", body: JSON.stringify(removeEmptyValues(payload)) },
    auth,
  );
}

export function listSellerReturns(auth: IndihubAuthHeaders, query: ReturnListQuery = {}) {
  return indihubFetch<CursorPage<ReturnSummary>>(`/api/seller/returns${queryString(query)}`, undefined, auth);
}

export function getSellerReturn(auth: IndihubAuthHeaders, requestNumber: string) {
  return indihubFetch<ReturnDetail>(`/api/seller/returns/${encodeURIComponent(requestNumber)}`, undefined, auth);
}

export function addSellerReturnNote(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  payload: { note: string },
) {
  return indihubFetch<ReturnDetail>(
    `/api/seller/returns/${encodeURIComponent(requestNumber)}/notes`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function listDeliveryReturns(auth: IndihubAuthHeaders, query: ReturnListQuery = {}) {
  return indihubFetch<CursorPage<ReturnDetail>>(`/api/delivery/returns${queryString(query)}`, undefined, auth);
}

export function getDeliveryReturn(auth: IndihubAuthHeaders, requestNumber: string) {
  return indihubFetch<ReturnDetail>(`/api/delivery/returns/${encodeURIComponent(requestNumber)}`, undefined, auth);
}

export function acceptDeliveryReturnPickup(auth: IndihubAuthHeaders, requestNumber: string, payload: { note?: string } = {}) {
  return indihubFetch<ReturnDetail>(
    `/api/delivery/returns/${encodeURIComponent(requestNumber)}/accept`,
    { method: "POST", body: JSON.stringify(removeEmptyValues(payload)) },
    auth,
  );
}

export function rejectDeliveryReturnPickup(auth: IndihubAuthHeaders, requestNumber: string, payload: { note?: string } = {}) {
  return indihubFetch<ReturnDetail>(
    `/api/delivery/returns/${encodeURIComponent(requestNumber)}/reject`,
    { method: "POST", body: JSON.stringify(removeEmptyValues(payload)) },
    auth,
  );
}

export function updateDeliveryReturnPickup(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  payload: {
    status: ReverseShipmentStatus;
    awbNumber?: string;
    courierName?: string;
    trackingReference?: string;
    proofReference?: string;
    pickupProofReference?: string;
    receiptProofReference?: string;
    receivedByName?: string;
    note?: string;
  },
) {
  return indihubFetch<ReturnDetail>(
    `/api/delivery/returns/${encodeURIComponent(requestNumber)}/pickup`,
    { method: "PATCH", body: JSON.stringify(removeEmptyValues(payload)) },
    auth,
  );
}

export function recordDeliveryReturnShipmentReceipt(
  auth: IndihubAuthHeaders,
  requestNumber: string,
  shipmentId: string,
  payload: {
    status?: ReverseShipmentStatus;
    proofReference?: string;
    receiptProofReference?: string;
    receivedByName: string;
    note?: string;
  },
) {
  return indihubFetch<ReturnDetail>(
    `/api/delivery/returns/${encodeURIComponent(requestNumber)}/shipments/${encodeURIComponent(shipmentId)}/receipt`,
    { method: "PATCH", body: JSON.stringify(removeEmptyValues({ status: "RECEIVED", ...payload })) },
    auth,
  );
}

export function listAdminRefunds(auth: IndihubAuthHeaders, query: RefundListQuery = {}) {
  return indihubFetch<CursorPage<RefundSummary>>(`/api/admin/refunds${queryString(query)}`, undefined, auth);
}

export function getAdminRefund(auth: IndihubAuthHeaders, refundNumber: string) {
  return indihubFetch<RefundDetail>(`/api/admin/refunds/${encodeURIComponent(refundNumber)}`, undefined, auth);
}

export function approveAdminRefund(auth: IndihubAuthHeaders, refundNumber: string, payload: { note?: string }) {
  return indihubFetch<RefundDetail>(
    `/api/admin/refunds/${encodeURIComponent(refundNumber)}/approve`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function initiateAdminRefund(
  auth: IndihubAuthHeaders,
  refundNumber: string,
  payload: { method?: RefundMethod; note?: string },
) {
  return indihubFetch<RefundDetail>(
    `/api/admin/refunds/${encodeURIComponent(refundNumber)}/initiate`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function retryAdminRefund(
  auth: IndihubAuthHeaders,
  refundNumber: string,
  payload: { method?: RefundMethod; note?: string },
) {
  return indihubFetch<RefundDetail>(
    `/api/admin/refunds/${encodeURIComponent(refundNumber)}/retry`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function recordManualAdminRefund(
  auth: IndihubAuthHeaders,
  refundNumber: string,
  payload: { method: RefundMethod; manualReference: string; paidAt: string; note?: string },
) {
  return indihubFetch<RefundDetail>(
    `/api/admin/refunds/${encodeURIComponent(refundNumber)}/manual-record`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

function queryString(query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.size ? `?${params.toString()}` : "";
}

function removeEmptyValues<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  );
}
