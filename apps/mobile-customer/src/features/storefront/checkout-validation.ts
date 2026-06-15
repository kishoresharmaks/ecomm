import type { MobileCartSummary, MobileCustomerAddressPayload } from "./storefront-api";

const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,63}$/;
const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;
const INDIAN_PINCODE_PATTERN = /^\d{6}$/;
const INTERNATIONAL_PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,24}$/;
const CUSTOMER_NOTE_MAX_LENGTH = 500;
const LOCATION_SOURCES = new Set(["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"]);

export function cleanMobileCustomerAddressForm(
  form: MobileCustomerAddressPayload,
  options: { isDefaultFallback?: boolean } = {},
) {
  const countryCode = cleanSingleLineText(form.countryCode).toUpperCase() || "IN";
  const fullName = cleanSingleLineText(form.fullName);
  const phone = countryCode === "IN" ? normalizeIndianPhoneNumber(form.phone) : cleanSingleLineText(form.phone);
  const line1 = cleanSingleLineText(form.line1);
  const city = cleanSingleLineText(form.city);
  const state = cleanSingleLineText(form.state);
  const pincode = countryCode === "IN" ? form.pincode.replace(/\D/g, "") : cleanSingleLineText(form.pincode);

  if (!fullName || !phone || !line1 || !city || !state || (countryCode === "IN" && !pincode)) {
    throw new Error("Fill name, phone, address, city, state, and pincode.");
  }
  if (countryCode === "IN" && !INDIAN_PHONE_PATTERN.test(phone)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }
  if (countryCode !== "IN" && !INTERNATIONAL_PHONE_PATTERN.test(phone)) {
    throw new Error("Enter a valid phone number.");
  }
  if (countryCode === "IN" && !INDIAN_PINCODE_PATTERN.test(pincode)) {
    throw new Error("Enter a valid 6-digit pincode.");
  }

  const latitude = finiteNumberOrNull(form.latitude);
  const longitude = finiteNumberOrNull(form.longitude);
  const accuracyMeters = finiteNumberOrNull(form.accuracyMeters);
  const locationConfidenceScore = finiteNumberOrNull(form.locationConfidenceScore);
  const locationSource = cleanLocationSource(form.locationSource);
  const isDefault =
    typeof form.isDefault === "boolean"
      ? form.isDefault
      : typeof options.isDefaultFallback === "boolean"
        ? options.isDefaultFallback
        : undefined;

  return {
    fullName,
    phone,
    line1,
    city,
    state,
    pincode,
    label: cleanSingleLineText(form.label) || "Home",
    country: cleanSingleLineText(form.country) || "India",
    countryCode,
    ...(typeof isDefault === "boolean" ? { isDefault } : {}),
    ...(cleanSingleLineText(form.area) ? { area: cleanSingleLineText(form.area) } : {}),
    ...(cleanSingleLineText(form.line2) ? { line2: cleanSingleLineText(form.line2) } : {}),
    ...(cleanSingleLineText(form.stateCode) ? { stateCode: cleanSingleLineText(form.stateCode) } : {}),
    ...(cleanSingleLineText(form.cityCode) ? { cityCode: cleanSingleLineText(form.cityCode) } : {}),
    ...(cleanSingleLineText(form.localAreaCode) ? { localAreaCode: cleanSingleLineText(form.localAreaCode) } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(locationSource !== undefined ? { locationSource } : {}),
    ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
    ...(locationConfidenceScore !== undefined ? { locationConfidenceScore } : {}),
  };
}

export const cleanCheckoutAddressForm = cleanMobileCustomerAddressForm;

export function calculateLocationConfidenceScore(accuracyMeters: number | null | undefined) {
  const accuracy = typeof accuracyMeters === "number" && Number.isFinite(accuracyMeters) ? Math.max(0, accuracyMeters) : 100;
  return clamp(Math.round(100 * (1 - Math.min(accuracy, 100) / 100)), 0, 100);
}

export function cleanCheckoutPaymentReference(value: string, options: { required?: boolean } = {}) {
  const reference = cleanSingleLineText(value);
  if (!reference) {
    if (options.required) {
      throw new Error("Enter the bank transfer reference or UTR.");
    }

    return null;
  }

  if (!PAYMENT_REFERENCE_PATTERN.test(reference)) {
    throw new Error("Enter a valid payment reference using 4-64 letters, numbers, spaces, slash, dot, hyphen, or underscore.");
  }

  return reference;
}

export function cleanCheckoutCustomerNote(value: string) {
  const note = cleanMultilineText(value);
  if (!note) {
    return null;
  }
  if (note.length > CUSTOMER_NOTE_MAX_LENGTH) {
    throw new Error(`Delivery note must be ${CUSTOMER_NOTE_MAX_LENGTH} characters or less.`);
  }
  if (/[<>]/.test(note)) {
    throw new Error("Delivery note cannot contain HTML characters.");
  }

  return note;
}

export function assertCheckoutCartReady(latestCart: MobileCartSummary, visibleCart?: MobileCartSummary | null) {
  if (!latestCart.items.length) {
    throw new Error("Cart is empty.");
  }

  const stockIssue = latestCart.items.find((item) => {
    const variant = item.productVariant;
    if (!variant) {
      return true;
    }

    const status = variant.status?.trim().toUpperCase();
    const stockQuantity = variant.stockQuantity;
    return status === "INACTIVE" || status === "ARCHIVED" || (typeof stockQuantity === "number" && item.quantity > stockQuantity);
  });

  if (stockIssue) {
    const productName = stockIssue.productVariant?.product?.name ?? "one cart item";
    throw new Error(`${productName} is no longer available in the selected quantity. Please review your cart.`);
  }

  if (visibleCart && checkoutCartSignature(visibleCart) !== checkoutCartSignature(latestCart)) {
    throw new Error("Cart changed while checking out. Review your cart and try again.");
  }
}

export function checkoutCartSignature(cart: MobileCartSummary) {
  return cart.items
    .map((item) => {
      const variant = item.productVariant;
      return [
        item.id,
        item.quantity,
        item.unitPricePaise ?? variant?.pricePaise ?? 0,
        variant?.id ?? "",
        variant?.status ?? "",
        variant?.stockQuantity ?? "",
      ].join(":");
    })
    .sort()
    .join("|");
}

function normalizeIndianPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  return digits;
}

function finiteNumberOrNull(value: number | null | string | undefined) {
  if (value === null) {
    return null;
  }

  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanLocationSource(value: string | null | undefined) {
  const source = cleanSingleLineText(value).toUpperCase();
  if (!source) {
    return undefined;
  }

  return LOCATION_SOURCES.has(source) ? source : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanSingleLineText(value: string | null | undefined) {
  return replaceControlCharacters(String(value ?? ""), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMultilineText(value: string | null | undefined) {
  return replaceControlCharacters(String(value ?? ""), " ", { keepNewlines: true })
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function replaceControlCharacters(value: string, replacement: string, options: { keepNewlines?: boolean } = {}) {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (options.keepNewlines && char === "\n") {
        return char;
      }
      return code < 32 || code === 127 ? replacement : char;
    })
    .join("");
}
