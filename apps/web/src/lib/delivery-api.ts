import { indihubFetch, type IndihubAuthHeaders } from "@/lib/api";

export type DeliveryOrderPage = {
  items: DeliveryOrder[];
  total: number;
  page: number;
  limit: number;
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
    id: string;
    storeName: string;
    slug: string;
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

export type DeliveryOrder = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalPaise: number;
  currency: string;
  buyerTotalMinor?: number | null;
  buyerCurrency?: string | null;
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
    locationSource?: string | null;
    accuracyMeters?: number | string | null;
    locationConfidenceScore?: number | string | null;
  } | null;
  customer?: {
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  };
  items?: Array<{
    id: string;
    productNameSnapshot: string;
    quantity: number;
    seller?: {
      id: string;
      storeName: string;
      slug: string;
    } | null;
  }>;
  shipments?: DeliveryOrderShipment[];
  payments?: Array<{
    id: string;
    provider: string;
    method?: string | null;
    amountPaise: number;
    currency: string;
    status: string;
  }>;
  deliveryDetail?: {
    id: string;
    deliveryMode: string;
    partnerName?: string | null;
    partnerPhone?: string | null;
    deliveryPartnerUserId?: string | null;
    deliveryPartner?: {
      id: string;
      email?: string | null;
      phone?: string | null;
      fullName?: string | null;
      deliveryProfile?: DeliveryPartnerProfile | null;
    } | null;
    assignmentStatus?: string | null;
    assignedAt?: string | null;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
    assignmentExpiresAt?: string | null;
    assignmentNote?: string | null;
    trackingReference?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    receiverName?: string | null;
    proofNote?: string | null;
    proofReference?: string | null;
    status: string;
    codCollectionStatus?: string | null;
    codCollectedAmountPaise?: number | null;
    codCollectedAt?: string | null;
    codCollectionNote?: string | null;
    codVerifiedAt?: string | null;
    codVerificationNote?: string | null;
    codCollectedBy?: {
      id: string;
      email?: string | null;
      phone?: string | null;
      fullName?: string | null;
    } | null;
    codVerifiedBy?: {
      id: string;
      email?: string | null;
      phone?: string | null;
      fullName?: string | null;
    } | null;
    events?: Array<{
      id: string;
      oldStatus?: string | null;
      newStatus: string;
      note?: string | null;
      createdAt?: string;
    }>;
    attempts?: DeliveryAttempt[];
  } | null;
  statusEvents?: Array<{
    id: string;
    statusType: string;
    oldStatus?: string | null;
    newStatus: string;
    note?: string | null;
    createdAt?: string;
  }>;
};

export type DeliveryUpdatePayload = {
  status?: string | undefined;
  trackingReference?: string | undefined;
  estimatedDeliveryDate?: string | undefined;
  deliveryNote?: string | undefined;
  receiverName?: string | undefined;
  proofNote?: string | undefined;
  proofReference?: string | undefined;
  codCollected?: boolean | undefined;
  codCollectedAmountPaise?: number | undefined;
  codCollectionNote?: string | undefined;
};

export type DeliveryPartnerProfile = {
  phone?: string | null;
  vehicleNumber?: string | null;
  isAvailable?: boolean;
  serviceCountryCode?: string | null;
  serviceStateCode?: string | null;
  serviceCityCode?: string | null;
  servicePincodes?: string[];
  serviceLocalAreaCodes?: string[];
  codCashLimitPaise?: number | null;
  effectiveCodCashLimitPaise?: number | null;
  notes?: string | null;
};

export type DeliveryPartnerProfileAccount = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  status: string;
  deliveryProfile: DeliveryPartnerProfile;
  activeWorkload: number;
  pendingCodCashPaise: number;
  wallet?: DeliveryPartnerWalletSummary;
};

export type DeliveryPartnerWalletSummary = {
  totalEarnedPaise: number;
  totalCreditedPaise: number;
  totalDebitedPaise: number;
  ledgerBalancePaise?: number;
  pendingPayoutPaise?: number;
  activePayoutRequestCount?: number;
  availableBalancePaise: number;
  localDeliveryCount: number;
  currency: string;
  minimumPayoutPaise?: number;
  payoutRequestsEnabled?: boolean;
  canRequestPayout?: boolean;
  payoutSettings?: DeliveryPartnerPayoutSettings;
};

export type DeliveryPartnerPayoutSettings = {
  minimumPerOrderPaise: number;
  basePayPaise: number;
  perKmPaise: number;
  codBonusPaise: number;
  minimumWalletPayoutPaise: number;
  requestsEnabled: boolean;
  freeDeliveryPlatformSubsidyEnabled: boolean;
};

