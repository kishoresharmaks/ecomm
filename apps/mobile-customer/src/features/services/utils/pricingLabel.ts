import type { MobileServiceListing, MobileServicePackage } from "../types";

export function formatPaise(valuePaise?: number | null, currency = "INR") {
  const amount = Math.max(0, valuePaise ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

export function getPricingLabel(service: MobileServiceListing, selectedPackage?: MobileServicePackage | null): string {
  if (selectedPackage?.pricePaise !== null && selectedPackage?.pricePaise !== undefined) {
    return formatPaise(selectedPackage.pricePaise, service.currency);
  }

  switch (service.pricingModel) {
    case "fixed_price":
      return service.basePricePaise !== null ? formatPaise(service.basePricePaise, service.currency) : "Price unavailable";
    case "quote_first":
      return "Price on quote";
    case "inspection_fee":
      return service.inspectionFeePaise !== null
        ? `Inspection: ${formatPaise(service.inspectionFeePaise, service.currency)}`
        : "Inspection fee applies";
  }
}
