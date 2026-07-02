import type { CustomerAddress } from "@/lib/account-api";
import type { ServiceBookingPayload, ServiceQuery, ServiceVisitMode } from "@/lib/service-marketplace-api";

export type ManualServiceAddressInput = {
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  countryCode?: string | null;
};

export type ServiceBookingDraftInput = {
  serviceSlug: string;
  visitMode: ServiceVisitMode;
  customerIssue: string;
  selectedPackageId?: string | null;
  scheduledStartAt?: string | null;
  customerNote?: string | null;
  selectedAddress?: CustomerAddress | null;
  manualAddress?: ManualServiceAddressInput | null;
};

export function buildCustomerServiceBookingPayload(input: ServiceBookingDraftInput): ServiceBookingPayload {
  const payload: ServiceBookingPayload = {
    serviceSlug: input.serviceSlug,
    visitMode: input.visitMode,
    customerIssue: input.customerIssue.trim(),
  };

  const selectedPackageId = input.selectedPackageId?.trim();
  const scheduledStartAt = input.scheduledStartAt?.trim();
  const customerNote = input.customerNote?.trim();

  if (selectedPackageId) {
    payload.servicePackageId = selectedPackageId;
  }
  if (scheduledStartAt) {
    payload.scheduledStartAt = new Date(scheduledStartAt).toISOString();
  }
  if (customerNote) {
    payload.customerNote = customerNote;
  }

  if (input.visitMode !== "CUSTOMER_LOCATION") {
    return payload;
  }

  if (input.selectedAddress?.id) {
    payload.addressId = input.selectedAddress.id;
    return payload;
  }

  payload.addressSnapshot = cleanManualServiceAddress(input.manualAddress);
  return payload;
}

export function cleanManualServiceAddress(input: ManualServiceAddressInput | null | undefined) {
  return {
    city: cleanText(input?.city),
    state: cleanText(input?.state),
    pincode: cleanText(input?.pincode),
    countryCode: cleanText(input?.countryCode) || "IN",
  };
}

export function serviceLocationQueryFromAddress(address: CustomerAddress | null | undefined): ServiceQuery {
  if (!address) {
    return {};
  }
  const query: ServiceQuery = {};
  const latitude = numericLocation(address.latitude);
  const longitude = numericLocation(address.longitude);
  if (address.countryCode?.trim()) query.countryCode = address.countryCode;
  if (address.stateCode?.trim()) query.stateCode = address.stateCode;
  if (address.cityCode?.trim()) query.cityCode = address.cityCode;
  if (address.localAreaCode?.trim()) query.localAreaCode = address.localAreaCode;
  if (address.pincode?.trim()) query.pincode = address.pincode;
  if (latitude !== undefined) query.latitude = latitude;
  if (longitude !== undefined) query.longitude = longitude;
  return query;
}

export function serviceLocationQueryFromManualAddress(input: ManualServiceAddressInput | null | undefined): ServiceQuery {
  const pincode = cleanText(input?.pincode);
  const countryCode = cleanText(input?.countryCode) || "IN";
  if (!pincode) {
    return {};
  }
  return { countryCode, pincode };
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function numericLocation(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
