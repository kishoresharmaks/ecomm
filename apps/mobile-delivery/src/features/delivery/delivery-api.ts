import { compactPayload, getJson, patchJson, postJson, type MobileAuthHeaders } from "../../lib/api";

export type PageResult<T> = {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
};

export type DeliveryStatus =
  | "NOT_ASSIGNED"
  | "PENDING"
  | "PACKED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type DeliveryAttemptReason =
  | "CUSTOMER_NOT_REACHABLE"
  | "ADDRESS_ISSUE"
  | "RESCHEDULED"
  | "REFUSED_DELIVERY"
  | "FAILED_ATTEMPT"
  | "OTHER";

export type DeliveryOrder = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: DeliveryStatus;
  totalPaise: number;
  currency: string;
  buyerTotalMinor?: number | null;
  buyerCurrency?: string | null;
  createdAt?: string;
  customer?: { email?: string | null; phone?: string | null; fullName?: string | null };
  shippingAddressSnapshot?: AddressSnapshot | null;
  items?: Array<{ id: string; productNameSnapshot: string; quantity: number }>;
  payments?: Array<{ id: string; provider: string; method?: string | null; amountPaise: number; currency: string; status: string }>;
  deliveryDetail?: {
    id: string;
    assignmentStatus?: "UNASSIGNED" | "ASSIGNED" | "ACCEPTED" | "REJECTED" | "CANCELLED" | null;
    status: DeliveryStatus;
    trackingReference?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    receiverName?: string | null;
    proofNote?: string | null;
    proofReference?: string | null;
    codCollectionStatus?: "NOT_COLLECTED" | "COLLECTED" | "VERIFIED" | "REJECTED" | null;
    codCollectedAmountPaise?: number | null;
    codCollectedAt?: string | null;
    codCollectionNote?: string | null;
    attempts?: DeliveryAttempt[];
    events?: Array<{ id: string; oldStatus?: string | null; newStatus: string; note?: string | null; createdAt?: string }>;
  } | null;
  statusEvents?: Array<{ id: string; statusType: string; oldStatus?: string | null; newStatus: string; note?: string | null; createdAt?: string }>;
};

export type AddressSnapshot = {
  fullName?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

export type DeliveryAttempt = {
  id: string;
  reason: DeliveryAttemptReason;
  note?: string | null;
  attemptedAt?: string | null;
  nextAttemptDate?: string | null;
  createdAt?: string | null;
};

export type DeliveryProfile = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  status: string;
  activeWorkload: number;
  pendingCodCashPaise: number;
  deliveryProfile: {
    phone?: string | null;
    vehicleNumber?: string | null;
    isAvailable?: boolean;
    servicePincodes?: string[];
    serviceLocalAreaCodes?: string[];
    notes?: string | null;
    effectiveCodCashLimitPaise?: number | null;
  };
  wallet?: DeliveryWalletSummary;
};

export type DeliveryWalletSummary = {
  totalEarnedPaise: number;
  totalCreditedPaise: number;
  totalDebitedPaise: number;
  availableBalancePaise: number;
  pendingPayoutPaise?: number;
  activePayoutRequestCount?: number;
  localDeliveryCount: number;
  minimumPayoutPaise?: number;
  payoutRequestsEnabled?: boolean;
  canRequestPayout?: boolean;
  currency: string;
};

export type DeliveryWalletEntry = {
  id: string;
  entryType: string;
  direction: "CREDIT" | "DEBIT";
  amountPaise: number;
  currency: string;
  description?: string | null;
  createdAt: string;
  order?: { orderNumber: string; paymentStatus: string; deliveryStatus: string } | null;
};

export type DeliveryPayout = {
  id: string;
  payoutNumber: string;
  amountPaise: number;
  currency: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";
  note?: string | null;
  paymentMode?: string | null;
  transactionReference?: string | null;
  createdAt?: string | null;
  requestedAt?: string | null;
};

