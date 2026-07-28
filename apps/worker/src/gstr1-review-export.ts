import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  GstrSupplySection,
  ProductTaxClassification,
  ReportExportType,
  SellerStatus,
  SellerTaxRegistrationStatus,
  TaxDocumentStatus,
  TaxDocumentType,
  TaxSupplyType,
  gstr1ReviewPeriod,
  prisma,
  type Gstr1ReviewPeriod,
  type ReportExportFilters,
} from "@indihub/database";

export const gstr1ReviewSheetNames = [
  "GSTR1 Report",
  "b2b,sez,de",
  "b2cl",
  "b2cs",
  "cdnr",
  "cdnur",
  "exp",
  "at",
  "atadj",
  "exemp",
  "hsn(b2b)",
  "hsn(b2c)",
  "docs",
  "itemWiseSale",
  "itemWiseSaleReturn",
  "itemSummary",
] as const;

type Address = Record<string, unknown>;

export type ReviewLine = {
  description: string;
  sku: string;
  hsnSacCode: string;
  classificationDescription: string;
  taxClassification: ProductTaxClassification;
  quantity: number;
  uqc: string;
  unitPricePaise: number;
  grossValuePaise: number;
  discountPaise: number;
  taxableValuePaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  lineValuePaise: number;
  warning?: string;
};

export type ReviewDocument = {
  id: string;
  documentNumber: string;
  documentType: TaxDocumentType;
  status: TaxDocumentStatus;
  financialYear: string;
  issueDate: Date;
  supplierLegalName: string;
  supplierGstin: string;
  supplierAddress: Address;
  buyerLegalName: string;
  buyerGstin: string;
  buyerAddress: Address;
  placeOfSupplyStateCode: string;
  supplyType: TaxSupplyType | null;
  section: GstrSupplySection | null;
  reverseCharge: boolean;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
  originalDocumentNumber: string;
  referenceNumber: string;
  reason: string;
  lines: ReviewLine[];
};

export type Gstr1WorkbookData = {
  title: string;
  supplierLegalName: string;
  supplierGstin: string;
  supplierAddress: Address;
  period: Gstr1ReviewPeriod;
  filingStatus: string;
  draftCount: number;
  documents: ReviewDocument[];
  warnings: string[];
};

type GenerateInput = {
  exportType: ReportExportType;
  sellerId: string | null;
  filters: ReportExportFilters;
  directory: string;
  jobId: string;
};

export async function generateGstr1ReviewExport(input: GenerateInput) {
  const period = gstr1ReviewPeriod(input.filters);
  await mkdir(input.directory, { recursive: true });

  if (input.exportType === ReportExportType.GSTR1_REVIEW_SELLER_XLSX) {
    if (!input.sellerId) throw new Error("Seller workbook is missing its seller.");
    const data = await loadSellerWorkbookData(input.sellerId, period);
    const fileName = `${safeName(data.supplierGstin)}-gstr1-${period.label}.xlsx`;
    const filePath = join(input.directory, `${input.jobId}.xlsx`);
    await buildGstr1ReviewWorkbook(data).xlsx.writeFile(filePath);
    return {
      filePath,
      fileName,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: workbookRowCount(data),
    };
  }

  if (input.exportType === ReportExportType.GSTR1_REVIEW_PLATFORM_XLSX) {
    const data = await loadPlatformWorkbookData(period);
    const fileName = `1handindia-platform-gstr1-${period.label}.xlsx`;
    const filePath = join(input.directory, `${input.jobId}.xlsx`);
    await buildGstr1ReviewWorkbook(data).xlsx.writeFile(filePath);
    return {
      filePath,
      fileName,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: workbookRowCount(data),
    };
  }

  if (input.exportType === ReportExportType.GSTR1_REVIEW_ALL_SELLERS_ZIP) {
    return generateAllSellerZip(input, period);
  }

  throw new Error("Unsupported GSTR-1 review export type.");
}