export type DeliveryPartnerWalletEntry = {
  id: string;
  entryType: string;
  direction: "CREDIT" | "DEBIT";
  amountPaise: number;
  currency: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  order?: {
    orderNumber: string;
    paymentStatus: string;
    deliveryStatus: string;
  } | null;
  shipment?: {
    shipmentNumber: string;
    deliveryMode: string;
    status: string;
    shippingPaise: number;
  } | null;
};

export type DeliveryPartnerPayout = {
  id: string;
  payoutNumber: string;
  partnerUserId: string;
  amountPaise: number;
  currency: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";
  note?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  paymentMode?: string | null;
  transactionReference?: string | null;
  createdAt?: string | null;
};

export type DeliveryPartnerWallet = {
  summary: DeliveryPartnerWalletSummary;
  items: DeliveryPartnerWalletEntry[];
  payouts?: DeliveryPartnerPayout[];
  total: number;
  page: number;
  limit: number;
};

export type DeliveryPartnerProfileUpdatePayload = {
  phone?: string | undefined;
  vehicleNumber?: string | undefined;
  isAvailable?: boolean | undefined;
  serviceCountryCode?: string | undefined;
  serviceStateCode?: string | undefined;
  serviceCityCode?: string | undefined;
  servicePincodes?: string[] | undefined;
  serviceLocalAreaCodes?: string[] | undefined;
  notes?: string | undefined;
};

export type DeliveryAttempt = {
  id: string;
  reason: string;
  note?: string | null;
  attemptedAt?: string | null;
  nextAttemptDate?: string | null;
  createdAt?: string | null;
  createdBy?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  } | null;
};

export type DeliveryAssignmentDecisionPayload = {
  decision: "ACCEPT" | "REJECT";
  note?: string | undefined;
};

export type DeliveryAttemptPayload = {
  reason: string;
  note?: string | undefined;
  attemptedAt?: string | undefined;
  nextAttemptDate?: string | undefined;
};

export function listDeliveryOrders(
  auth: IndihubAuthHeaders,
  query: {
    search?: string;
    deliveryStatus?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  return indihubFetch<DeliveryOrderPage>(
    `/api/delivery/orders${params.size ? `?${params.toString()}` : ""}`,
    undefined,
    auth,
  );
}

export function getDeliveryOrder(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<DeliveryOrder>(
    `/api/delivery/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function updateDeliveryOrder(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: DeliveryUpdatePayload,
) {
  return indihubFetch<DeliveryOrder>(
    `/api/delivery/orders/${encodeURIComponent(orderNumber)}/delivery`,
    {
      method: "PATCH",
      body: JSON.stringify(removeEmptyValues(payload)),
    },
    auth,
  );
}

export function respondDeliveryAssignment(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: DeliveryAssignmentDecisionPayload,
) {
  return indihubFetch<DeliveryOrder>(
    `/api/delivery/orders/${encodeURIComponent(orderNumber)}/assignment`,
    {
      method: "PATCH",
      body: JSON.stringify(removeEmptyValues(payload)),
    },
    auth,
  );
}

export function createDeliveryAttempt(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: DeliveryAttemptPayload,
) {
  return indihubFetch<DeliveryOrder>(
    `/api/delivery/orders/${encodeURIComponent(orderNumber)}/attempts`,
    {
      method: "POST",
      body: JSON.stringify(removeEmptyValues(payload)),
    },
    auth,
  );
}

export function getDeliveryProfile(auth: IndihubAuthHeaders) {
  return indihubFetch<DeliveryPartnerProfileAccount>("/api/delivery/profile", undefined, auth);
}

export function getDeliveryWallet(
  auth: IndihubAuthHeaders,
  query: { page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  return indihubFetch<DeliveryPartnerWallet>(
    `/api/delivery/wallet${params.size ? `?${params.toString()}` : ""}`,
    undefined,
    auth,
  );
}

export function requestDeliveryWalletPayout(auth: IndihubAuthHeaders, payload: { note?: string }) {
  return indihubFetch<DeliveryPartnerPayout>(
    "/api/delivery/wallet/payout-requests",
    {
      method: "POST",
      body: JSON.stringify(removeEmptyValues(payload)),
    },
    auth,
  );
}

export function updateDeliveryProfile(
  auth: IndihubAuthHeaders,
  payload: DeliveryPartnerProfileUpdatePayload,
) {
  return indihubFetch<DeliveryPartnerProfileAccount>(
    "/api/delivery/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

function removeEmptyValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, entry === "" ? undefined : entry]),
  );
}
