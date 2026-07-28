export type SellerReportType = "sales" | "inventory" | "finance" | "returns";
export type SellerReportPeriod = "today" | "month" | "7d" | "30d" | "90d" | "all";

const REPORT_PATHS: Record<SellerReportType | "tax", string> = {
  sales: "/seller/reports/sales",
  inventory: "/seller/reports/inventory",
  finance: "/seller/reports/finance",
  returns: "/seller/reports/returns",
  tax: "/seller/reports/tax",
};

export function sellerReportDateQuery(period: SellerReportPeriod, now = new Date()) {
  if (period === "all") return {};
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (period === "today") {
    return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
  }
  if (period === "month") {
    dateFrom.setDate(1);
  } else {
    dateFrom.setDate(dateFrom.getDate() - Number(period.slice(0, -1)) + 1);
  }
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

export function sellerPortalReportUrl(type: SellerReportType | "tax") {
  return sellerPortalUrl(REPORT_PATHS[type]);
}

export function sellerPortalUrl(path: string) {
  const base = process.env.EXPO_PUBLIC_SELLER_PORTAL_URL?.trim() || "https://1handindia.com";
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
