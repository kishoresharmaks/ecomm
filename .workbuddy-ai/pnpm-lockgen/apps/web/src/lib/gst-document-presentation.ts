import type { GstBuyerAddress } from "./gst-report-api";

export function formatGstAddress(address: GstBuyerAddress | null | undefined) {
  if (!address) {
    return "Not recorded";
  }

  return [
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ") || "Not recorded";
}

export function humanizeGstValue(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
