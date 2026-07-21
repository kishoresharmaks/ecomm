import type { GstReport } from "./gst-report-api";

export type SellerTaxRegime = "INDIA_GST" | "GENERIC";

export function sellerTaxRegime(countryCode?: string | null): SellerTaxRegime {
  return (countryCode?.trim().toUpperCase() || "IN") === "IN"
    ? "INDIA_GST"
    : "GENERIC";
}

export function hasApplicableEInvoiceDocuments(report?: GstReport) {
  return Boolean(
    report?.providerReadiness.eInvoice.enabled &&
      report.documents.some(
        (document) => document.compliance.eInvoiceStatus !== "NOT_REQUIRED",
      ),
  );
}

export function hasApplicableEWayBillDocuments(report?: GstReport) {
  return Boolean(
    report?.providerReadiness.eWayBill.enabled &&
      report.documents.some(
        (document) => document.compliance.eWayBillStatus !== "NOT_REQUIRED",
      ),
  );
}

export function hasB2BGstinActivity(report?: GstReport) {
  return Boolean(report?.gstinSummary.length);
}
