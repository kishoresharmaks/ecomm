import { indihubFetch, type IndihubAuthHeaders } from "@/lib/api";

export type DeliveryPartnerApplicationStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type DeliveryPartnerApplication = {
  id: string;
  userId: string;
  status: DeliveryPartnerApplicationStatus;
  fullName: string;
  email: string;
  phone: string;
  alternatePhone?: string | null;
  vehicleType: string;
  vehicleNumber: string;
  drivingLicenseNumber?: string | null;
  experienceSummary?: string | null;
  serviceCountryCode?: string | null;
  serviceStateCode?: string | null;
  serviceCityCode?: string | null;
  servicePincodes: string[];
  serviceLocalAreaCodes: string[];
  addressLine1: string;
  addressLine2?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string | null;
  accuracyMeters?: number | null;
  locationConfidenceScore?: number | null;
  serviceRadiusKm?: number | null;
  availabilityNotes?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    phone?: string | null;
    fullName?: string | null;
    status: string;
    roles: string[];
    hasDeliveryProfile: boolean;
  };
  reviewedBy?: {
    id: string;
    email: string;
    fullName?: string | null;
  } | null;
};

export type DeliveryPartnerApplicationMe = {
  application: DeliveryPartnerApplication | null;
  isDeliveryPartner: boolean;
  deliveryProfile?: unknown | null;
};

export type DeliveryPartnerApplicationPayload = {
  fullName: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  vehicleType: string;
  vehicleNumber: string;
  drivingLicenseNumber?: string;
  experienceSummary?: string;
  serviceCountryCode?: string;
  serviceStateCode?: string;
  serviceCityCode?: string;
  servicePincodes?: string[];
  serviceLocalAreaCodes?: string[];
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  locationSource?: "GPS" | "MAP_PICK" | "MANUAL" | "REVERSE_GEOCODE";
  accuracyMeters?: number;
  locationConfidenceScore?: number;
  serviceRadiusKm?: number;
  availabilityNotes?: string;
};

export type DeliveryPartnerApplicationPage = {
  items: DeliveryPartnerApplication[];
  total: number;
  page: number;
  limit: number;
};

export function getOwnDeliveryPartnerApplication(auth: IndihubAuthHeaders) {
  return indihubFetch<DeliveryPartnerApplicationMe>(
    "/api/delivery-partner-applications/me",
    undefined,
    auth,
  );
}

export function submitDeliveryPartnerApplication(
  auth: IndihubAuthHeaders,
  payload: DeliveryPartnerApplicationPayload,
) {
  return indihubFetch<DeliveryPartnerApplication>(
    "/api/delivery-partner-applications",
    {
      method: "POST",
      body: JSON.stringify(removeEmptyValues(payload)),
    },
    auth,
  );
}

export function listAdminDeliveryPartnerApplications(
  auth: IndihubAuthHeaders,
  query: { status?: string; search?: string; page?: number; limit?: number } = {},
) {
  return indihubFetch<DeliveryPartnerApplicationPage>(
    `/api/admin/delivery-partner-applications${queryString(query)}`,
    undefined,
    auth,
  );
}

export function decideAdminDeliveryPartnerApplication(
  auth: IndihubAuthHeaders,
  applicationId: string,
  payload: { decision: "APPROVE" | "REJECT"; note?: string; priority?: number; codCashLimitPaise?: number },
) {
  return indihubFetch<DeliveryPartnerApplication>(
    `/api/admin/delivery-partner-applications/${encodeURIComponent(applicationId)}/decision`,
    {
      method: "PATCH",
      body: JSON.stringify(removeEmptyValues(payload)),
    },
    auth,
  );
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

function removeEmptyValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) {
        return false;
      }
      if (typeof entry === "string" && !entry.trim()) {
        return false;
      }
      if (Array.isArray(entry) && entry.length === 0) {
        return false;
      }
      return true;
    }),
  );
}
