import {
  apiBaseUrl,
  buildAuthHeaders,
  indihubFetch,
  IndihubApiError,
  type IndihubAuthHeaders,
} from "./api";

export type PageResult<T> = { items: T[]; total: number };

export type DeliveryMode =
  | "LOCAL_DELIVERY_PARTNER"
  | "THIRD_PARTY_COURIER"
  | "STORE_PICKUP"
  | "MANUAL_TRANSPORT";

export type PackageStatus =
  | "PACKING_PENDING"
  | "READY_FOR_BOOKING"
  | "BOOKING_PENDING"
  | "BOOKED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RTO_INITIATED"
  | "RTO_IN_TRANSIT"
  | "RTO_DELIVERED"
  | "CANCELLED"
  | "FAILED";

export type CourierTrackingStatus =
  | "NOT_BOOKED"
  | "BOOKING_PENDING"
  | "BOOKED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RTO_INITIATED"
  | "RTO_IN_TRANSIT"
  | "RTO_DELIVERED"
  | "CANCELLED"
  | "FAILED";

export type DeliveryAssignmentStatus = "UNASSIGNED" | "ASSIGNED" | "ACCEPTED" | "REJECTED";
export type CourierProviderMode = "MANUAL" | "SANDBOX" | "LIVE";
export type CourierCodRemittanceStatus = "PENDING" | "COURIER_COLLECTED" | "REMITTED" | "VERIFIED" | "DISPUTED" | "REJECTED";

export type CourierDashboard = {
  generatedAt: string;
  metrics: Record<
    | "pendingBookings"
    | "bookingFailures"
    | "labelReady"
    | "pickupScheduled"
    | "inTransit"
    | "delivered"
    | "routingFailures"
    | "localDeliveryPending"
    | "courierCodPending"
    | "activeProviders",
    number
  >;
};

export type CourierProviderRecord = {
  id: string;
  providerCode: string;
  displayName: string;
  mode: CourierProviderMode;
  isActive: boolean;
  serviceableCountryCodes: string[];
  credentialsConfigured: boolean;
  webhookSecretConfigured: boolean;
  settingsSnapshot?: Record<string, unknown> | null;
  notes?: string | null;
};

export type CourierPackageRecord = {
  id: string;
  packageNumber: string;
  deliveryMode: DeliveryMode;
  status: PackageStatus;
  weightGrams?: number | null;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
  declaredValuePaise: number;
  shippingPaise: number;
  codSurchargePaise: number;
  order: {
    id: string;
    orderNumber: string;
    paymentStatus: string;
    deliveryStatus: string;
    shippingAddressSnapshot?: unknown;
    createdAt: string;
  };
  seller: {
    id: string;
    storeName: string;
    sellerType: string;
  };
  orderShipment: CourierShipmentRecord;
  latestCourierPackage?: {
    id: string;
    awbNumber?: string | null;
    courierName?: string | null;
    courierCode?: string | null;
    trackingStatus: CourierTrackingStatus;
    trackingStatusLabel?: string | null;
    trackingUrl?: string | null;
    labelUrl?: string | null;
    bookedAt?: string | null;
    pickupScheduledAt?: string | null;
    courierConsignment?: {
      id: string;
      providerCode: string;
      consignmentNumber: string;
      trackingStatus?: CourierTrackingStatus | null;
      bookingError?: string | null;
      pickupLocationName?: string | null;
    };
  } | null;
  courierTrackingStatus: CourierTrackingStatus;
  awbNumber?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  trackingUrl?: string | null;
  canBookCourier: boolean;
  canDownloadLabel: boolean;
  labelDownloadUrl?: string | null;
};

export type CourierShipmentRecord = {
  id: string;
  shipmentNumber: string;
  deliveryMode: DeliveryMode;
  status: string;
  assignmentStatus?: DeliveryAssignmentStatus | null;
  routingFailed?: boolean;
  routingFailureReason?: string | null;
  routingFailureNote?: string | null;
  routingFirstFailedAt?: string | null;
  routingPermanentFailureAt?: string | null;
  courierProviderCode?: string | null;
  deliveryPartnerUserId?: string | null;
  assignmentNote?: string | null;
  order: {
    id: string;
    orderNumber: string;
    paymentStatus: string;
    deliveryStatus: string;
    shippingAddressSnapshot?: unknown;
  };
  seller: {
    id: string;
    storeName: string;
    sellerType: string;
  };
  deliveryPartner?: {
    id: string;
    email: string;
    fullName?: string | null;
    phone?: string | null;
  } | null;
  firstPackage?: CourierPackageRecord | null;
  packageCount: number;
};

