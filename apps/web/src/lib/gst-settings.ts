import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type GstSettings = {
  platform: {
    legalName: string;
    gstin: string;
    stateCode: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      postalCode: string;
      country: "India";
    };
  };
  eInvoice: {
    enabled: boolean;
    provider: "MANUAL";
  };
  eWayBill: {
    enabled: boolean;
    provider: "MANUAL";
    thresholdPaise: number;
  };
};

export function getAdminGstSettings(auth: IndihubAuthHeaders) {
  return indihubFetch<GstSettings>("/api/admin/settings/gst", undefined, auth);
}

export function saveAdminGstSettings(
  auth: IndihubAuthHeaders,
  settings: GstSettings,
) {
  return indihubFetch<GstSettings>(
    "/api/admin/settings/gst",
    { method: "PUT", body: JSON.stringify(settings) },
    auth,
  );
}

export function paiseToRupeesInput(paise: number) {
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}

export function rupeesToPaise(value: string) {
  const rupees = Number(value);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  const paise = Math.round(rupees * 100);
  return Number.isSafeInteger(paise) && paise <= 2_147_483_647 ? paise : null;
}

export function gstSettingsValidationError(settings: GstSettings) {
  const { platform } = settings;
  if (platform.legalName.trim().length < 2) return "Enter the platform registered legal name.";
  const gstin = platform.gstin.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return "Enter a valid 15-character platform GSTIN.";
  }
  if (!/^[0-9]{2}$/.test(platform.stateCode.trim())) {
    return "Enter the two-digit GST state code.";
  }
  if (gstin.slice(0, 2) !== platform.stateCode.trim()) {
    return "The GSTIN state prefix must match the GST state code.";
  }
  if (
    !platform.address.line1.trim() ||
    !platform.address.city.trim() ||
    !platform.address.state.trim()
  ) {
    return "Complete the platform registered address.";
  }
  if (!/^[0-9]{6}$/.test(platform.address.postalCode.trim())) {
    return "Enter a valid six-digit postal code.";
  }
  if (
    !Number.isInteger(settings.eWayBill.thresholdPaise) ||
    settings.eWayBill.thresholdPaise < 0
  ) {
    return "Enter a valid non-negative e-way bill threshold.";
  }
  return null;
}