export function buildGstr1ReviewWorkbook(data: Gstr1WorkbookData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "1HandIndia";
  workbook.created = new Date();
  workbook.modified = new Date();

  addCoverSheet(workbook, data);
  addTableSheet(
    workbook,
    "b2b,sez,de",
    invoiceHeaders(true),
    invoiceRows(
      data.documents,
      new Set([GstrSupplySection.B2B, GstrSupplySection.SEZ]),
      true,
    ),
  );
  addTableSheet(
    workbook,
    "b2cl",
    invoiceHeaders(false),
    invoiceRows(data.documents, new Set([GstrSupplySection.B2CL]), false),
  );
  addTableSheet(workbook, "b2cs", b2csHeaders, b2csRows(data.documents));
  addTableSheet(
    workbook,
    "cdnr",
    noteHeaders,
    noteRows(data.documents, GstrSupplySection.CDNR),
  );
  addTableSheet(
    workbook,
    "cdnur",
    noteHeaders,
    noteRows(data.documents, GstrSupplySection.CDNUR),
  );
  addTableSheet(
    workbook,
    "exp",
    invoiceHeaders(false),
    invoiceRows(data.documents, new Set([GstrSupplySection.EXPORT]), false),
  );
  addTableSheet(workbook, "at", advanceHeaders, []);
  addTableSheet(workbook, "atadj", advanceHeaders, []);
  addTableSheet(workbook, "exemp", exemptHeaders, exemptRows(data.documents));
  addTableSheet(workbook, "hsn(b2b)", hsnHeaders, hsnRows(data.documents, true));
  addTableSheet(workbook, "hsn(b2c)", hsnHeaders, hsnRows(data.documents, false));
  addTableSheet(workbook, "docs", documentHeaders, documentRows(data.documents));
  addTableSheet(
    workbook,
    "itemWiseSale",
    itemHeaders,
    itemRows(data.documents, false),
  );
  addTableSheet(
    workbook,
    "itemWiseSaleReturn",
    itemHeaders,
    itemRows(data.documents, true),
  );
  addTableSheet(workbook, "itemSummary", hsnHeaders, hsnRows(data.documents));
  return workbook;
}

async function generateAllSellerZip(
  input: GenerateInput,
  period: Gstr1ReviewPeriod,
) {
  const workDirectory = join(input.directory, `${input.jobId}-sellers`);
  const outputPath = join(input.directory, `${input.jobId}.zip`);
  await mkdir(workDirectory, { recursive: true });
  const zip = new JSZip();
  const manifest: string[][] = [
    [
      "Seller ID",
      "Store",
      "GSTIN",
      "Status",
      "File",
      "Warnings",
      "Reason",
    ],
  ];
  let generated = 0;
  let rowCount = 0;

  try {
    const sellers = await prisma.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        profile: {
          is: {
            taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
          },
        },
      },
      select: {
        id: true,
        storeName: true,
        profile: { select: { gstNumber: true } },
      },
      orderBy: { storeName: "asc" },
    });

    for (const seller of sellers) {
      const gstin = normalizedGstin(seller.profile?.gstNumber);
      if (!gstin) {
        manifest.push([
          seller.id,
          seller.storeName,
          "",
          "SKIPPED",
          "",
          "0",
          "Invalid or missing GSTIN",
        ]);
        continue;
      }
      const activity = await prisma.taxDocument.count({
        where: {
          sellerId: seller.id,
          status: { in: [TaxDocumentStatus.ISSUED, TaxDocumentStatus.CANCELLED] },
          issueDate: { gte: period.from, lt: period.toExclusive },
        },
      });
      if (!activity) {
        manifest.push([
          seller.id,
          seller.storeName,
          gstin,
          "SKIPPED",
          "",
          "0",
          "No issued or cancelled documents in the selected period",
        ]);
        continue;
      }

      try {
        const data = await loadSellerWorkbookData(seller.id, period);
        const fileName = `${gstin}-gstr1-${period.label}.xlsx`;
        const filePath = join(workDirectory, fileName);
        await buildGstr1ReviewWorkbook(data).xlsx.writeFile(filePath);
        zip.file(fileName, createReadStream(filePath));
        generated += 1;
        rowCount += workbookRowCount(data);
        manifest.push([
          seller.id,
          seller.storeName,
          gstin,
          "GENERATED",
          fileName,
          String(data.warnings.length),
          "",
        ]);
      } catch (error) {
        manifest.push([
          seller.id,
          seller.storeName,
          gstin,
          "ERROR",
          "",
          "0",
          errorMessage(error),
        ]);
      }
    }

    if (!generated) {
      throw new Error("No valid seller GSTR-1 workbook could be generated.");
    }

    zip.file("manifest.csv", csv(manifest));
    await pipeline(
      zip.generateNodeStream({
        type: "nodebuffer",
        streamFiles: true,
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      }),
      createWriteStream(outputPath),
    );
    return {
      filePath: outputPath,
      fileName: `1handindia-gstr1-all-sellers-${period.label}.zip`,
      contentType: "application/zip",
      rowCount: rowCount + manifest.length - 1,
    };
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