export type DeliveryPartnerOption = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  status?: string;
  deliveryProfile?: CourierDeliveryPartnerProfile | null;
};

export type CourierDeliveryPartnerProfile = {
  phone?: string | null;
  vehicleNumber?: string | null;
  isAvailable: boolean;
  priority: number;
  serviceCountryCode?: string | null;
  serviceStateCode?: string | null;
  serviceCityCode?: string | null;
  servicePincodes: string[];
  serviceLocalAreaCodes: string[];
  baseLatitude?: string | null;
  baseLongitude?: string | null;
  serviceRadiusKm?: number | null;
  codCashLimitPaise?: number | null;
  effectiveCodCashLimitPaise: number;
  notes?: string | null;
};

export type CourierDeliveryPartnerRecord = DeliveryPartnerOption & {
  status: string;
  deliveryProfile: CourierDeliveryPartnerProfile;
  activeWorkload: number;
  pendingCodCashPaise: number;
  hasProfile: boolean;
  hasServiceCoverage: boolean;
  codLimitExceeded: boolean;
  assignmentReady: boolean;
  readinessReasons: string[];
};

export type CourierDeliveryPartnerPayload = {
  phone?: string;
  vehicleNumber?: string;
  isAvailable?: boolean;
  priority?: number;
  serviceCountryCode?: string;
  serviceStateCode?: string;
  serviceCityCode?: string;
  servicePincodes?: string[];
  serviceLocalAreaCodes?: string[];
  baseLatitude?: number;
  baseLongitude?: number;
  serviceRadiusKm?: number;
  codCashLimitPaise?: number;
  notes?: string;
};

export type CourierCodRemittance = {
  id: string;
  providerCode: string;
  awbNumber?: string | null;
  expectedAmountPaise: number;
  collectedAmountPaise?: number | null;
  remittedAmountPaise?: number | null;
  remittanceReference?: string | null;
  reportReference?: string | null;
  status: CourierCodRemittanceStatus;
  notes?: string | null;
  order: { id?: string; orderNumber: string; paymentStatus: string; deliveryStatus?: string; totalPaise?: number; currency?: string };
  orderShipment: { id?: string; shipmentNumber: string };
  seller?: { id?: string; storeName: string } | null;
};

export type LocalDeliveryResult = PageResult<CourierShipmentRecord> & { partners: DeliveryPartnerOption[] };

export type CourierProviderPayload = {
  providerCode: string;
  displayName: string;
  mode?: CourierProviderMode;
  isActive?: boolean;
  serviceableCountryCodes?: string[];
  adapterCode?: string;
  apiBaseUrl?: string;
  bookingEndpointPath?: string;
  trackingEndpointPath?: string;
  labelEndpointPath?: string;
  cancellationEndpointPath?: string;
  accountCode?: string;
  username?: string;
  apiKey?: string;
  apiSecret?: string;
  password?: string;
  webhookSecret?: string;
  defaultPackageWeightGrams?: number;
  defaultPackageLengthCm?: number;
  defaultPackageBreadthCm?: number;
  defaultPackageHeightCm?: number;
  credentialsConfigured?: boolean;
  webhookSecretConfigured?: boolean;
  notes?: string;
};

export type BookCourierPackagePayload = {
  providerCode: string;
  awbNumber?: string;
  providerOrderId?: string;
  labelUrl?: string;
  trackingUrl?: string;
  note?: string;
};

export type UpdateCourierTrackingPayload = {
  trackingStatus: CourierTrackingStatus;
  trackingStatusLabel?: string;
  note?: string;
};

export function getCourierDashboard(auth: IndihubAuthHeaders) {
  return indihubFetch<CourierDashboard>("/api/courier/dashboard", undefined, auth);
}

export function listCourierPackages(auth: IndihubAuthHeaders, query: CourierQuery = {}) {
  return indihubFetch<PageResult<CourierPackageRecord>>(`/api/courier/packages${queryString(query)}`, undefined, auth);
}

export function getCourierPackage(auth: IndihubAuthHeaders, packageId: string) {
  return indihubFetch<CourierPackageRecord>(`/api/courier/packages/${encodeURIComponent(packageId)}`, undefined, auth);
}

