import type {
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentType,
  TaxSupplyType,
} from "@indihub/database";

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

type PdfFont = "regular" | "bold" | "mono";

type PdfLine = {
  text: string;
  font?: PdfFont;
  size?: number;
  color?: "brand" | "muted" | "text";
  gapBefore?: number;
  gapAfter?: number;
};

const pageTop = 805;
const pageBottom = 42;
const pageWidth = 595;
const contentLeft = 42;
const contentRight = 42;

export function renderTaxDocumentPdf(document: TaxDocumentPdfRecord) {
  const title = taxDocumentLabel(document.documentType);
  const lines: PdfLine[] = [
    { text: "1HandIndia Seller Document", font: "bold", size: 10, color: "brand" },
    { text: title, font: "bold", size: 19, color: "text", gapAfter: 5 },
    {
      text:
        document.documentType === "COMMERCIAL_INVOICE"
          ? "No GST has been collected on this document."
          : document.documentType === "BILL_OF_SUPPLY"
            ? "GST is not charged separately on this bill of supply."
            : "Seller-issued transaction document generated from the immutable order tax snapshot.",
      size: 8,
      color: "muted",
      gapAfter: 8,
    },
    separator(),
    detailLine("Document number", document.documentNumber ?? "Pending number"),
    detailLine("Order number", document.orderNumber),
    detailLine("Issue date", dateText(document.issueDate)),
    detailLine("Supply date", dateText(document.supplyDate)),
    ...(document.originalDocumentNumber
      ? [detailLine("Original document", document.originalDocumentNumber)]
      : []),
    ...(document.reason ? [detailLine("Reason", document.reason)] : []),
    separator(),
    { text: "Supplier", font: "bold", size: 11, color: "brand", gapAfter: 2 },
    { text: document.sellerLegalName, font: "bold", size: 10 },
    detailLine(
      "GST registration",
      registrationLabel(document.sellerTaxRegistrationStatus),
    ),
    detailLine("GSTIN", document.sellerGstin ?? "Not GST registered"),
    detailLine("Address", addressText(document.sellerAddressSnapshot)),
    separator(),
    { text: "Recipient", font: "bold", size: 11, color: "brand", gapAfter: 2 },
    { text: document.buyerLegalName, font: "bold", size: 10 },
    detailLine("GSTIN", document.buyerGstin ?? "Not provided"),
    detailLine("Address", addressText(document.buyerAddressSnapshot)),
    detailLine(
      "Place of supply",
      document.placeOfSupplyStateCode ?? "Not recorded",
    ),
    detailLine("Supply type", humanize(document.supplyType)),
    detailLine("Reverse charge", document.reverseCharge ? "Yes" : "No"),
    separator(),
    { text: "Items", font: "bold", size: 11, color: "brand", gapAfter: 3 },
    {
      text: "No  Description / SKU",
      font: "mono",
      size: 8,
      color: "muted",
    },
  ];

  document.lines.forEach((line, index) => {
    lines.push({
      text: `${index + 1}. ${line.description}${line.sku ? ` / ${line.sku}` : ""}`,
      font: "bold",
      size: 9,
      gapBefore: index === 0 ? 0 : 3,
    });
    lines.push({
      text: [
        `HSN/SAC ${line.hsnSacCode ?? "-"}`,
        `Class ${humanize(line.taxClassification)}`,
        `Qty ${line.quantity} ${line.uqc}`,
        `Taxable ${money(line.taxableValuePaise, document.currency)}`,
        `GST ${rateText(line.gstRatePercent)}%`,
      ].join(" | "),
      font: "mono",
      size: 7,
      color: "muted",
    });
    lines.push({
      text: [
        `CGST ${money(line.cgstPaise, document.currency)}`,
        `SGST ${money(line.sgstPaise, document.currency)}`,
        `IGST ${money(line.igstPaise, document.currency)}`,
        `Cess ${money(line.cessPaise, document.currency)}`,
        `Line total ${money(line.lineValuePaise, document.currency)}`,
      ].join(" | "),
      font: "mono",
      size: 7,
      color: "muted",
    });
  });

  lines.push(
    separator(),
    { text: "Totals", font: "bold", size: 11, color: "brand", gapAfter: 2 },
    amountLine("Taxable value", document.taxableValuePaise, document.currency),
    amountLine("CGST", document.cgstPaise, document.currency),
    amountLine("SGST", document.sgstPaise, document.currency),
    amountLine("IGST", document.igstPaise, document.currency),
    amountLine("Cess", document.cessPaise, document.currency),
    amountLine("Total GST", document.totalTaxPaise, document.currency),
    {
      text: `Document total: ${money(document.invoiceValuePaise, document.currency)}`,
      font: "bold",
      size: 12,
      gapBefore: 3,
      gapAfter: 5,
    },
  );

  if (
    document.compliance?.irn ||
    document.compliance?.acknowledgementNumber ||
    document.compliance?.eWayBillNumber
  ) {
    lines.push(
      separator(),
      { text: "Compliance references", font: "bold", size: 11, color: "brand" },
      ...(document.compliance.irn
        ? [detailLine("IRN", document.compliance.irn)]
        : []),
      ...(document.compliance.acknowledgementNumber
        ? [
            detailLine(
              "Acknowledgement",
              `${document.compliance.acknowledgementNumber} / ${dateText(
                document.compliance.acknowledgementDate ?? null,
              )}`,
            ),
          ]
        : []),
      ...(document.compliance.eWayBillNumber
        ? [detailLine("E-way bill", document.compliance.eWayBillNumber)]
        : []),
    );
  }

  lines.push(
    separator(),
    {
      text: "This computer-generated document is available through authenticated 1HandIndia transaction records.",
      size: 8,
      color: "muted",
    },
  );

  return buildPdf(paginate(lines));
}