async function loadSellerWorkbookData(
  sellerId: string,
  period: Gstr1ReviewPeriod,
): Promise<Gstr1WorkbookData> {
  const [seller, documents, draftCount, filingPeriod] = await Promise.all([
    prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        profile: true,
        addresses: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    }),
    prisma.taxDocument.findMany({
      where: {
        sellerId,
        status: { in: [TaxDocumentStatus.ISSUED, TaxDocumentStatus.CANCELLED] },
        issueDate: { gte: period.from, lt: period.toExclusive },
      },
      include: {
        lines: true,
        originalDocument: { select: { documentNumber: true } },
        order: { select: { orderNumber: true } },
        b2bOrder: { select: { orderNumber: true } },
        serviceBooking: { select: { bookingNumber: true } },
      },
      orderBy: [{ issueDate: "asc" }, { documentNumber: "asc" }],
    }),
    prisma.taxDocument.count({
      where: {
        sellerId,
        status: TaxDocumentStatus.DRAFT,
        createdAt: { gte: period.from, lt: period.toExclusive },
      },
    }),
    prisma.gstFilingPeriod.findFirst({
      where: {
        sellerId,
        dateFrom: new Date(`${period.dateFrom}T00:00:00.000Z`),
        dateTo: new Date(`${period.dateTo}T00:00:00.000Z`),
      },
      select: { status: true },
    }),
  ]);

  const gstin = normalizedGstin(seller?.profile?.gstNumber);
  if (
    !seller ||
    seller.status !== SellerStatus.APPROVED ||
    seller.profile?.taxRegistrationStatus !==
      SellerTaxRegistrationStatus.GST_REGISTERED ||
    !gstin
  ) {
    throw new Error("Seller is not eligible for a regular GSTR-1 workbook.");
  }

  const reviewDocuments = documents
    .filter((document) => document.issueDate && document.documentNumber)
    .map<ReviewDocument>((document) => ({
      id: document.id,
      documentNumber: document.documentNumber!,
      documentType: document.documentType,
      status: document.status,
      financialYear: document.financialYear,
      issueDate: document.issueDate!,
      supplierLegalName: document.sellerLegalName,
      supplierGstin: document.sellerGstin ?? gstin,
      supplierAddress: objectValue(document.sellerAddressSnapshot),
      buyerLegalName: document.buyerLegalName,
      buyerGstin: document.buyerGstin ?? "",
      buyerAddress: objectValue(document.buyerAddressSnapshot),
      placeOfSupplyStateCode: document.placeOfSupplyStateCode ?? "",
      supplyType: document.supplyType,
      section: document.gstrSupplySection,
      reverseCharge: document.reverseCharge,
      taxableValuePaise: document.taxableValuePaise,
      cgstPaise: document.cgstPaise,
      sgstPaise: document.sgstPaise,
      igstPaise: document.igstPaise,
      cessPaise: document.cessPaise,
      totalTaxPaise: document.totalTaxPaise,
      invoiceValuePaise: document.invoiceValuePaise,
      originalDocumentNumber: document.originalDocument?.documentNumber ?? "",
      referenceNumber:
        document.order?.orderNumber ??
        document.b2bOrder?.orderNumber ??
        document.serviceBooking?.bookingNumber ??
        "",
      reason: document.reason ?? document.voidReason ?? "",
      lines: document.lines.map((line) => ({
        description: line.description,
        sku: line.sku ?? "",
        hsnSacCode: line.hsnSacCode ?? "",
        classificationDescription:
          line.classificationDescriptionSnapshot ?? "",
        taxClassification: line.taxClassification,
        quantity: line.quantity,
        uqc: line.uqc,
        unitPricePaise: line.unitPricePaise,
        grossValuePaise: line.grossValuePaise,
        discountPaise: line.discountPaise,
        taxableValuePaise: line.taxableValuePaise,
        gstRatePercent: Number(line.gstRatePercent ?? 0),
        cgstPaise: line.cgstPaise,
        sgstPaise: line.sgstPaise,
        igstPaise: line.igstPaise,
        cessPaise: line.cessPaise,
        totalTaxPaise: line.totalTaxPaise,
        lineValuePaise: line.lineValuePaise,
      })),
    }));
  const first = reviewDocuments[0];
  const supplierAddress =
    first?.supplierAddress ?? objectValue(seller.addresses[0] ?? {});
  const warnings = [
    ...(draftCount
      ? [`${draftCount} draft tax document(s) are excluded from filing values.`]
      : []),
    ...(!reviewDocuments.length
      ? ["No issued or cancelled documents exist in the selected period."]
      : []),
  ];

  return {
    title: `${seller.storeName} GSTR-1`,
    supplierLegalName:
      first?.supplierLegalName ??
      seller.profile.businessLegalName ??
      seller.storeName,
    supplierGstin: first?.supplierGstin ?? gstin,
    supplierAddress,
    period,
    filingStatus: filingPeriod?.status ?? "OPEN",
    draftCount,
    documents: reviewDocuments,
    warnings,
  };
}

