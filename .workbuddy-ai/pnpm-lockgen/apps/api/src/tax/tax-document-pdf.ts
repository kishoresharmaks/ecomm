import type {
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentType,
  TaxSupplyType,
} from "@indihub/database";
import { renderProfessionalPdf } from "../documents/professional-pdf";

type AddressSnapshot = {
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
};

export type TaxDocumentPdfRecord = {
  documentNumber: string | null;
  documentType: TaxDocumentType;
  issueDate: Date | null;
  supplyDate: Date | null;
  orderNumber: string;
  originalDocumentNumber?: string | null;
  reason?: string | null;
  sellerLegalName: string;
  sellerTaxRegistrationStatus: SellerTaxRegistrationStatus;
  sellerGstin: string | null;
  sellerAddressSnapshot: unknown;
  buyerLegalName: string;
  buyerGstin: string | null;
  buyerAddressSnapshot: unknown;
  placeOfSupplyStateCode: string | null;
  supplyType: TaxSupplyType | null;
  reverseCharge: boolean;
  currency: string;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
  lines: Array<{
    description: string;
    sku: string | null;
    hsnSacCode: string | null;
    taxClassification: ProductTaxClassification;
    quantity: number;
    uqc: string;
    taxableValuePaise: number;
    gstRatePercent: { toString(): string } | number | string | null;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    lineValuePaise: number;
  }>;
  compliance?: {
    irn?: string | null;
    acknowledgementNumber?: string | null;
    acknowledgementDate?: Date | null;
    eWayBillNumber?: string | null;
  } | null;
};

export function renderTaxDocumentPdf(document: TaxDocumentPdfRecord) {
  const title = taxDocumentLabel(document.documentType);
  const complianceFields = [
    document.compliance?.irn ? { label: "Invoice Reference Number (IRN)", value: document.compliance.irn } : null,
    document.compliance?.acknowledgementNumber
      ? { label: "Acknowledgement number", value: document.compliance.acknowledgementNumber }
      : null,
    document.compliance?.acknowledgementDate
      ? { label: "Acknowledgement date", value: dateTimeText(document.compliance.acknowledgementDate) }
      : null,
    document.compliance?.eWayBillNumber
      ? { label: "E-way bill number", value: document.compliance.eWayBillNumber }
      : null,
  ].filter((field): field is { label: string; value: string } => Boolean(field));

  return renderProfessionalPdf({
    title,
    documentNumber: document.documentNumber ?? "Pending number",
    status: "Issued",
    subtitle: documentSubtitle(document.documentType),
    issuedBy: document.sellerLegalName,
    issuerCaption: "Seller-issued document powered by 1HandIndia",
    poweredByPlatform: true,
    metadata: [
      { label: "Document number", value: document.documentNumber ?? "Pending number" },
      { label: "Order number", value: document.orderNumber },
      { label: "Issue date", value: dateText(document.issueDate) },
      { label: "Supply date", value: dateText(document.supplyDate) },
      { label: "Supply type", value: humanize(document.supplyType) },
      { label: "Reverse charge", value: document.reverseCharge ? "Yes" : "No" },
      { label: "Currency", value: document.currency },
      { label: "Line items", value: String(document.lines.length) },
      ...(document.originalDocumentNumber
        ? [{ label: "Original document", value: document.originalDocumentNumber }]
        : []),
      ...(document.reason ? [{ label: "Reason", value: document.reason }] : []),
    ],
    parties: [
      {
        label: "Supplier",
        name: document.sellerLegalName,
        lines: [
          `GST registration: ${registrationLabel(document.sellerTaxRegistrationStatus)}`,
          `GSTIN: ${document.sellerGstin ?? "Not GST registered"}`,
          addressText(document.sellerAddressSnapshot),
        ],
      },
      {
        label: "Bill to / Recipient",
        name: document.buyerLegalName,
        lines: [
          `GSTIN: ${document.buyerGstin ?? "Not provided"}`,
          addressText(document.buyerAddressSnapshot),
          `Place of supply: ${document.placeOfSupplyStateCode ?? "Not recorded"}`,
        ],
      },
    ],
    sections: [
      {
        type: "table",
        title: "Item and tax details",
        columns: [
          { key: "item", label: "Description / SKU", width: 180 },
          { key: "classification", label: "HSN/SAC", width: 68 },
          { key: "quantity", label: "Qty", width: 48, align: "right" },
          { key: "taxable", label: "Taxable", width: 78, align: "right" },
          { key: "tax", label: "GST", width: 62, align: "right" },
          { key: "total", label: "Total", width: 78, align: "right" },
        ],
        rows: document.lines.map((line) => ({
          item: `${line.description}${line.sku ? `\nSKU: ${line.sku}` : ""}`,
          classification: `${line.hsnSacCode ?? "-"}\n${humanize(line.taxClassification)}`,
          quantity: `${line.quantity} ${line.uqc}`,
          taxable: money(line.taxableValuePaise, document.currency),
          tax: `${rateText(line.gstRatePercent)}%\n${money(line.cgstPaise + line.sgstPaise + line.igstPaise + line.cessPaise, document.currency)}`,
          total: money(line.lineValuePaise, document.currency),
        })),
      },
      {
        type: "totals",
        emphasizedLabel: "Invoice value",
        rows: [
          { label: "Taxable value", value: money(document.taxableValuePaise, document.currency) },
          { label: "CGST", value: money(document.cgstPaise, document.currency) },
          { label: "SGST", value: money(document.sgstPaise, document.currency) },
          { label: "IGST", value: money(document.igstPaise, document.currency) },
          { label: "Cess", value: money(document.cessPaise, document.currency) },
          { label: "Total tax", value: money(document.totalTaxPaise, document.currency) },
          { label: "Invoice value", value: money(document.invoiceValuePaise, document.currency) },
        ],
      },
      ...(complianceFields.length
        ? [{ type: "fields" as const, title: "Statutory references", fields: complianceFields, columns: 1 as const }]
        : []),
    ],
    ...(document.documentType === "CREDIT_NOTE" || document.documentType === "DEBIT_NOTE"
      ? { footerLines: [documentFooter(document.documentType)] }
      : {}),
    fileTitle: `${title} ${document.documentNumber ?? document.orderNumber}`,
  });
}