export function taxDocumentDownloadFileName(document: {
  documentNumber: string | null;
  documentType: TaxDocumentType;
}) {
  const prefix = document.documentNumber ?? taxDocumentLabel(document.documentType);
  const safe = prefix
    .replaceAll("/", "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "seller-document"}.pdf`;
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

function detailLine(label: string, value: string): PdfLine {
  return { text: `${label}: ${value}`, size: 9 };
}

function amountLine(label: string, amountPaise: number, currency: string): PdfLine {
  return {
    text: `${label}: ${money(amountPaise, currency)}`,
    font: "mono",
    size: 9,
  };
}

function separator(): PdfLine {
  return {
    text: "------------------------------------------------------------------------------------------",
    font: "mono",
    size: 7,
    color: "muted",
    gapBefore: 4,
    gapAfter: 4,
  };
}

function registrationLabel(status: SellerTaxRegistrationStatus | string) {
  switch (status) {
    case "GST_REGISTERED":
      return "Regular GST registered";
    case "COMPOSITION":
      return "Composition scheme";
    case "NOT_REGISTERED":
      return "Not GST registered";
    default:
      return humanize(status);
  }
}

function addressText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Not recorded";
  }
  const address = value as AddressSnapshot;
  return [
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ") || "Not recorded";
}

function money(amountPaise: number, currency: string) {
  return `${currency} ${(amountPaise / 100).toFixed(2)}`;
}

function rateText(value: TaxDocumentPdfRecord["lines"][number]["gstRatePercent"]) {
  const rate = Number(value?.toString() ?? 0);
  return Number.isFinite(rate) ? rate.toFixed(2).replace(/\.00$/, "") : "0";
}

function dateText(value: Date | null) {
  if (!value) return "Not recorded";
  return value.toISOString().slice(0, 10);
}

function humanize(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function paginate(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [];
  let y = pageTop;

  for (const line of lines) {
    const wrapped = wrapLine(line);
    for (const wrappedLine of wrapped) {
      const lineHeight = (wrappedLine.size ?? 9) + 4;
      const requiredHeight =
        lineHeight + (wrappedLine.gapBefore ?? 0) + (wrappedLine.gapAfter ?? 0);
      if (current.length && y - requiredHeight < pageBottom) {
        pages.push(current);
        current = [];
        y = pageTop;
      }
      current.push(wrappedLine);
      y -= requiredHeight;
    }
  }

  if (current.length || pages.length === 0) {
    pages.push(current);
  }
  return pages;
}

function wrapLine(line: PdfLine) {
  const size = line.size ?? 9;
  const averageCharacterWidth = line.font === "mono" ? size * 0.6 : size * 0.52;
  const maxCharacters = Math.max(
    28,
    Math.floor((pageWidth - contentLeft - contentRight) / averageCharacterWidth),
  );
  const chunks = wrapText(line.text, maxCharacters);
  return chunks.map((text, index) => {
    const wrappedLine: PdfLine = { text };
    if (line.font !== undefined) wrappedLine.font = line.font;
    if (line.size !== undefined) wrappedLine.size = line.size;
    if (line.color !== undefined) wrappedLine.color = line.color;
    const gapBefore = index === 0 ? line.gapBefore : 0;
    const gapAfter = index === chunks.length - 1 ? line.gapAfter : 0;
    if (gapBefore !== undefined) wrappedLine.gapBefore = gapBefore;
    if (gapAfter !== undefined) wrappedLine.gapAfter = gapAfter;
    return wrappedLine;
  });
}

function wrapText(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) return [value];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxCharacters) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.flatMap((line) =>
    line.length <= maxCharacters
      ? [line]
      : Array.from(
          { length: Math.ceil(line.length / maxCharacters) },
          (_, index) => line.slice(index * maxCharacters, (index + 1) * maxCharacters),
        ),
  );
}

