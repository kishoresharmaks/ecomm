import type { StatusTone } from "@indihub/ui";
import type { AdminLocationServiceabilitySummary } from "@/lib/location-api";

export type AdminLocationServiceabilityPaymentMethod = "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";

export type AdminLocationServiceabilityQuery = {
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  pincode?: string;
  localAreaCode?: string;
  subtotalPaise?: number;
  paymentMethod?: AdminLocationServiceabilityPaymentMethod;
};

export function buildAdminLocationServiceabilityPath(query: AdminLocationServiceabilityQuery) {
  const params = new URLSearchParams();
  setParam(params, "countryCode", query.countryCode || "IN");
  setParam(params, "stateCode", query.stateCode);
  setParam(params, "cityCode", query.cityCode);
  setParam(params, "pincode", query.pincode);
  setParam(params, "localAreaCode", query.localAreaCode);
  setParam(params, "paymentMethod", query.paymentMethod || "COD");
  if (typeof query.subtotalPaise === "number" && Number.isFinite(query.subtotalPaise)) {
    params.set("subtotalPaise", String(Math.max(0, Math.round(query.subtotalPaise))));
  }

  return `/api/admin/locations/serviceability?${params.toString()}`;
}

export function serviceabilityTone(status: AdminLocationServiceabilitySummary["status"]): StatusTone {
  if (status === "READY") {
    return "success";
  }

  if (status === "PARTIAL") {
    return "warning";
  }

  return "danger";
}

export function serviceabilityLabel(status: AdminLocationServiceabilitySummary["status"]) {
  return status.replaceAll("_", " ");
}

function setParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const cleaned = value?.trim();
  if (cleaned) {
    params.set(key, cleaned);
  }
}
