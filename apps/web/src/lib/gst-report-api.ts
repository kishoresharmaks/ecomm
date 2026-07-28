import {
  IndihubApiError,
  apiBaseUrl,
  buildAuthHeaders,
  indihubFetch,
  type IndihubAuthHeaders,
} from "./api";

export type GstDocumentType =
  | "TAX_INVOICE"
  | "BILL_OF_SUPPLY"
  | "COMMERCIAL_INVOICE"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE";

export type SellerTaxRegistrationStatus =
  | "GST_REGISTERED"
  | "NOT_REGISTERED"
  | "COMPOSITION";

export type ProductTaxClassification =
  | "TAXABLE"
  | "NIL_RATED"
  | "EXEMPT"
  | "NON_GST";

export type GstSupplyType = "INTRA_STATE" | "INTER_STATE" | "OUTSIDE_INDIA";

export type GstrSupplySection =
  | "B2B"
  | "B2CL"
  | "B2CS"
  | "CDNR"
  | "CDNUR"
  | "EXPORT"
  | "SEZ"
  | "NIL_EXEMPT_NON_GST";

export type GstReportLine = {
  id: string;
  lineType: "PRODUCT" | "SHIPPING" | "ADJUSTMENT";
  description: string;
  hsnSacCode?: string | null;
  taxClassification: ProductTaxClassification;
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
};

export type GstReportDocument = {
  id: string;
  documentNumber?: string | null;
  documentType: GstDocumentType;
  issueDate?: string | null;
  financialYear: string;
  orderNumber?: string | null;
  sellerId: string;
  sellerName: string;
  sellerTaxRegistrationStatus: SellerTaxRegistrationStatus;
  sellerGstin?: string | null;
  buyerLegalName: string;
  buyerGstin?: string | null;
  buyerAddress: GstBuyerAddress;
  placeOfSupplyStateCode?: string | null;
  supplyType?: GstSupplyType | null;
  gstrSupplySection?: GstrSupplySection | null;
  originalDocumentNumber?: string | null;
  reason?: string | null;
  currency: string;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
  reverseCharge?: boolean;
  compliance: {
    eInvoiceStatus: GstComplianceStatus;
    irn?: string | null;
    acknowledgementNumber?: string | null;
    acknowledgementDate?: string | null;
    signedQrCode?: string | null;
    eInvoiceProvider?: string | null;
    eInvoiceError?: string | null;
    eWayBillStatus: GstComplianceStatus;
    eWayBillNumber?: string | null;
    eWayBillGeneratedAt?: string | null;
    eWayBillValidUntil?: string | null;
    eWayBillProvider?: string | null;
    eWayBillError?: string | null;
    lastSyncedAt?: string | null;
  };
  lines: GstReportLine[];
};

export type GstBuyerAddress = {
  line1: string;
  line2: string;
  area: string;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  countryCode: string;
};

export type GstComplianceStatus =
  | "NOT_REQUIRED"
  | "READY"
  | "PENDING"
  | "SUBMITTED"
  | "GENERATED"
  | "CANCELLED"
  | "FAILED";

export type ManualEInvoiceInput = {
  irn: string;
  acknowledgementNumber: string;
  acknowledgementDate: string;
  signedQrCode: string;
};

export type GstMoneyTotals = {
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
};

export type GstHsnSummaryRow = {
  hsnSacCode: string;
  description: string;
  uqc: string;
  gstRatePercent: number;
  quantity: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
};

