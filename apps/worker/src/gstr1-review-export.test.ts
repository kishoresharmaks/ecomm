import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  prisma,
} from "@indihub/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGstr1ReviewWorkbook,
  generateGstr1ReviewExport,
  gstr1ReviewSheetNames,
  platformLines,
  type Gstr1WorkbookData,
  type ReviewDocument,
} from "./gstr1-review-export";

describe("GSTR-1 accountant review workbooks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves all 16 expected sheet names", () => {
    expect(buildGstr1ReviewWorkbook(data()).worksheets.map((sheet) => sheet.name)).toEqual(
      gstr1ReviewSheetNames,
    );
  });

  it("reports total issued, cancelled and net issued document series", () => {
    const workbook = buildGstr1ReviewWorkbook(
      data([
        document({ documentNumber: "INV-001" }),
        document({
          documentNumber: "INV-002",
          status: TaxDocumentStatus.CANCELLED,
        }),
      ]),
    );

    const values = workbook.getWorksheet("docs")?.getRow(2).values;
    expect(Array.isArray(values) ? values.slice(1) : values).toEqual([
      TaxDocumentType.TAX_INVOICE,
      "2026-27",
      "INV-",
      1,
      2,
      2,
      1,
      1,
    ]);
  });

  it("splits HSN summaries by recipient registration and nets credit notes", () => {
    const workbook = buildGstr1ReviewWorkbook(
      data([
        document({
          buyerGstin: "29ABCDE1234F1Z5",
          section: GstrSupplySection.B2B,
          lines: [line({ hsnSacCode: "1001", quantity: 2, taxableValuePaise: 10_000 })],
        }),
        document({
          documentNumber: "CN-001",
          documentType: TaxDocumentType.CREDIT_NOTE,
          buyerGstin: "29ABCDE1234F1Z5",
          section: GstrSupplySection.CDNR,
          lines: [line({ hsnSacCode: "1001", quantity: 1, taxableValuePaise: 5_000 })],
        }),
        document({
          documentNumber: "INV-003",
          buyerGstin: "",
          section: GstrSupplySection.B2CS,
          lines: [line({ hsnSacCode: "2002" })],
        }),
      ]),
    );

    expect(workbook.getWorksheet("hsn(b2b)")?.getRow(2).getCell(1).value).toBe("1001");
    expect(workbook.getWorksheet("hsn(b2b)")?.getRow(2).getCell(4).value).toBe(1);
    expect(workbook.getWorksheet("hsn(b2b)")?.getRow(2).getCell(6).value).toBe(50);
    expect(workbook.getWorksheet("hsn(b2c)")?.getRow(2).getCell(1).value).toBe("2002");
    expect(workbook.getWorksheet("cdnr")?.getRow(2).getCell(3).value).toBe("CN-001");
  });

  it("marks historical platform totals with a visible fallback warning", () => {
    const result = platformLines(
      null,
      {
        taxableValuePaise: 10_000,
        cgstPaise: 900,
        sgstPaise: 900,
        igstPaise: 0,
        cessPaise: 0,
        totalTaxPaise: 1_800,
        invoiceValuePaise: 11_800,
        description: "Commission",
      },
      "998599",
      "Marketplace services",
    );

    expect(result.lines[0]).toMatchObject({
      hsnSacCode: "998599",
      gstRatePercent: 18,
    });
    expect(result.warnings[0]).toContain("snapshot was unavailable");
  });

  it("includes generated and skipped sellers in the ZIP manifest", async () => {
    vi.spyOn(prisma.seller, "findMany").mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        storeName: "Valid Store",
        profile: { gstNumber: "33ABCDE1234F1Z5" },
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        storeName: "Invalid Store",
        profile: { gstNumber: "INVALID" },
      },
    ] as never);
    vi.spyOn(prisma.taxDocument, "count")
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    vi.spyOn(prisma.seller, "findUnique").mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      storeName: "Valid Store",
      status: SellerStatus.APPROVED,
      profile: {
        gstNumber: "33ABCDE1234F1Z5",
        taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
        businessLegalName: "Valid Store Private Limited",
      },
      addresses: [{ countryCode: "IN", line1: "12 Market Road" }],
    } as never);
    vi.spyOn(prisma.taxDocument, "findMany").mockResolvedValue([] as never);
    vi.spyOn(prisma.gstFilingPeriod, "findFirst").mockResolvedValue(null);
    const directory = await mkdtemp(join(tmpdir(), "gstr1-review-"));

    try {
      const generated = await generateGstr1ReviewExport({
        exportType: ReportExportType.GSTR1_REVIEW_ALL_SELLERS_ZIP,
        sellerId: null,
        filters: { dateFrom: "2026-06-01", dateTo: "2026-06-30" },
        directory,
        jobId: "job-1",
      });
      const zip = await JSZip.loadAsync(await readFile(generated.filePath));
      const manifest = await zip.file("manifest.csv")?.async("string");

      expect(manifest).toContain("Valid Store");
      expect(manifest).toContain("GENERATED");
      expect(manifest).toContain("Invalid Store");
      expect(manifest).toContain("SKIPPED");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function data(documents: ReviewDocument[] = []): Gstr1WorkbookData {
  return {
    title: "Test GSTR-1",
    supplierLegalName: "Test Seller Private Limited",
    supplierGstin: "33ABCDE1234F1Z5",
    supplierAddress: { line1: "12 Market Road" },
    period: {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      from: new Date("2026-05-31T18:30:00.000Z"),
      toExclusive: new Date("2026-06-30T18:30:00.000Z"),
      label: "2026-06-01_to_2026-06-30",
      kind: "MONTH",
    },
    filingStatus: "OPEN",
    draftCount: 0,
    documents,
    warnings: [],
  };
}

function document(overrides: Partial<ReviewDocument> = {}): ReviewDocument {
  return {
    id: "document-id",
    documentNumber: "INV-001",
    documentType: TaxDocumentType.TAX_INVOICE,
    status: TaxDocumentStatus.ISSUED,
    financialYear: "2026-27",
    issueDate: new Date("2026-06-10T06:30:00.000Z"),
    supplierLegalName: "Test Seller Private Limited",
    supplierGstin: "33ABCDE1234F1Z5",
    supplierAddress: {},
    buyerLegalName: "Test Buyer",
    buyerGstin: "",
    buyerAddress: {},
    placeOfSupplyStateCode: "33",
    supplyType: TaxSupplyType.INTRA_STATE,
    section: GstrSupplySection.B2CS,
    reverseCharge: false,
    taxableValuePaise: 10_000,
    cgstPaise: 900,
    sgstPaise: 900,
    igstPaise: 0,
    cessPaise: 0,
    totalTaxPaise: 1_800,
    invoiceValuePaise: 11_800,
    originalDocumentNumber: "",
    referenceNumber: "ORD-1",
    reason: "",
    lines: [line()],
    ...overrides,
  };
}

function line(
  overrides: Partial<ReviewDocument["lines"][number]> = {},
): ReviewDocument["lines"][number] {
  const taxableValuePaise = overrides.taxableValuePaise ?? 10_000;
  return {
    description: "Test item",
    sku: "SKU-1",
    hsnSacCode: "1001",
    classificationDescription: "Test goods",
    taxClassification: ProductTaxClassification.TAXABLE,
    quantity: 1,
    uqc: "NOS",
    unitPricePaise: taxableValuePaise,
    grossValuePaise: taxableValuePaise,
    discountPaise: 0,
    taxableValuePaise,
    gstRatePercent: 18,
    cgstPaise: Math.round(taxableValuePaise * 0.09),
    sgstPaise: Math.round(taxableValuePaise * 0.09),
    igstPaise: 0,
    cessPaise: 0,
    totalTaxPaise: Math.round(taxableValuePaise * 0.18),
    lineValuePaise: Math.round(taxableValuePaise * 1.18),
    ...overrides,
  };
}
