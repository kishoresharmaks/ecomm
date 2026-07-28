import type { IndihubAuthHeaders } from "./api";
import { indihubFetch } from "./api";
import { downloadAuthenticatedFile } from "./gst-report-api";

export type OrderTaxRegisterSource = "PRODUCT" | "SERVICE";
export type OrderTaxRegisterChannel = "B2C" | "B2B";
export type OrderTaxRegisterDateBasis =
  | "DOCUMENT_DATE"
  | "TRANSACTION_DATE"
  | "PAYMENT_DATE";
export type OrderTaxReadinessStatus =
  | "READY"
  | "INCOMPLETE_DOCUMENT"
  | "MISSING_DOCUMENT"
  | "DRAFT_DOCUMENT"
  | "CANCELLED_DOCUMENT"
  | "NOT_REQUIRED";
export type OrderTaxReconciliationStatus =
  | "MATCHED"
  | "MISMATCH"
  | "PARTIAL"
  | "NOT_COMPARABLE";
export type OrderTaxRegisterSortField =
  | "DATE"
  | "TRANSACTION"
  | "INVOICE"
  | "SELLER"
  | "TAXABLE_VALUE"
  | "TOTAL_TAX"
  | "INVOICE_VALUE"
  | "READINESS"
  | "RECONCILIATION";

export type OrderTaxRegisterFilters = {
  source: OrderTaxRegisterSource;
  channel?: "" | OrderTaxRegisterChannel;
  dateBasis: OrderTaxRegisterDateBasis;
  dateFrom: string;
  dateTo: string;
  sellerId?: string;
  documentStatus?: string;
  documentType?: string;
  readinessStatus?: string;
  reconciliationStatus?: string;
  paymentStatus?: string;
  settlementStatus?: string;
  taxClassification?: string;
  gstrSupplySection?: string;
  eInvoiceStatus?: string;
  eWayBillStatus?: string;
  hsnSacCode?: string;
  gstRatePercent?: string;
  reverseCharge?: "" | "true" | "false";
  warningCodes?: string[];
  search?: string;
  sortBy: OrderTaxRegisterSortField;
  sortDirection: "ASC" | "DESC";
  page: number;
  limit: number;
};

export type OrderTaxRegisterRow = {
  id: string;
  documentScopeKey: string;
  source: OrderTaxRegisterSource;
  channel: OrderTaxRegisterChannel;
  valueSource: "TAX_DOCUMENT" | "TRANSACTION_SNAPSHOT";
  transactionId: string;
  transactionNumber: string;
  parentOrderNumber?: string | null;
  sellerScopeId?: string | null;
  transactionDate: string;
  documentId?: string | null;
  documentNumber?: string | null;
  documentType?: string | null;
  documentStatus?: string | null;
  documentDate?: string | null;
  financialYear?: string | null;
  originalDocumentId?: string | null;
  originalDocumentNumber?: string | null;
  adjustmentReason?: string | null;
  adjustmentDate?: string | null;
  documentCreatedAt?: string | null;
  documentCancelledAt?: string | null;
  documentCancellationReason?: string | null;
  createdByAdmin?: string | null;
  sellerId: string;
  sellerName: string;
  sellerGstin?: string | null;
  sellerTaxRegistrationStatus: string;
  buyerName: string;
  buyerGstin?: string | null;
  buyerTaxRegistrationStatus: string;
  placeOfSupplyStateCode?: string | null;
  placeOfSupplyState?: string | null;
  supplyType?: string | null;
  currency: string;
  sourceRecordType?: string | null;
  sourceRecordId?: string | null;
  lineType: string;
  description: string;
  sku?: string | null;
  hsnSacCode?: string | null;
  taxClassification: string;
  quantity: number;
  uqc: string;
  gstRatePercent: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  lineValuePaise: number;
  invoiceValuePaise: number;
  orderValuePaise?: number | null;
  refundAmountPaise: number;
  creditNoteAdjustedTaxableValuePaise: number;
  creditNoteAdjustedTaxPaise: number;
  paymentId?: string | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paymentStatus?: string | null;
  paymentDate?: string | null;
  paidAmountPaise: number;
  settlementId?: string | null;
  settlementStatus?: string | null;
  payoutId?: string | null;
  payoutStatus?: string | null;
  readinessStatus: OrderTaxReadinessStatus;
  reconciliationStatus: OrderTaxReconciliationStatus;
  documentOrderDifferencePaise?: number | null;
  paymentInvoiceDifferencePaise?: number | null;
  taxSnapshotDocumentDifferencePaise?: number | null;
  warningCodes: string[];
  warnings: Array<{ code: string; message: string }>;
  reverseCharge: boolean;
  gstrSupplySection?: string | null;
  eInvoiceStatus?: string | null;
  irn?: string | null;
  acknowledgementNumber?: string | null;
  acknowledgementDate?: string | null;
  eWayBillStatus?: string | null;
  eWayBillNumber?: string | null;
  eWayBillDate?: string | null;
  eWayBillValidUntil?: string | null;
  detailHref: string;
  invoiceDownloadable: boolean;
};

export type OrderTaxRegisterResponse = {
  items: OrderTaxRegisterRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
  truncated: boolean;
  summary: {
    transactionCount: number;
    documentCount: number;
    lineCount: number;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
    invoiceValuePaise: number;
    readinessCounts: Record<OrderTaxReadinessStatus, number>;
    reconciliationCounts: Record<OrderTaxReconciliationStatus, number>;
    warningCounts: Record<string, number>;
  };
};

export function orderTaxRegisterQuery(filters: OrderTaxRegisterFilters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) query.set(key, value.join(","));
    } else if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export function orderTaxRegisterPeriodRange(value: string, now = new Date()) {
  if (value === "ALL_TIME") return { dateFrom: "", dateTo: "" };
  const to = localIsoDate(now);
  if (value === "THIS_MONTH") {
    const from = new Date(now);
    from.setDate(1);
    return { dateFrom: localIsoDate(from), dateTo: to };
  }
  const days =
    value === "LAST_7"
      ? 7
      : value === "LAST_30"
        ? 30
        : value === "LAST_90"
          ? 90
          : 0;
  if (!days) return { dateFrom: "", dateTo: "" };
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { dateFrom: localIsoDate(from), dateTo: to };
}

export function getOrderTaxRegister(
  auth: IndihubAuthHeaders,
  filters: OrderTaxRegisterFilters,
) {
  return indihubFetch<OrderTaxRegisterResponse>(
    `/api/admin/reports/order-tax-register?${orderTaxRegisterQuery(filters)}`,
    undefined,
    auth,
  );
}

export function downloadOrderTaxRegister(
  auth: IndihubAuthHeaders,
  filters: OrderTaxRegisterFilters,
) {
  return downloadAuthenticatedFile(
    auth,
    `/api/admin/reports/export/order-tax-register?${orderTaxRegisterQuery({
      ...filters,
      page: 1,
    })}`,
    "order-tax-reconciliation-register.csv",
    "The order tax register could not be downloaded.",
  );
}

export function downloadOrderTaxDocument(
  auth: IndihubAuthHeaders,
  documentId: string,
) {
  return downloadAuthenticatedFile(
    auth,
    `/api/admin/reports/gst/documents/${encodeURIComponent(documentId)}/download`,
    "tax-document.pdf",
    "The tax document could not be downloaded.",
  );
}

function localIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
