"use client";

import { ReportExportCenter } from "@/components/reporting/report-export-center";
import type { ReportExportType } from "@/lib/report-exports-api";
import { SellerAuthNotice, useSellerAuth } from "./seller-ui";

const sellerReportTypes: Array<{ value: ReportExportType; label: string }> = [
  { value: "SELLER_SALES", label: "Sales and revenue" },
  { value: "SELLER_INVENTORY", label: "Inventory and stock" },
  { value: "SELLER_FINANCE", label: "Finance and settlements" },
  { value: "SELLER_TAX", label: "Tax and deductions" },
  { value: "SELLER_RETURNS", label: "Returns and refunds" },
];

export function SellerReportExportsClient() {
  const sellerAuth = useSellerAuth();
  if (!sellerAuth.enabled) return <SellerAuthNotice />;
  return <ReportExportCenter auth={sellerAuth.authHeaders} audience="seller" reportTypes={sellerReportTypes} />;
}
