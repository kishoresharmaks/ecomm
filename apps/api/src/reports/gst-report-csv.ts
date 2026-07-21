type GstReportLine = {
  hsnSacCode?: string | null;
  description: string;
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

type GstReportDocument = {
  documentNumber?: string | null;
  documentType: string;
  issueDate?: Date | string | null;
  orderNumber?: string | null;
  sellerName: string;
  sellerGstin?: string | null;
  buyerLegalName: string;
  buyerGstin?: string | null;
  buyerAddress?: {
    line1?: string | null;
    line2?: string | null;
    area?: string | null;
    city?: string | null;
    state?: string | null;
    stateCode?: string | null;
    postalCode?: string | null;
    country?: string | null;
    countryCode?: string | null;
  };
  placeOfSupplyStateCode?: string | null;
  supplyType?: string | null;
  gstrSupplySection?: string | null;
  originalDocumentNumber?: string | null;
  reason?: string | null;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
  lines: GstReportLine[];
  compliance?: {
    eInvoiceStatus?: string;
    irn?: string | null;
    acknowledgementNumber?: string | null;
    eInvoiceProvider?: string | null;
    eInvoiceError?: string | null;
    eWayBillStatus?: string;
    eWayBillNumber?: string | null;
    eWayBillProvider?: string | null;
    eWayBillError?: string | null;
  };
};

type GstReport = {
  documents: GstReportDocument[];
  hsnSummary: Array<{
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
  }>;
  gstr3b?: {
    table3_1: Record<
      string,
      {
        taxableValuePaise: number;
        cgstPaise: number;
        sgstPaise: number;
        igstPaise: number;
        cessPaise: number;
        totalTaxPaise: number;
        invoiceValuePaise: number;
      }
    >;
    table3_2: {
      unregistered: Array<{
        placeOfSupplyStateCode: string;
        taxableValuePaise: number;
        igstPaise: number;
      }>;
    };
  };
  tcs?: {
    statements: Array<{
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
  documentSeries?: Array<{
    documentType: string;
    financialYear: string;
    prefix: string;
    fromNumber?: number | null;
    toNumber?: number | null;
    issuedCount: number;
    cancelledCount: number;
    netIssuedCount: number;
  }>;
  rateLiability?: Array<{
    gstRatePercent: number;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
  }>;
  stateLiability?: Array<{
    placeOfSupplyStateCode: string;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
  }>;
  gstinSummary?: Array<{
    buyerGstin: string;
    buyerLegalName: string;
    documentCount: number;
    taxableValuePaise: number;
    totalTaxPaise: number;
    invoiceValuePaise: number;
  }>;
  reconciliation?: {
    issues: Array<{
      severity: string;
      code: string;
      documentNumber?: string | null;
      message: string;
    }>;
  };
  platformCommission?: {
    documents: Array<{
      documentNumber: string;
      issueDate: Date | string;
      seller?: { storeName?: string | null };
      recipientLegalName: string;
      recipientGstin?: string | null;
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      totalTaxPaise: number;
      invoiceValuePaise: number;
    }>;
  };
};

export function gstRegisterCsv(data: GstReport) {
  return csv([
    [
      "Document Number",
      "Document Type",
      "Issue Date",
      "Order Number",
      "Seller",
      "Seller GSTIN",
      "Buyer",
      "Buyer GSTIN",
      "Address Line 1",
      "Address Line 2",
      "Area",
      "City",
      "State",
      "State Code",
      "Postal Code",
      "Country",
      "Country Code",
      "Place of Supply",
      "Supply Type",
      "GSTR Section",
      "Original Document",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Cess (INR)",
      "Total Tax (INR)",
      "Document Value (INR)",
      "Reason",
    ],
    ...data.documents.map((document) => [
      document.documentNumber ?? "",
      document.documentType,
      dateValue(document.issueDate),
      document.orderNumber ?? "",
      document.sellerName,
      document.sellerGstin ?? "",
      document.buyerLegalName,
      document.buyerGstin ?? "",
      document.buyerAddress?.line1 ?? "",
      document.buyerAddress?.line2 ?? "",
      document.buyerAddress?.area ?? "",
      document.buyerAddress?.city ?? "",
      document.buyerAddress?.state ?? "",
      document.buyerAddress?.stateCode ?? "",
      document.buyerAddress?.postalCode ?? "",
      document.buyerAddress?.country ?? "",
      document.buyerAddress?.countryCode ?? "",
      document.placeOfSupplyStateCode ?? "",
      document.supplyType ?? "",
      document.gstrSupplySection ?? "",
      document.originalDocumentNumber ?? "",
      rupees(document.taxableValuePaise),
      rupees(document.cgstPaise),
      rupees(document.sgstPaise),
      rupees(document.igstPaise),
      rupees(document.cessPaise),
      rupees(document.totalTaxPaise),
      rupees(document.invoiceValuePaise),
      document.reason ?? "",
    ]),
  ]);
}

export function hsnSummaryCsv(data: GstReport) {
  return csv([
    [
      "HSN/SAC",
      "Description",
      "UQC",
      "Total Quantity",
      "GST Rate %",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Cess (INR)",
      "Total Tax (INR)",
    ],
    ...data.hsnSummary.map((item) => [
      item.hsnSacCode,
      item.description,
      item.uqc,
      item.quantity,
      item.gstRatePercent,
      rupees(item.taxableValuePaise),
      rupees(item.cgstPaise),
      rupees(item.sgstPaise),
      rupees(item.igstPaise),
      rupees(item.cessPaise),
      rupees(item.totalTaxPaise),
    ]),
  ]);
}

export function gstr1OrientedCsv(data: GstReport) {
  const rows: Array<Array<string | number>> = [
    [
      "GSTR Section",
      "Document Type",
      "Supplier GSTIN",
      "Receiver GSTIN/UIN",
      "Receiver Name",
      "Invoice/Credit Note Number",
      "Invoice/Credit Note Date",
      "Original Invoice Number",
      "Place of Supply",
      "Reverse Charge",
      "Invoice Value (INR)",
      "GST Rate %",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Cess (INR)",
      "Order Reference",
    ],
  ];
  for (const document of data.documents) {
    const byRate = new Map<
      number,
      {
        taxableValuePaise: number;
        cgstPaise: number;
        sgstPaise: number;
        igstPaise: number;
        cessPaise: number;
      }
    >();
    for (const line of document.lines) {
      const current = byRate.get(line.gstRatePercent) ?? {
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        cessPaise: 0,
      };
      current.taxableValuePaise += line.taxableValuePaise;
      current.cgstPaise += line.cgstPaise;
      current.sgstPaise += line.sgstPaise;
      current.igstPaise += line.igstPaise;
      current.cessPaise += line.cessPaise;
      byRate.set(line.gstRatePercent, current);
    }
    for (const [rate, totals] of byRate) {
      rows.push([
        document.gstrSupplySection ?? "",
        document.documentType,
        document.sellerGstin ?? "",
        document.buyerGstin ?? "",
        document.buyerLegalName,
        document.documentNumber ?? "",
        dateValue(document.issueDate),
        document.originalDocumentNumber ?? "",
        document.placeOfSupplyStateCode ?? "",
        "N",
        rupees(document.invoiceValuePaise),
        rate,
        rupees(totals.taxableValuePaise),
        rupees(totals.cgstPaise),
        rupees(totals.sgstPaise),
        rupees(totals.igstPaise),
        rupees(totals.cessPaise),
        document.orderNumber ?? "",
      ]);
    }
  }
  return csv(rows);
}

export function gstr3bSummaryCsv(data: GstReport) {
  const rows: Array<Array<string | number>> = [
    [
      "GSTR-3B Table",
      "Nature of Supplies",
      "Taxable Value (INR)",
      "IGST (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "Cess (INR)",
    ],
  ];
  const labels: Record<string, [string, string]> = {
    outwardTaxable: ["3.1(a)", "Outward taxable supplies"],
    zeroRated: ["3.1(b)", "Zero-rated outward supplies"],
    nilExempt: ["3.1(c)", "Nil-rated and exempt outward supplies"],
    inwardReverseCharge: ["3.1(d)", "Inward supplies liable to reverse charge"],
    nonGst: ["3.1(e)", "Non-GST outward supplies"],
  };
  for (const [key, totals] of Object.entries(data.gstr3b?.table3_1 ?? {})) {
    const [table, label] = labels[key] ?? ["3.1", key];
    rows.push([
      table,
      label,
      rupees(totals.taxableValuePaise),
      rupees(totals.igstPaise),
      rupees(totals.cgstPaise),
      rupees(totals.sgstPaise),
      rupees(totals.cessPaise),
    ]);
  }
  for (const row of data.gstr3b?.table3_2.unregistered ?? []) {
    rows.push([
      "3.2",
      `Inter-state supplies to unregistered persons - POS ${row.placeOfSupplyStateCode}`,
      rupees(row.taxableValuePaise),
      rupees(row.igstPaise),
      "0.00",
      "0.00",
      "0.00",
    ]);
  }
  return csv(rows);
}

export function gstr8TcsCsv(data: GstReport) {
  return csv([
    [
      "Seller",
      "Seller GSTIN",
      "Transactions",
      "Gross Supplies (INR)",
      "Returns (INR)",
      "Net Supplies (INR)",
      "IGST TCS (INR)",
      "CGST TCS (INR)",
      "SGST TCS (INR)",
      "Total TCS (INR)",
    ],
    ...(data.tcs?.statements ?? []).map((item) => [
      item.sellerName,
      item.sellerGstin ?? "",
      item.transactionCount,
      rupees(item.grossSuppliesPaise),
      rupees(item.returnsPaise),
      rupees(item.netSuppliesPaise),
      rupees(item.igstPaise),
      rupees(item.cgstPaise),
      rupees(item.sgstPaise),
      rupees(item.totalTcsPaise),
    ]),
  ]);
}

export function documentSeriesCsv(data: GstReport) {
  return csv([
    [
      "Document Type",
      "Financial Year",
      "Series Prefix",
      "From",
      "To",
      "Issued",
      "Cancelled",
      "Net Issued",
    ],
    ...(data.documentSeries ?? []).map((item) => [
      item.documentType,
      item.financialYear,
      item.prefix,
      item.fromNumber ?? "",
      item.toNumber ?? "",
      item.issuedCount,
      item.cancelledCount,
      item.netIssuedCount,
    ]),
  ]);
}

export function rateLiabilityCsv(data: GstReport) {
  return csv([
    [
      "GST Rate %",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Cess (INR)",
      "Total GST (INR)",
    ],
    ...(data.rateLiability ?? []).map((item) => [
      item.gstRatePercent,
      rupees(item.taxableValuePaise),
      rupees(item.cgstPaise),
      rupees(item.sgstPaise),
      rupees(item.igstPaise),
      rupees(item.cessPaise),
      rupees(item.totalTaxPaise),
    ]),
  ]);
}

export function stateLiabilityCsv(data: GstReport) {
  return csv([
    [
      "Place of Supply State Code",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Cess (INR)",
      "Total GST (INR)",
    ],
    ...(data.stateLiability ?? []).map((item) => [
      item.placeOfSupplyStateCode,
      rupees(item.taxableValuePaise),
      rupees(item.cgstPaise),
      rupees(item.sgstPaise),
      rupees(item.igstPaise),
      rupees(item.cessPaise),
      rupees(item.totalTaxPaise),
    ]),
  ]);
}

export function gstinSummaryCsv(data: GstReport) {
  return csv([
    [
      "Buyer GSTIN",
      "Buyer Legal Name",
      "Documents",
      "Taxable Value (INR)",
      "Total GST (INR)",
      "Document Value (INR)",
    ],
    ...(data.gstinSummary ?? []).map((item) => [
      item.buyerGstin,
      item.buyerLegalName,
      item.documentCount,
      rupees(item.taxableValuePaise),
      rupees(item.totalTaxPaise),
      rupees(item.invoiceValuePaise),
    ]),
  ]);
}

export function reconciliationCsv(data: GstReport) {
  return csv([
    ["Severity", "Code", "Document Number", "Message"],
    ...(data.reconciliation?.issues ?? []).map((item) => [
      item.severity,
      item.code,
      item.documentNumber ?? "",
      item.message,
    ]),
  ]);
}

export function platformCommissionCsv(data: GstReport) {
  return csv([
    [
      "Invoice Number",
      "Issue Date",
      "Seller",
      "Seller GSTIN",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Total GST (INR)",
      "Invoice Value (INR)",
    ],
    ...(data.platformCommission?.documents ?? []).map((item) => [
      item.documentNumber,
      dateValue(item.issueDate),
      item.recipientLegalName || item.seller?.storeName || "",
      item.recipientGstin ?? "",
      rupees(item.taxableValuePaise),
      rupees(item.cgstPaise),
      rupees(item.sgstPaise),
      rupees(item.igstPaise),
      rupees(item.totalTaxPaise),
      rupees(item.invoiceValuePaise),
    ]),
  ]);
}

export function eInvoiceStatusCsv(data: GstReport) {
  return csv([
    [
      "Document Number",
      "Issue Date",
      "Seller GSTIN",
      "Buyer GSTIN",
      "Status",
      "IRN",
      "Acknowledgement Number",
      "Provider",
      "Error",
    ],
    ...data.documents.map((item) => [
      item.documentNumber ?? "",
      dateValue(item.issueDate),
      item.sellerGstin ?? "",
      item.buyerGstin ?? "",
      item.compliance?.eInvoiceStatus ?? "NOT_REQUIRED",
      item.compliance?.irn ?? "",
      item.compliance?.acknowledgementNumber ?? "",
      item.compliance?.eInvoiceProvider ?? "",
      item.compliance?.eInvoiceError ?? "",
    ]),
  ]);
}

export function eWayBillStatusCsv(data: GstReport) {
  return csv([
    [
      "Document Number",
      "Issue Date",
      "Seller GSTIN",
      "Document Value (INR)",
      "Status",
      "E-way Bill Number",
      "Provider",
      "Error",
    ],
    ...data.documents.map((item) => [
      item.documentNumber ?? "",
      dateValue(item.issueDate),
      item.sellerGstin ?? "",
      rupees(item.invoiceValuePaise),
      item.compliance?.eWayBillStatus ?? "NOT_REQUIRED",
      item.compliance?.eWayBillNumber ?? "",
      item.compliance?.eWayBillProvider ?? "",
      item.compliance?.eWayBillError ?? "",
    ]),
  ]);
}

function csv(rows: Array<Array<string | number>>) {
  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function rupees(paise: number) {
  return (paise / 100).toFixed(2);
}

function dateValue(value?: Date | string | null) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN");
}
