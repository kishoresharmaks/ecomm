export type SellerReportType = "sales" | "inventory" | "finance" | "returns";
export type SellerReportPeriod = "month" | "7d" | "30d" | "90d" | "all";

const REPORT_PATHS: Record<SellerReportType | "tax", string> = {
  sales: "/seller/reports/sales",
  inventory: "/seller/reports/inventory",
  finance: "/seller/reports/finance",
  returns: "/seller/reports/returns",
  tax: "/seller/reports/tax",
};

export function sellerReportDateQuery(period: SellerReportPeriod, now = new Date()) {
  if (period === "all") return {};
  const dateTo = localDate(now);
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "month") {
    dateFrom.setDate(1);
  } else {
    dateFrom.setDate(dateFrom.getDate() - Number(period.slice(0, -1)) + 1);
  }
  return { dateFrom: localDate(dateFrom), dateTo };
}

export function sellerPortalReportUrl(type: SellerReportType | "tax") {
  const base = process.env.EXPO_PUBLIC_SELLER_PORTAL_URL?.trim() || "https://1handindia.com";
  return `${base.replace(/\/+$/, "")}${REPORT_PATHS[type]}`;
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