async function loadPlatformWorkbookData(
  period: Gstr1ReviewPeriod,
): Promise<Gstr1WorkbookData> {
  const [settings, documents] = await Promise.all([
    prisma.setting.findMany({
      where: {
        key: {
          in: [
            "gst.platform.legal_name",
            "gst.platform.gstin",
            "gst.platform.address",
            "gst.platform.service_sac_code",
            "gst.platform.service_description",
          ],
        },
      },
      select: { key: true, value: true },
    }),
    prisma.marketplaceTaxDocument.findMany({
      where: {
        status: { in: [TaxDocumentStatus.ISSUED, TaxDocumentStatus.CANCELLED] },
        issueDate: { gte: period.from, lt: period.toExclusive },
      },
      orderBy: [{ issueDate: "asc" }, { documentNumber: "asc" }],
    }),
  ]);
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const serviceSacCode = stringValue(
    values.get("gst.platform.service_sac_code"),
  );
  const serviceDescription =
    stringValue(values.get("gst.platform.service_description")) ||
    "Marketplace commission and platform services";
  const warnings: string[] = [];
  const reviewDocuments = documents.map<ReviewDocument>((document) => {
    const parsed = platformLines(
      document.taxLinesSnapshot,
      document,
      serviceSacCode,
      serviceDescription,
    );
    warnings.push(...parsed.warnings.map((warning) => `${document.documentNumber}: ${warning}`));
    return {
      id: document.id,
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      status: document.status,
      financialYear: document.financialYear,
      issueDate: document.issueDate,
      supplierLegalName: document.supplierLegalName,
      supplierGstin: document.supplierGstin,
      supplierAddress: objectValue(document.supplierAddressSnapshot),
      buyerLegalName: document.recipientLegalName,
      buyerGstin: document.recipientGstin ?? "",
      buyerAddress: objectValue(document.recipientAddressSnapshot),
      placeOfSupplyStateCode: document.placeOfSupplyStateCode ?? "",
      supplyType: document.supplyType,
      section:
        document.gstrSupplySectionSnapshot ??
        (normalizedGstin(document.recipientGstin)
          ? GstrSupplySection.B2B
          : GstrSupplySection.B2CS),
      reverseCharge: false,
      taxableValuePaise: document.taxableValuePaise,
      cgstPaise: document.cgstPaise,
      sgstPaise: document.sgstPaise,
      igstPaise: document.igstPaise,
      cessPaise: document.cessPaise,
      totalTaxPaise: document.totalTaxPaise,
      invoiceValuePaise: document.invoiceValuePaise,
      originalDocumentNumber: "",
      referenceNumber: document.sourceId,
      reason: document.reason ?? "",
      lines: parsed.lines,
    };
  });
  const first = reviewDocuments[0];
  const supplierGstin =
    first?.supplierGstin ??
    stringValue(values.get("gst.platform.gstin")).toUpperCase();
  if (!normalizedGstin(supplierGstin)) {
    warnings.push("Platform GSTIN is missing or invalid.");
  }
  if (!/^[0-9]{6}$/.test(serviceSacCode)) {
    warnings.push("Platform service SAC code is missing or invalid.");
  }

  return {
    title: "1HandIndia Platform GSTR-1",
    supplierLegalName:
      first?.supplierLegalName ??
      stringValue(values.get("gst.platform.legal_name")),
    supplierGstin,
    supplierAddress:
      first?.supplierAddress ??
      objectValue(values.get("gst.platform.address")),
    period,
    filingStatus: "ACCOUNTANT REVIEW",
    draftCount: 0,
    documents: reviewDocuments,
    warnings: unique(warnings),
  };
}

