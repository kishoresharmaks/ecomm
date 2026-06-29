import { toBackendVisitMode } from "../mappers";
import type {
  BackendCreateServiceBookingPayload,
  MobileServiceAddressSnapshot,
  MobileServiceBookingFormValues,
} from "../types";

export function cleanBookingPayload(raw: MobileServiceBookingFormValues): BackendCreateServiceBookingPayload {
  const serviceSlug = requiredText(raw.serviceSlug, "Service is missing.");
  const customerIssue = requiredText(raw.customerIssue, "Describe the service issue.");
  if (customerIssue.length < 20) {
    throw new Error("Describe the issue in at least 20 characters.");
  }

  const payload: BackendCreateServiceBookingPayload = {
    serviceSlug,
    visitMode: toBackendVisitMode(raw.visitMode),
    customerIssue,
  };
  const idempotencyKey = raw.idempotencyKey?.trim();
  const servicePackageId = raw.selectedPackageId?.trim();
  const scheduledStartAt = combineDateAndTime(raw.preferredDate, raw.preferredTimeSlot);
  const customerNote = raw.customerNote?.trim();

  if (idempotencyKey) {
    payload.idempotencyKey = idempotencyKey;
  }
  if (servicePackageId) {
    payload.servicePackageId = servicePackageId;
  }
  if (scheduledStartAt) {
    payload.scheduledStartAt = scheduledStartAt;
  }
  if (customerNote) {
    payload.customerNote = customerNote;
  }

  if (raw.visitMode === "customer_location") {
    const savedAddressId = raw.savedAddressId?.trim();
    if (savedAddressId) {
      payload.addressId = savedAddressId;
      return payload;
    }
    payload.addressSnapshot = cleanAddressSnapshot(raw.addressSnapshot);
    return payload;
  }

  return payload;
}

export function cleanAddressSnapshot(raw: MobileServiceAddressSnapshot | null): MobileServiceAddressSnapshot {
  if (!raw) {
    throw new Error("Select or enter a service address.");
  }

  const snapshot: MobileServiceAddressSnapshot = {
    label: raw.label?.trim() || null,
    fullName: requiredText(raw.fullName, "Full name is required."),
    phone: requiredText(raw.phone, "Phone number is required."),
    line1: requiredText(raw.line1, "Address line 1 is required."),
    line2: raw.line2?.trim() || null,
    area: raw.area?.trim() || null,
    city: requiredText(raw.city, "City is required."),
    state: requiredText(raw.state, "State is required."),
    pincode: requiredText(raw.pincode, "Pincode is required."),
    country: requiredText(raw.country, "Country is required."),
    countryCode: requiredText(raw.countryCode, "Country code is required."),
    stateCode: raw.stateCode?.trim() || null,
    cityCode: raw.cityCode?.trim() || null,
    localAreaCode: raw.localAreaCode?.trim() || null,
    latitude: finiteNumberOrNull(raw.latitude),
    longitude: finiteNumberOrNull(raw.longitude),
  };

  return snapshot;
}

export function cleanCancellationPayload(raw: { reason: string }) {
  const reason = raw.reason.trim();
  if (reason.length < 5) {
    throw new Error("Cancellation reason must be at least 5 characters.");
  }
  return { reason };
}

export function cleanDisputePayload(raw: { selectedReason: string; description: string; rawEvidence: string }) {
  const selectedReason = requiredText(raw.selectedReason, "Select a dispute reason.");
  const description = raw.description.trim();
  const reason = description ? `${selectedReason} - ${description}` : selectedReason;
  if (reason.length < 5) {
    throw new Error("Dispute reason must be at least 5 characters.");
  }
  const evidence = raw.rawEvidence
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    reason,
    ...(evidence.length ? { evidence } : {}),
  };
}

export function cleanReviewPayload(raw: { rating: number; body?: string }) {
  if (!Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5) {
    throw new Error("Select a rating from 1 to 5 stars.");
  }
  const body = raw.body?.trim();
  return {
    rating: raw.rating,
    ...(body ? { body } : {}),
  };
}

function requiredText(value: string | null | undefined, message: string) {
  const text = value?.trim() ?? "";
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function combineDateAndTime(dateValue: string | null, timeSlot: string | null) {
  const date = dateValue?.trim();
  if (!date) {
    return undefined;
  }
  const time = timeSlot?.match(/\d{1,2}:\d{2}/)?.[0] ?? "09:00";
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Select a valid preferred date and time.");
  }
  return parsed.toISOString();
}

function finiteNumberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
