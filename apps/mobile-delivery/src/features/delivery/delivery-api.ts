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
  orderKind?: "STANDARD" | "REPLACEMENT";
  parentOrder?: {
    id: string;
    orderNumber: string;
    orderStatus?: string;
    deliveryStatus?: string;
  } | null;
  replacementReturnRequest?: {
    id: string;
    requestNumber: string;
    status?: string;
    resolution?: string;
  } | null;
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
  shipments?: DeliveryOrderShipment[];
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
  countryCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationSource?: string | null;
  accuracyMeters?: number | string | null;
  locationConfidenceScore?: number | string | null;
};

export type DeliveryPickupAddress = {
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  locationSource?: string | null;
  accuracyMeters?: number | string | null;
  locationConfidenceScore?: number | string | null;
};

export type DeliveryOrderShipment = {
  id: string;
  shipmentNumber: string;
  sellerId: string;
  seller?: {
    id?: string;
    storeName?: string | null;
    slug?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    pickupAddress?: DeliveryPickupAddress | null;
  } | null;
  subtotalPaise: number;
  shippingPaise: number;
  codSurchargePaise: number;
  deliveryMode: string;
  status: string;
  assignmentStatus?: string | null;
  assignmentExpiresAt?: string | null;
  deliveryPartnerUserId?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  trackingReference?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveryNote?: string | null;
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
    baseLatitude?: string | null;
    baseLongitude?: string | null;
    serviceRadiusKm?: number | null;
    notes?: string | null;
    effectiveCodCashLimitPaise?: number | null;
    razorpayVirtualUpiId?: string | null;
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
    phone?: string | null;
    vehicleNumber?: string | null;
    isAvailable?: boolean;
    servicePincodes?: string[];
    serviceLocalAreaCodes?: string[];
    baseLatitude?: number;
    baseLongitude?: number;
    serviceRadiusKm?: number;
    notes?: string | null;
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

export function sellerToCustomerDistanceLabel(order?: DeliveryOrder | null) {
  const distances = sellerToCustomerDistancesKm(order);
  if (distances.length === 0) return null;
  const min = Math.min(...distances);
  const max = Math.max(...distances);
  if (distances.length === 1 || Math.abs(max - min) < 0.05) {
    return `Approx seller to customer: ${formatDistanceKm(min)}`;
  }
  return `Approx seller to customer: ${formatDistanceKm(min)}-${formatDistanceKm(max)}`;
}

export function sellerToCustomerDistancesKm(order?: DeliveryOrder | null) {
  const destination = coordinatesFromSnapshot(order?.shippingAddressSnapshot);
  if (!destination) return [];
  const seenSellerIds = new Set<string>();
  return (order?.shipments ?? [])
    .flatMap((shipment) => {
      const sellerKey = shipment.seller?.id ?? shipment.sellerId ?? shipment.id;
      if (seenSellerIds.has(sellerKey)) return [];
      seenSellerIds.add(sellerKey);
      const origin = coordinatesFromSnapshot(shipment.seller?.pickupAddress);
      return origin ? [roundDistanceKm(haversineKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude))] : [];
    })
    .sort((left, right) => left - right);
}

export function addressLine(address?: AddressSnapshot | null) {
  return [address?.line1, address?.area, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ");
}

function coordinatesFromSnapshot(address?: AddressSnapshot | DeliveryPickupAddress | null) {
  const latitude = Number(address?.latitude);
  const longitude = Number(address?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function haversineKm(originLatitude: number, originLongitude: number, destinationLatitude: number, destinationLongitude: number) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destinationLatitude - originLatitude);
  const longitudeDelta = toRadians(destinationLongitude - originLongitude);
  const originLatitudeRadians = toRadians(originLatitude);
  const destinationLatitudeRadians = toRadians(destinationLatitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitudeRadians) *
      Math.cos(destinationLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function roundDistanceKm(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDistanceKm(value: number) {
  return `${value.toFixed(1)} km`;
}