export function platformLines(
  snapshot: unknown,
  document: {
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
    invoiceValuePaise: number;
    description: string;
  },
  fallbackSacCode: string,
  fallbackDescription: string,
) {
  const lines: ReviewLine[] = [];
  if (Array.isArray(snapshot)) {
    for (const value of snapshot) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const line = value as Record<string, unknown>;
      const warning = stringValue(line.warning);
      lines.push({
        description:
          stringValue(line.description) ||
          fallbackDescription ||
          document.description,
        sku: "",
        hsnSacCode: stringValue(line.sacCode) || fallbackSacCode,
        classificationDescription: stringValue(line.description),
        taxClassification: ProductTaxClassification.TAXABLE,
        quantity: 1,
        uqc: "NOS",
        unitPricePaise: numberValue(line.taxableValuePaise),
        grossValuePaise: numberValue(line.taxableValuePaise),
        discountPaise: 0,
        taxableValuePaise: numberValue(line.taxableValuePaise),
        gstRatePercent: numberValue(line.gstRatePercent),
        cgstPaise: numberValue(line.cgstPaise),
        sgstPaise: numberValue(line.sgstPaise),
        igstPaise: numberValue(line.igstPaise),
        cessPaise: numberValue(line.cessPaise),
        totalTaxPaise: numberValue(line.totalTaxPaise),
        lineValuePaise:
          numberValue(line.taxableValuePaise) +
          numberValue(line.totalTaxPaise),
        ...(warning ? { warning } : {}),
      });
    }
  }
  if (lines.length) {
    return {
      lines,
      warnings: lines.flatMap((line) => (line.warning ? [line.warning] : [])),
    };
  }
  const gstRatePercent =
    document.taxableValuePaise > 0
      ? Math.round(
          (document.totalTaxPaise / document.taxableValuePaise) * 10_000,
        ) / 100
      : 0;
  const warning =
    "Immutable platform tax-line snapshot was unavailable; this row was derived from document totals.";
  return {
    lines: [
      {
        description: fallbackDescription || document.description,
        sku: "",
        hsnSacCode: fallbackSacCode,
        classificationDescription: fallbackDescription,
        taxClassification: ProductTaxClassification.TAXABLE,
        quantity: 1,
        uqc: "NOS",
        unitPricePaise: document.taxableValuePaise,
        grossValuePaise: document.taxableValuePaise,
        discountPaise: 0,
        taxableValuePaise: document.taxableValuePaise,
        gstRatePercent,
        cgstPaise: document.cgstPaise,
        sgstPaise: document.sgstPaise,
        igstPaise: document.igstPaise,
        cessPaise: document.cessPaise,
        totalTaxPaise: document.totalTaxPaise,
        lineValuePaise: document.invoiceValuePaise,
        warning,
      },
    ],
    warnings: [warning],
  };
}

function addCoverSheet(workbook: ExcelJS.Workbook, data: Gstr1WorkbookData) {
  const sheet = workbook.addWorksheet("GSTR1 Report", {
    views: [{ state: "frozen", ySplit: 8 }],
  });
  sheet.mergeCells("A1:H2");
  const title = sheet.getCell("A1");
  title.value = data.title;
  title.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 18 };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFED3500" } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 12;

  const details = [
    ["Supplier legal name", data.supplierLegalName],
    ["GSTIN", data.supplierGstin],
    ["Registered address", addressText(data.supplierAddress)],
    ["Period", `${displayDate(data.period.dateFrom)} to ${displayDate(data.period.dateTo)}`],
    ["Period type", data.period.kind === "MONTH" ? "Calendar month" : "GST quarter"],
    ["Filing status", data.filingStatus],
  ];
  details.forEach(([label, value], index) => {
    const row = sheet.getRow(index + 4);
    row.values = [label, value];
    row.getCell(1).font = { bold: true, color: { argb: "FF475467" } };
  });
  sheet.mergeCells("A11:H11");
  const disclaimer = sheet.getCell("A11");
  disclaimer.value = "Accountant Review Workbook - Not a GST portal upload file";
  disclaimer.font = { bold: true, color: { argb: "FFB42318" } };
  disclaimer.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0ED" } };

  const issued = data.documents.filter(
    (document) => document.status === TaxDocumentStatus.ISSUED,
  );
  const sectionTotals = new Map<string, { documents: number; taxable: number; tax: number }>();
  for (const document of issued) {
    const key = document.section ?? "UNCLASSIFIED";
    const sign = documentSign(document);
    const current = sectionTotals.get(key) ?? { documents: 0, taxable: 0, tax: 0 };
    current.documents += 1;
    current.taxable += sign * document.taxableValuePaise;
    current.tax += sign * document.totalTaxPaise;
    sectionTotals.set(key, current);
  }
  const rows = [...sectionTotals.entries()].map(([section, total]) => [
    section,
    total.documents,
    rupees(total.taxable),
    rupees(total.tax),
  ]);
  const start = 13;
  sheet.getRow(start).values = ["Section", "Documents", "Taxable value", "GST"];
  styleHeader(sheet.getRow(start));
  rows.forEach((row) => sheet.addRow(row));
  if (!rows.length) sheet.addRow(["No filing activity", 0, 0, 0]);

  const warningStart = sheet.rowCount + 2;
  sheet.getRow(warningStart).values = ["Validation notes"];
  styleHeader(sheet.getRow(warningStart));
  const warnings = unique([
    ...data.warnings,
    ...data.documents.flatMap((document) =>
      document.lines.flatMap((line) => (line.warning ? [line.warning] : [])),
    ),
  ]);
  (warnings.length ? warnings : ["No validation warnings."]).forEach((warning) =>
    sheet.addRow([warning]),
  );
  sheet.columns = [
    { width: 30 },
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  formatMoneyColumns(sheet, [3, 4], start + 1);
}