export type GstReport = {
  currency: string;
  summary: {
    documentCount: number;
    invoiceCount: number;
    creditNoteCount: number;
    debitNoteCount: number;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
    invoiceValuePaise: number;
  };
  documents: GstReportDocument[];
  hsnSummary: GstHsnSummaryRow[];
  sections: Array<
    GstMoneyTotals & {
      section: GstrSupplySection | "UNCLASSIFIED";
      documentCount: number;
    }
  >;
  gstr1: Record<GstrSupplySection, GstReportDocument[]>;
  gstr3b: {
    table3_1: {
      outwardTaxable: GstMoneyTotals;
      zeroRated: GstMoneyTotals;
      nilExempt: GstMoneyTotals;
      inwardReverseCharge: GstMoneyTotals;
      nonGst: GstMoneyTotals;
    };
    table3_2: {
      unregistered: Array<{
        placeOfSupplyStateCode: string;
        taxableValuePaise: number;
        igstPaise: number;
      }>;
      composition: unknown[];
      uin: unknown[];
    };
    sourceNote: string;
  };
  documentSeries: Array<{
    documentType: GstDocumentType;
    financialYear: string;
    prefix: string;
    fromNumber?: number | null;
    toNumber?: number | null;
    issuedCount: number;
    cancelledCount: number;
    netIssuedCount: number;
  }>;
  rateLiability: Array<
    Omit<GstMoneyTotals, "invoiceValuePaise"> & { gstRatePercent: number }
  >;
  stateLiability: Array<GstMoneyTotals & { placeOfSupplyStateCode: string }>;
  gstinSummary: Array<
    GstMoneyTotals & {
      buyerGstin: string;
      buyerLegalName: string;
      documentCount: number;
    }
  >;
  reconciliation: {
    issueCount: number;
    errorCount: number;
    warningCount: number;
    readyToLock: boolean;
    books: GstMoneyTotals & {
      documentCount: number;
      invoiceCount: number;
      creditNoteCount: number;
      debitNoteCount: number;
    };
    filing: GstMoneyTotals & {
      documentCount: number;
      invoiceCount: number;
      creditNoteCount: number;
      debitNoteCount: number;
    };
    difference: {
      taxableValuePaise: number;
      totalTaxPaise: number;
      invoiceValuePaise: number;
    };
    issues: Array<{
      severity: "INFO" | "WARNING" | "ERROR";
      code: string;
      documentId?: string;
      documentNumber?: string | null;
      message: string;
    }>;
  };
  tcs: {
    summary: {
      sellerCount: number;
      transactionCount: number;
      grossSuppliesPaise: number;
      returnsPaise: number;
      netSuppliesPaise: number;
      igstPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      totalTcsPaise: number;
    };
    statements: Array<{
      sellerId: string;
      sellerName: string;
      sellerGstin?: string | null;
      transactionCount: number;
      grossSuppliesPaise: number;
      returnsPaise: number;
      netSuppliesPaise: number;
      igstPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      totalTcsPaise: number;
    }>;
  };
  platformCommission: {
    configured: boolean;
    missingConfiguration: string[];
    summary: GstMoneyTotals & { documentCount: number };
    documents: Array<{
      id: string;
      documentNumber: string;
      documentType: GstDocumentType;
      status: string;
      issueDate: string;
      recipientLegalName: string;
      recipientGstin?: string | null;
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      totalTaxPaise: number;
      invoiceValuePaise: number;
      description: string;
    }>;
  };
  providerReadiness: {
    eInvoice: {
      enabled: boolean;
      provider: string;
      credentialsConfigured: boolean;
      mode: "MANUAL";
    };
    eWayBill: {
      enabled: boolean;
      provider: string;
      thresholdPaise: number;
      credentialsConfigured: boolean;
      mode: "MANUAL";
    };
    platformInvoice: {
      configured: boolean;
      missingConfiguration: string[];
    };
  };
  filingPeriods: GstFilingPeriod[];
  truncated: boolean;
};

export type GstReportOverview = Omit<GstReport, "documents" | "gstr1" | "truncated"> & {
  documentTotal: number;
  gstr1Counts: Record<GstrSupplySection, number>;
  complianceCounts: {
    eInvoiceReady: number;
    eWayBillReady: number;
  };
};

export type GstDocumentPage = {
  items: GstReportDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type GstReviewSellerOption = {
  id: string;
  storeName: string;
  businessLegalName?: string | null;
  gstin: string;
};

export type GstDocumentFilters = {
  page?: number | undefined;
  limit?: number | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  sellerId?: string | undefined;
  documentType?: GstDocumentType | undefined;
  sellerTaxRegistrationStatus?: SellerTaxRegistrationStatus | undefined;
  section?: GstrSupplySection | undefined;
  taxClassification?: ProductTaxClassification | undefined;
  eInvoiceStatus?: GstComplianceStatus | undefined;
  eWayBillStatus?: GstComplianceStatus | undefined;
  search?: string | undefined;
};

export type GstFilingPeriodStatus = "OPEN" | "LOCKED" | "FILED" | "REOPENED";

export type GstFilingPeriod = {
  id: string;
  sellerId: string;
  returnPeriod: string;
  financialYear: string;
  dateFrom: string;
  dateTo: string;
  status: GstFilingPeriodStatus;
  snapshotHash?: string | null;
  lockedAt?: string | null;
  filedAt?: string | null;
  filingReference?: string | null;
  notes?: string | null;
  _count?: { reconciliationRuns: number; exports: number };
};

export type GstCsvExport =
  | "gst-register"
  | "hsn-summary"
  | "gstr-1"
  | "gstr-1-json"
  | "gstr-3b"
  | "gstr-8"
  | "document-series"
  | "rate-liability"
  | "state-liability"
  | "gstin-summary"
  | "reconciliation"
  | "platform-commission"
  | "e-invoice"
  | "e-way-bill";

export function getAdminGstReport(
  auth: IndihubAuthHeaders,
  queryString = "",
) {
  return indihubFetch<GstReport>(
    `/api/admin/reports/gst${queryString ? `?${queryString}` : ""}`,
    undefined,
    auth,
  );
}

export function getAdminGstOverview(
  auth: IndihubAuthHeaders,
  queryString = "",
) {
  return indihubFetch<GstReportOverview>(
    `/api/admin/reports/gst/overview${queryString ? `?${queryString}` : ""}`,
    undefined,
    auth,
  );
}

export function getAdminGstDocuments(
  auth: IndihubAuthHeaders,
  filters: GstDocumentFilters,
) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  return indihubFetch<GstDocumentPage>(
    `/api/admin/reports/gst/documents?${query.toString()}`,
    undefined,
    auth,
  );
}