export type DeliveryWallet = {
  summary: DeliveryWalletSummary;
  items: DeliveryWalletEntry[];
  payouts?: DeliveryPayout[];
  total: number;
  page: number;
  limit: number;
};

export type DeliveryPartnerApplicationMe = {
  application: { status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"; reviewNote?: string | null } | null;
  isDeliveryPartner: boolean;
};

export type DeliveryUpdatePayload = {
  status?: DeliveryStatus;
  trackingReference?: string | undefined;
  estimatedDeliveryDate?: string | undefined;
  deliveryNote?: string | undefined;
  receiverName?: string | undefined;
  proofNote?: string | undefined;
  proofReference?: string | undefined;
  codCollected?: boolean;
  codCollectedAmountPaise?: number | undefined;
  codCollectionNote?: string | undefined;
};

export function getDeliveryAccess(auth: MobileAuthHeaders) {
  return getJson<DeliveryPartnerApplicationMe>({ path: "/delivery-partner-applications/me", auth });
}

export function listDeliveryOrders(
  auth: MobileAuthHeaders,
  query: { search?: string; deliveryStatus?: string; paymentStatus?: string; page?: number; limit?: number } = {},
) {
  return getJson<PageResult<DeliveryOrder>>({ path: "/delivery/orders", auth, searchParams: query });
}

export function getDeliveryOrder(auth: MobileAuthHeaders, orderNumber: string) {
  return getJson<DeliveryOrder>({ path: `/delivery/orders/${encodeURIComponent(orderNumber)}`, auth });
}

export function respondDeliveryAssignment(auth: MobileAuthHeaders, orderNumber: string, decision: "ACCEPT" | "REJECT", note?: string) {
  return patchJson<DeliveryOrder>({
    path: `/delivery/orders/${encodeURIComponent(orderNumber)}/assignment`,
    auth,
    body: compactPayload({ decision, note }),
  });
}

export function updateDeliveryOrder(auth: MobileAuthHeaders, orderNumber: string, payload: DeliveryUpdatePayload) {
  return patchJson<DeliveryOrder>({
    path: `/delivery/orders/${encodeURIComponent(orderNumber)}/delivery`,
    auth,
    body: compactPayload(payload),
  });
}

export function createDeliveryAttempt(
  auth: MobileAuthHeaders,
  orderNumber: string,
  payload: { reason: DeliveryAttemptReason; note?: string | undefined; nextAttemptDate?: string | undefined },
) {
  return postJson<DeliveryOrder>({
    path: `/delivery/orders/${encodeURIComponent(orderNumber)}/attempts`,
    auth,
    body: compactPayload(payload),
  });
}

export function getDeliveryProfile(auth: MobileAuthHeaders) {
  return getJson<DeliveryProfile>({ path: "/delivery/profile", auth });
}

export function updateDeliveryProfile(
  auth: MobileAuthHeaders,
  payload: {
    phone?: string;
    vehicleNumber?: string;
    isAvailable?: boolean;
    servicePincodes?: string[];
    serviceLocalAreaCodes?: string[];
    notes?: string;
  },
) {
  return patchJson<DeliveryProfile>({ path: "/delivery/profile", auth, body: compactPayload(payload) });
}

export function getDeliveryWallet(auth: MobileAuthHeaders, query: { page?: number; limit?: number } = {}) {
  return getJson<DeliveryWallet>({ path: "/delivery/wallet", auth, searchParams: query });
}

export function requestDeliveryWalletPayout(auth: MobileAuthHeaders, note?: string) {
  return postJson<DeliveryPayout>({
    path: "/delivery/wallet/payout-requests",
    auth,
    body: compactPayload({ note }),
  });
}

export function findCodPayment(order?: DeliveryOrder | null) {
  return order?.payments?.find((payment) => payment.provider === "COD" || payment.method === "COD") ?? null;
}

export function addressLine(address?: AddressSnapshot | null) {
  return [address?.line1, address?.area, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ");
}