export function taxDocumentDownloadFileName(document: {
  documentNumber: string | null;
  orderNumber?: string;
  documentType: TaxDocumentType;
}) {
  const fallback = `${document.orderNumber ?? "document"}-${taxDocumentLabel(document.documentType)}`;
  return `${(document.documentNumber ?? fallback).replace(/[^a-zA-Z0-9._-]+/g, "-")}.pdf`;
}

export function taxDocumentLabel(documentType: TaxDocumentType | string) {
  switch (documentType) {
    case "TAX_INVOICE":
      return "Tax Invoice";
    case "BILL_OF_SUPPLY":
      return "Bill of Supply";
    case "COMMERCIAL_INVOICE":
      return "Commercial Invoice";
    case "CREDIT_NOTE":
      return "Credit Note";
    case "DEBIT_NOTE":
      return "Debit Note";
    default:
      return humanize(documentType);
  }
}

function documentSubtitle(documentType: TaxDocumentType | string) {
  if (documentType === "COMMERCIAL_INVOICE") return "No GST has been collected on this commercial document.";
  if (documentType === "BILL_OF_SUPPLY") return "GST is not charged separately on this bill of supply.";
  return "Transaction document issued from the recorded seller and order tax details.";
}

function documentFooter(documentType: TaxDocumentType | string) {
  if (documentType === "CREDIT_NOTE" || documentType === "DEBIT_NOTE") {
    return "This adjustment document must be read together with the referenced original invoice.";
  }
  return "This is a computer-generated document and does not require a physical signature.";
}

function registrationLabel(status: SellerTaxRegistrationStatus | string) {
  switch (status) {
    case "REGULAR":
      return "Regular GST registration";
    case "COMPOSITION":
      return "Composition scheme";
    case "UNREGISTERED":
      return "Not GST registered";
    default:
      return humanize(status);
  }
}

function addressText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Address not recorded";
  const address = value as AddressSnapshot;
  const lines = [
    address.line1,
    address.line2,
    address.area,
    [address.city, address.state, address.pincode].filter(Boolean).join(", "),
    address.country,
  ].filter((part): part is string => Boolean(part?.trim()));
  return lines.length ? lines.join(", ") : "Address not recorded";
}

function money(amountPaise: number, currency: string) {
  return `${currency} ${(amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function rateText(value: TaxDocumentPdfRecord["lines"][number]["gstRatePercent"]) {
  if (value === null || value === undefined) return "0";
  return value.toString();
}

function dateText(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(value)
    : "Not recorded";
}

function dateTimeText(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function humanize(value: string | null | undefined) {
  return value
    ? value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "Not recorded";
}
