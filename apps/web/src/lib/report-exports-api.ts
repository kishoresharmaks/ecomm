import {
  apiBaseUrl,
  buildAuthHeaders,
  indihubFetch,
  type IndihubAuthHeaders,
} from "./api";

export type ReportExportAudience = "admin" | "finance" | "seller";
export type ReportExportStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";
export type ReportExportType =
  | "ADMIN_SALES"
  | "ADMIN_SELLERS"
  | "ADMIN_PRODUCTS"
  | "ADMIN_ENQUIRIES"
  | "FINANCE_PAYMENTS"
  | "FINANCE_COD_COLLECTIONS"
  | "FINANCE_ORDER_SETTLEMENTS"
  | "FINANCE_SERVICE_SETTLEMENTS"
  | "FINANCE_PAYOUTS"
  | "FINANCE_SERVICE_RECEIVABLES"
  | "SELLER_SALES"
  | "SELLER_INVENTORY"
  | "SELLER_FINANCE"
  | "SELLER_TAX"
  | "SELLER_RETURNS"
  | "GSTR1_REVIEW_SELLER_XLSX"
  | "GSTR1_REVIEW_ALL_SELLERS_ZIP"
  | "GSTR1_REVIEW_PLATFORM_XLSX";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: string;
  provider?: string;
  paymentStatus?: string;
  sellerId?: string;
  page?: number;
  limit?: number;
};

export type ReportPeriodPreset =
  | "THIS_MONTH"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "LAST_90_DAYS"
  | "ALL_TIME";

export type ReportTablePage = {
  headers: string[];
  moneyHeaders: string[];
  items: Array<Record<string, unknown>>;
  pageInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ReportExportJob = {
  id: string;
  audience: string;
  exportType: ReportExportType;
  status: ReportExportStatus;
  fileName?: string | null;
  contentType?: string | null;
  rowCount: number;
  byteSize: number;
  attempts: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  expiresAt?: string | null;
};

export type ReportExportPage = {
  items: ReportExportJob[];
  pageInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const exportBase: Record<ReportExportAudience, string> = {
  admin: "/api/admin/reports/exports",
  finance: "/api/admin/finance/report-exports",
  seller: "/api/seller/reports/exports",
};

export function reportPresetRange(preset: ReportPeriodPreset, now = new Date()) {
  if (preset === "ALL_TIME") return { dateFrom: "", dateTo: "" };
  const end = localDate(now);
  const start = new Date(now);
  if (preset === "THIS_MONTH") start.setDate(1);
  if (preset === "LAST_7_DAYS") start.setDate(start.getDate() - 6);
  if (preset === "LAST_30_DAYS") start.setDate(start.getDate() - 29);
  if (preset === "LAST_90_DAYS") start.setDate(start.getDate() - 89);
  return { dateFrom: localDate(start), dateTo: end };
}

export function reportQueryString(filters: ReportFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if ((key === "dateFrom" || key === "dateTo") && typeof value === "string" && value.length === 10) {
      const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
      const date = new Date(
        year,
        month - 1,
        day,
        key === "dateTo" ? 23 : 0,
        key === "dateTo" ? 59 : 0,
        key === "dateTo" ? 59 : 0,
        key === "dateTo" ? 999 : 0,
      );
      params.set(key, date.toISOString());
    } else {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getReportTable<T extends { table: ReportTablePage }>(
  auth: IndihubAuthHeaders,
  path: string,
  filters: ReportFilters,
) {
  return indihubFetch<T>(`${path}${reportQueryString(filters)}`, undefined, auth);
}

export function getFinanceReportTable(
  auth: IndihubAuthHeaders,
  exportType: ReportExportType,
  filters: ReportFilters,
) {
  return indihubFetch<ReportTablePage>(
    `/api/admin/finance/report-data/${exportType}${reportQueryString(filters)}`,
    undefined,
    auth,
  );
}

export function createReportExport(
  auth: IndihubAuthHeaders,
  audience: ReportExportAudience,
  exportType: ReportExportType,
  filters: ReportFilters = {},
) {
  const { page: _page, limit: _limit, ...exportFilters } = filters;
  const normalizedFilters = exportType.startsWith("GSTR1_REVIEW_")
    ? exportFilters
    : Object.fromEntries(
        new URLSearchParams(reportQueryString(exportFilters).slice(1)),
      );
  return indihubFetch<ReportExportJob>(
    exportBase[audience],
    {
      method: "POST",
      body: JSON.stringify({ exportType, ...normalizedFilters }),
    },
    auth,
  );
}

export function gstr1ReviewMonthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("Select a valid calendar month.");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 2000 || year > 2100 || monthNumber < 1 || monthNumber > 12) {
    throw new Error("Select a valid calendar month.");
  }
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    dateFrom: `${match[1]}-${match[2]}-01`,
    dateTo: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function gstr1ReviewQuarterRange(year: number, quarter: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Select a valid GST quarter year.");
  }
  if (![1, 2, 3, 4].includes(quarter)) {
    throw new Error("Select a valid GST quarter.");
  }
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    dateFrom: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function listReportExports(
  auth: IndihubAuthHeaders,
  audience: ReportExportAudience,
  filters: {
    page?: number;
    limit?: number;
    status?: ReportExportStatus | "";
    exportType?: ReportExportType | "";
  } = {},
) {
  return indihubFetch<ReportExportPage>(
    `${exportBase[audience]}${reportQueryString(filters)}`,
    undefined,
    auth,
  );
}

export function retryReportExport(
  auth: IndihubAuthHeaders,
  audience: ReportExportAudience,
  jobId: string,
) {
  return indihubFetch<ReportExportJob>(
    `${exportBase[audience]}/${encodeURIComponent(jobId)}/retry`,
    { method: "POST" },
    auth,
  );
}

export async function downloadReportExport(
  auth: IndihubAuthHeaders,
  audience: ReportExportAudience,
  job: Pick<ReportExportJob, "id" | "fileName">,
) {
  const path = `${exportBase[audience]}/${encodeURIComponent(job.id)}/download`;
  let response = await fetch(`${apiBaseUrl}${path}`, {
    headers: await buildAuthHeaders(auth),
  });
  if (response.status === 401 && auth.getBearerToken) {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: await buildAuthHeaders(auth, { skipCache: true }),
    });
  }
  if (!response.ok) {
    throw new Error("Unable to download this report export.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = job.fileName || "1handindia-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function localDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