function buildPdf(pages: PdfLine[][]) {
  const regularFontRef = 3 + pages.length * 2;
  const boldFontRef = regularFontRef + 1;
  const monoFontRef = regularFontRef + 2;
  const pageRefs = pages.map((_, index) => 3 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs.map((reference) => `${reference} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((lines, index) => {
    const contentRef = 4 + index * 2;
    const content = pageContent(lines, index + 1, pages.length);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 842] /Resources << /Font << /F1 ${regularFontRef} 0 R /F2 ${boldFontRef} 0 R /F3 ${monoFontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    );
  });

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  );

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return Buffer.from(chunks.join(""), "utf8");
}

function pageContent(lines: PdfLine[], pageNumber: number, pageCount: number) {
  let y = pageTop;
  const commands: string[] = [];
  for (const line of lines) {
    y -= line.gapBefore ?? 0;
    const size = line.size ?? 9;
    const font = line.font === "bold" ? "F2" : line.font === "mono" ? "F3" : "F1";
    const color =
      line.color === "brand"
        ? "0.929 0.208 0"
        : line.color === "muted"
          ? "0.4 0.44 0.49"
          : "0.12 0.16 0.2";
    commands.push(
      `${color} rg`,
      "BT",
      `/${font} ${size} Tf`,
      `${contentLeft} ${y} Td`,
      `(${pdfText(line.text)}) Tj`,
      "ET",
    );
    y -= size + 4 + (line.gapAfter ?? 0);
  }
  commands.push(
    "0.4 0.44 0.49 rg",
    "BT",
    "/F1 7 Tf",
    `${pageWidth - contentRight - 55} 24 Td`,
    `(Page ${pageNumber} of ${pageCount}) Tj`,
    "ET",
  );
  return commands.join("\n");
}

function pdfText(value: string) {
  return value
    .replace(/[\\()]/g, (character) => `\\${character}`)
    .replace(/[^\x20-\x7E]/g, "?");
}