function addTableSheet(
  workbook: ExcelJS.Workbook,
  name: (typeof gstr1ReviewSheetNames)[number],
  headers: string[],
  rows: Array<Array<string | number | Date>>,
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  rows.forEach((row) => sheet.addRow(row));
  if (!rows.length) {
    sheet.addRow(["No transactions in this section for the selected period."]);
    sheet.mergeCells(2, 1, 2, Math.max(1, headers.length));
    sheet.getRow(2).font = { italic: true, color: { argb: "FF667085" } };
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.columns = headers.map((header) => ({
    width: Math.min(34, Math.max(12, header.length + 3)),
  }));
  for (const row of sheet.getRows(2, Math.max(0, sheet.rowCount - 1)) ?? []) {
    row.eachCell((cell) => {
      if (cell.value instanceof Date) cell.numFmt = "dd-mm-yyyy";
      if (typeof cell.value === "number" && moneyHeader(headers[cell.col - 1] ?? "")) {
        cell.numFmt = "#,##0.00;[Red]-#,##0.00";
      }
    });
  }
}

const invoiceBaseHeaders = [
  "Recipient GSTIN",
  "Recipient name",
  "Invoice number",
  "Invoice date",
  "Invoice value",
  "Place of supply",
  "Reverse charge",
  "GST rate",
  "Taxable value",
  "IGST",
  "CGST",
  "SGST",
  "Cess",
  "HSN/SAC",
  "Description",
  "Reference",
];

function invoiceHeaders(includeSection: boolean) {
  return includeSection ? ["Section", ...invoiceBaseHeaders] : invoiceBaseHeaders;
}

const b2csHeaders = [
  "Place of supply",
  "Supply type",
  "GST rate",
  "Taxable value",
  "IGST",
  "CGST",
  "SGST",
  "Cess",
];
const noteHeaders = [
  "Recipient GSTIN",
  "Recipient name",
  "Note number",
  "Note date",
  "Note type",
  "Original invoice",
  "Place of supply",
  "GST rate",
  "Taxable value",
  "IGST",
  "CGST",
  "SGST",
  "Cess",
  "Reason",
];
const advanceHeaders = [
  "Place of supply",
  "GST rate",
  "Gross advance",
  "Cess",
];
const exemptHeaders = [
  "Nature",
  "Recipient type",
  "Supply type",
  "Value",
];
const hsnHeaders = [
  "HSN/SAC",
  "Description",
  "UQC",
  "Quantity",
  "Total value",
  "Taxable value",
  "GST rate",
  "IGST",
  "CGST",
  "SGST",
  "Cess",
];
const documentHeaders = [
  "Document type",
  "Financial year",
  "Series",
  "From",
  "To",
  "Issued",
  "Cancelled",
  "Net issued",
];
const itemHeaders = [
  "Document number",
  "Document date",
  "Reference",
  "Recipient",
  "Recipient GSTIN",
  "HSN/SAC",
  "SKU",
  "Description",
  "Quantity",
  "UQC",
  "Unit price",
  "Gross value",
  "Discount",
  "Taxable value",
  "GST rate",
  "IGST",
  "CGST",
  "SGST",
  "Cess",
  "Line value",
];

function invoiceRows(
  documents: ReviewDocument[],
  sections: Set<GstrSupplySection>,
  includeSection: boolean,
) {
  return activeDocuments(documents)
    .filter((document) => document.section && sections.has(document.section))
    .flatMap((document) =>
      document.lines.map((line) => {
        const row: Array<string | number | Date> = [
          document.buyerGstin,
          document.buyerLegalName,
          document.documentNumber,
          document.issueDate,
          rupees(document.invoiceValuePaise),
          document.placeOfSupplyStateCode,
          document.reverseCharge ? "Y" : "N",
          line.gstRatePercent,
          rupees(line.taxableValuePaise),
          rupees(line.igstPaise),
          rupees(line.cgstPaise),
          rupees(line.sgstPaise),
          rupees(line.cessPaise),
          line.hsnSacCode,
          line.description,
          document.referenceNumber,
        ];
        return includeSection ? [document.section ?? "", ...row] : row;
      }),
    );
}

function b2csRows(documents: ReviewDocument[]) {
  const rows = new Map<string, number[]>();
  for (const document of activeDocuments(documents).filter(
    (item) => item.section === GstrSupplySection.B2CS,
  )) {
    for (const line of document.lines) {
      const key = `${document.placeOfSupplyStateCode}|${document.supplyType}|${line.gstRatePercent}`;
      const current = rows.get(key) ?? [0, 0, 0, 0, 0];
      current[0]! += line.taxableValuePaise;
      current[1]! += line.igstPaise;
      current[2]! += line.cgstPaise;
      current[3]! += line.sgstPaise;
      current[4]! += line.cessPaise;
      rows.set(key, current);
    }
  }
  return [...rows.entries()].map(([key, values]) => {
    const [placeOfSupply, supplyType, rate] = key.split("|");
    return [
      placeOfSupply ?? "",
      supplyType ?? "",
      Number(rate),
      ...values.map(rupees),
    ];
  });
}

function noteRows(documents: ReviewDocument[], section: GstrSupplySection) {
  return activeDocuments(documents)
    .filter((document) => document.section === section)
    .flatMap((document) =>
      document.lines.map((line) => [
        document.buyerGstin,
        document.buyerLegalName,
        document.documentNumber,
        document.issueDate,
        document.documentType === TaxDocumentType.CREDIT_NOTE ? "Credit" : "Debit",
        document.originalDocumentNumber,
        document.placeOfSupplyStateCode,
        line.gstRatePercent,
        rupees(Math.abs(line.taxableValuePaise)),
        rupees(Math.abs(line.igstPaise)),
        rupees(Math.abs(line.cgstPaise)),
        rupees(Math.abs(line.sgstPaise)),
        rupees(Math.abs(line.cessPaise)),
        document.reason,
      ]),
    );
}

function exemptRows(documents: ReviewDocument[]) {
  const rows = new Map<string, number>();
  for (const document of activeDocuments(documents).filter(
    (item) => item.section === GstrSupplySection.NIL_EXEMPT_NON_GST,
  )) {
    for (const line of document.lines) {
      const key = [
        line.taxClassification,
        document.buyerGstin ? "Registered" : "Unregistered",
        document.supplyType ?? "",
      ].join("|");
      rows.set(key, (rows.get(key) ?? 0) + line.taxableValuePaise);
    }
  }
  return [...rows.entries()].map(([key, value]) => [
    ...key.split("|"),
    rupees(value),
  ]);
}

function hsnRows(documents: ReviewDocument[], registered?: boolean) {
  const rows = new Map<
    string,
    {
      description: string;
      uqc: string;
      quantity: number;
      total: number;
      taxable: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    }
  >();
  for (const document of activeDocuments(documents)) {
    if (registered !== undefined && Boolean(document.buyerGstin) !== registered) continue;
    const sign = documentSign(document);
    for (const line of document.lines) {
      const key = `${line.hsnSacCode}|${line.gstRatePercent}|${line.uqc}`;
      const current = rows.get(key) ?? {
        description: line.classificationDescription || line.description,
        uqc: line.uqc,
        quantity: 0,
        total: 0,
        taxable: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      };
      current.quantity += sign * line.quantity;
      current.total += sign * line.lineValuePaise;
      current.taxable += sign * line.taxableValuePaise;
      current.igst += sign * line.igstPaise;
      current.cgst += sign * line.cgstPaise;
      current.sgst += sign * line.sgstPaise;
      current.cess += sign * line.cessPaise;
      rows.set(key, current);
    }
  }
  return [...rows.entries()].map(([key, value]) => {
    const [code, rate] = key.split("|");
    return [
      code ?? "",
      value.description,
      value.uqc,
      value.quantity,
      rupees(value.total),
      rupees(value.taxable),
      Number(rate),
      rupees(value.igst),
      rupees(value.cgst),
      rupees(value.sgst),
      rupees(value.cess),
    ];
  });
}

function documentRows(documents: ReviewDocument[]) {
  const groups = new Map<
    string,
    {
      documentType: TaxDocumentType;
      financialYear: string;
      series: string;
      numbers: number[];
      issued: number;
      cancelled: number;
    }
  >();
  for (const document of documents) {
    const match = /^(.*?)(\d+)$/.exec(document.documentNumber);
    const series = match?.[1] ?? document.documentNumber;
    const number = match ? Number(match[2]) : 0;
    const key = `${document.documentType}|${document.financialYear}|${series}`;
    const current = groups.get(key) ?? {
      documentType: document.documentType,
      financialYear: document.financialYear,
      series,
      numbers: [],
      issued: 0,
      cancelled: 0,
    };
    if (number) current.numbers.push(number);
    if (document.status === TaxDocumentStatus.CANCELLED) current.cancelled += 1;
    else current.issued += 1;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => [
    group.documentType,
    group.financialYear,
    group.series,
    group.numbers.length ? Math.min(...group.numbers) : "",
    group.numbers.length ? Math.max(...group.numbers) : "",
    group.issued + group.cancelled,
    group.cancelled,
    group.issued,
  ]);
}

function itemRows(documents: ReviewDocument[], returns: boolean) {
  return activeDocuments(documents)
    .filter(
      (document) =>
        (document.documentType === TaxDocumentType.CREDIT_NOTE) === returns,
    )
    .flatMap((document) =>
      document.lines.map((line) => [
        document.documentNumber,
        document.issueDate,
        document.referenceNumber,
        document.buyerLegalName,
        document.buyerGstin,
        line.hsnSacCode,
        line.sku,
        line.description,
        line.quantity,
        line.uqc,
        rupees(line.unitPricePaise),
        rupees(line.grossValuePaise),
        rupees(line.discountPaise),
        rupees(line.taxableValuePaise),
        line.gstRatePercent,
        rupees(line.igstPaise),
        rupees(line.cgstPaise),
        rupees(line.sgstPaise),
        rupees(line.cessPaise),
        rupees(line.lineValuePaise),
      ]),
    );
}

function activeDocuments(documents: ReviewDocument[]) {
  return documents.filter(
    (document) => document.status === TaxDocumentStatus.ISSUED,
  );
}

function documentSign(document: ReviewDocument) {
  return document.documentType === TaxDocumentType.CREDIT_NOTE ? -1 : 1;
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF344054" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD0D5DD" } },
    };
  });
}