export function bookCourierPackage(auth: IndihubAuthHeaders, packageId: string, payload: BookCourierPackagePayload) {
  return indihubFetch<CourierPackageRecord>(
    `/api/courier/packages/${encodeURIComponent(packageId)}/book`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateCourierPackageTracking(auth: IndihubAuthHeaders, packageId: string, payload: UpdateCourierTrackingPayload) {
  return indihubFetch<CourierPackageRecord>(
    `/api/courier/packages/${encodeURIComponent(packageId)}/tracking`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function listCourierRoutingFailures(auth: IndihubAuthHeaders, query: CourierQuery = {}) {
  return indihubFetch<PageResult<CourierShipmentRecord>>(`/api/courier/routing-failures${queryString(query)}`, undefined, auth);
}

export function overrideCourierRoutingFailure(auth: IndihubAuthHeaders, shipmentId: string, payload: Record<string, unknown>) {
  return indihubFetch<PageResult<CourierPackageRecord>>(
    `/api/courier/routing-failures/${encodeURIComponent(shipmentId)}/override`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function listCourierLocalDelivery(auth: IndihubAuthHeaders, query: CourierQuery = {}) {
  return indihubFetch<LocalDeliveryResult>(`/api/courier/local-delivery${queryString(query)}`, undefined, auth);
}

export function assignCourierLocalDelivery(auth: IndihubAuthHeaders, shipmentId: string, payload: Record<string, unknown>) {
  return indihubFetch<PageResult<CourierPackageRecord>>(
    `/api/courier/local-delivery/${encodeURIComponent(shipmentId)}/assign`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function listCourierDeliveryPartners(auth: IndihubAuthHeaders, query: CourierQuery = {}) {
  return indihubFetch<PageResult<CourierDeliveryPartnerRecord>>(
    `/api/courier/delivery-partners${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getCourierDeliveryPartner(auth: IndihubAuthHeaders, userId: string) {
  return indihubFetch<CourierDeliveryPartnerRecord>(
    `/api/courier/delivery-partners/${encodeURIComponent(userId)}`,
    undefined,
    auth,
  );
}

export function updateCourierDeliveryPartnerProfile(
  auth: IndihubAuthHeaders,
  userId: string,
  payload: CourierDeliveryPartnerPayload,
) {
  return indihubFetch<CourierDeliveryPartnerRecord>(
    `/api/courier/delivery-partners/${encodeURIComponent(userId)}/profile`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateCourierDeliveryPartnerAvailability(
  auth: IndihubAuthHeaders,
  userId: string,
  isAvailable: boolean,
  note?: string,
) {
  return indihubFetch<CourierDeliveryPartnerRecord>(
    `/api/courier/delivery-partners/${encodeURIComponent(userId)}/availability`,
    {
      method: "PATCH",
      body: JSON.stringify({
        isAvailable,
        ...(note?.trim() ? { note: note.trim() } : {}),
      }),
    },
    auth,
  );
}

export function listCourierProviders(auth: IndihubAuthHeaders) {
  return indihubFetch<{ items: CourierProviderRecord[] }>("/api/courier/providers", undefined, auth);
}

export function saveCourierProvider(auth: IndihubAuthHeaders, payload: CourierProviderPayload) {
  return indihubFetch<CourierProviderRecord>("/api/courier/providers", {
    method: "POST",
    body: JSON.stringify(payload),
  }, auth);
}

export function patchCourierProvider(auth: IndihubAuthHeaders, providerCode: string, payload: CourierProviderPayload) {
  return indihubFetch<CourierProviderRecord>(
    `/api/courier/providers/${encodeURIComponent(providerCode)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function updateCourierProviderActive(auth: IndihubAuthHeaders, providerCode: string, isActive: boolean) {
  return indihubFetch<CourierProviderRecord>(
    `/api/courier/providers/${encodeURIComponent(providerCode)}/active`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
    auth,
  );
}

export function listCourierCodRemittances(auth: IndihubAuthHeaders, query: CourierQuery = {}) {
  return indihubFetch<PageResult<CourierCodRemittance>>(`/api/courier/cod-remittances${queryString(query)}`, undefined, auth);
}

export function recordCourierCodRemittance(auth: IndihubAuthHeaders, payload: Record<string, unknown>) {
  return indihubFetch<unknown>("/api/courier/cod-remittances", {
    method: "POST",
    body: JSON.stringify(payload),
  }, auth);
}

export async function fetchCourierPackageLabel(auth: IndihubAuthHeaders, labelDownloadUrl: string) {
  const response = await fetch(`${apiBaseUrl}${labelDownloadUrl}`, {
    headers: await buildAuthHeaders(auth, { skipCache: true }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new IndihubApiError("Courier label could not be downloaded.", response.status);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = /filename="([^"]+)"/i.exec(disposition);
  return {
    blob: await response.blob(),
    fileName: fileNameMatch?.[1] ?? "courier-label.pdf",
  };
}

type CourierQuery = Record<string, string | number | boolean | undefined>;

function queryString(query: CourierQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}