export function getAdminGstSellerOptions(auth: IndihubAuthHeaders) {
  return indihubFetch<GstReviewSellerOption[]>(
    "/api/admin/reports/gst/sellers",
    undefined,
    auth,
  );
}

export function downloadAdminGstReportCsv(
  auth: IndihubAuthHeaders,
  type: GstCsvExport,
  queryString = "",
) {
  const path = `/api/admin/reports/export/${type}${queryString ? `?${queryString}` : ""}`;
  return downloadAuthenticatedCsv(auth, path, `marketplace-${type}.csv`);
}

export function downloadAdminGstDocumentPdf(
  auth: IndihubAuthHeaders,
  documentId: string,
) {
  return downloadAuthenticatedFile(
    auth,
    `/api/admin/reports/gst/documents/${encodeURIComponent(documentId)}/download`,
    "gst-document.pdf",
    "The tax document could not be downloaded.",
  );
}

export function manualEInvoiceValidationError(input: ManualEInvoiceInput) {
  if (!input.irn.trim()) return "Enter the Invoice Reference Number (IRN).";
  if (input.irn.trim().length > 128) return "IRN must be 128 characters or fewer.";
  if (!input.acknowledgementNumber.trim()) return "Enter the acknowledgement number.";
  if (input.acknowledgementNumber.trim().length > 100) {
    return "Acknowledgement number must be 100 characters or fewer.";
  }
  if (!input.acknowledgementDate || Number.isNaN(Date.parse(input.acknowledgementDate))) {
    return "Enter the acknowledgement date and time.";
  }
  if (!input.signedQrCode.trim()) return "Enter the signed QR payload.";
  if (input.signedQrCode.trim().length > 10_000) {
    return "Signed QR payload must be 10,000 characters or fewer.";
  }
  return null;
}

export function recordAdminManualEInvoice(
  auth: IndihubAuthHeaders,
  documentId: string,
  input: ManualEInvoiceInput,
) {
  return indihubFetch<GstReportDocument["compliance"]>(
    `/api/admin/reports/gst/documents/${encodeURIComponent(documentId)}/compliance`,
    {
      method: "PATCH",
      body: JSON.stringify({
        eInvoiceStatus: "GENERATED",
        irn: input.irn.trim(),
        acknowledgementNumber: input.acknowledgementNumber.trim(),
        acknowledgementDate: input.acknowledgementDate,
        signedQrCode: input.signedQrCode.trim(),
        eInvoiceProvider: "MANUAL",
        eInvoiceProviderRef: input.acknowledgementNumber.trim(),
        eInvoiceError: "",
      }),
    },
    auth,
  );
}

export function getAdminGstFilingPeriods(
  auth: IndihubAuthHeaders,
  sellerId: string,
) {
  return indihubFetch<GstFilingPeriod[]>(
    `/api/admin/reports/gst/filing-periods/${encodeURIComponent(sellerId)}`,
    undefined,
    auth,
  );
}

export async function downloadAuthenticatedCsv(
  auth: IndihubAuthHeaders,
  path: string,
  fallbackFileName: string,
) {
  return downloadAuthenticatedFile(
    auth,
    path,
    fallbackFileName,
    "The GST report could not be downloaded.",
  );
}

export async function downloadAuthenticatedFile(
  auth: IndihubAuthHeaders,
  path: string,
  fallbackFileName: string,
  errorMessage: string,
) {
  let response = await fetch(`${apiBaseUrl}${path}`, {
    headers: await buildAuthHeaders(auth),
  });

  if (response.status === 401 && auth.getBearerToken) {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: await buildAuthHeaders(auth, { skipCache: true }),
    });
  }

  if (!response.ok) {
    throw new IndihubApiError(errorMessage, response.status);
  }

  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileNameMatch?.[1] ?? fallbackFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