function formatMoneyColumns(
  sheet: ExcelJS.Worksheet,
  columns: number[],
  startRow: number,
) {
  for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    for (const column of columns) {
      sheet.getCell(rowNumber, column).numFmt = "#,##0.00;[Red]-#,##0.00";
    }
  }
}

function moneyHeader(header: string) {
  return /(value|igst|cgst|sgst|cess|price|discount|advance|gross)/i.test(
    header,
  );
}

function workbookRowCount(data: Gstr1WorkbookData) {
  return (
    data.documents.length +
    data.documents.reduce((total, document) => total + document.lines.length, 0)
  );
}

function normalizedGstin(value: string | null | undefined) {
  const gstin = value?.trim().toUpperCase() ?? "";
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)
    ? gstin
    : "";
}

function objectValue(value: unknown): Address {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Address)
    : {};
}

function addressText(value: Address) {
  return [
    value.line1 ?? value.addressLine1,
    value.line2 ?? value.addressLine2,
    value.area,
    value.city,
    value.state,
    value.postalCode ?? value.pincode,
    value.country,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function rupees(paise: number) {
  return Math.round(paise) / 100;
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function safeName(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "seller";
}

function csv(rows: string[][]) {
  return `\uFEFF${rows
    .map((row) =>
      row
        .map((value) => `"${value.replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\r\n")}\r\n`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
