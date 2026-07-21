import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  GstComplianceStatus,
  GstrSupplySection,
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentStatus,
  TaxDocumentType,
  TaxSupplyType,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { GstComplianceService } from "./gst-compliance.service";

describe("GstComplianceService", () => {
  it("builds GSTR-3B, section, rate, state, GSTIN, and reconciliation summaries from issued documents", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([
      documentFixture(),
      documentFixture({
        id: "credit_1",
        documentNumber: "CN/26-27/000001",
        documentType: TaxDocumentType.CREDIT_NOTE,
        gstrSupplySection: GstrSupplySection.CDNR,
        originalDocument: { documentNumber: "TI/26-27/000001" },
      }),
    ]);
    const service = createService(prisma);

    const report = await service.report({}, "seller_1", true);

    expect(report.summary).toMatchObject({
      documentCount: 2,
      creditNoteCount: 1,
      debitNoteCount: 0,
      taxableValuePaise: 0,
      totalTaxPaise: 0,
    });
    expect(report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: GstrSupplySection.B2B, documentCount: 1 }),
        expect.objectContaining({ section: GstrSupplySection.CDNR, documentCount: 1 }),
      ]),
    );
    expect(report.rateLiability).toEqual([
      expect.objectContaining({ gstRatePercent: 18, taxableValuePaise: 0 }),
    ]);
    expect(report.stateLiability).toEqual([
      expect.objectContaining({ placeOfSupplyStateCode: "27", totalTaxPaise: 0 }),
    ]);
    expect(report.gstinSummary).toEqual([
      expect.objectContaining({ buyerGstin: "27ABCDE1234F1Z5", documentCount: 2 }),
    ]);
    expect(report.reconciliation).toMatchObject({
      errorCount: 0,
      readyToLock: true,
    });
  });

  it("creates a filing-oriented GSTR-1 JSON package without claiming direct upload readiness", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([documentFixture()]);
    const service = createService(prisma);
    const report = await service.report({}, "seller_1", true);

    const json = service.gstr1Json(report);

    expect(json).toMatchObject({
      gstin: "29ABCDE1234F1Z5",
      fp: "072026",
      uploadReady: false,
    });
    expect(json.b2b[0]).toMatchObject({
      ctin: "27ABCDE1234F1Z5",
      inv: [
        expect.objectContaining({
          inum: "TI/26-27/000001",
          pos: "27",
        }),
      ],
    });
  });

  it("returns complete admin overview totals without embedding every document", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([documentFixture()]);
    const service = createService(prisma);

    const overview = await service.adminOverview({ sellerId: "seller_1" });

    expect(overview).toMatchObject({
      documentTotal: 1,
      summary: { documentCount: 1, totalTaxPaise: 1800 },
      gstr1Counts: { B2B: 1 },
    });
    expect("documents" in overview).toBe(false);
    expect(prisma.client.taxDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sellerId: "seller_1" }),
      }),
    );
  });

  it("paginates and filters the issued GST document register deterministically", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([documentFixture()]);
    prisma.client.taxDocument.count.mockResolvedValue(26);
    const service = createService(prisma);

    const result = await service.documentPage(
      {
        page: "2",
        limit: "25",
        sellerId: "seller_1",
        documentType: TaxDocumentType.TAX_INVOICE,
        sellerTaxRegistrationStatus:
          SellerTaxRegistrationStatus.GST_REGISTERED,
        section: GstrSupplySection.B2B,
        taxClassification: ProductTaxClassification.TAXABLE,
        eInvoiceStatus: GstComplianceStatus.READY,
        search: "TI/26-27",
      } as unknown as Parameters<GstComplianceService["documentPage"]>[0],
    );

    expect(result).toMatchObject({
      total: 26,
      page: 2,
      limit: 25,
      totalPages: 2,
    });
    expect(result.items[0]).toMatchObject({
      documentNumber: "TI/26-27/000001",
      totalTaxPaise: 1800,
      buyerAddress: {
        line1: "2 Trade Road",
        stateCode: "27",
        postalCode: "400001",
      },
    });
    expect(prisma.client.taxDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        where: expect.objectContaining({
          sellerId: "seller_1",
          documentType: TaxDocumentType.TAX_INVOICE,
          sellerTaxRegistrationStatus:
            SellerTaxRegistrationStatus.GST_REGISTERED,
          gstrSupplySection: GstrSupplySection.B2B,
          lines: {
            some: {
              taxClassification: ProductTaxClassification.TAXABLE,
            },
          },
          compliance: { is: { eInvoiceStatus: GstComplianceStatus.READY } },
        }),
      }),
    );
  });

  it("forces seller document pagination to the authenticated seller", async () => {
    const prisma = createPrisma();
    prisma.client.seller.findUnique.mockResolvedValue({ id: "seller_1" });
    prisma.client.taxDocument.findMany.mockResolvedValue([documentFixture()]);
    const service = createService(prisma);

    await service.sellerDocumentPage(
      actor(),
      {
        page: 1,
        limit: 25,
        sellerId: "seller_2",
      } as unknown as Parameters<GstComplianceService["sellerDocumentPage"]>[1],
    );

    expect(prisma.client.taxDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sellerId: "seller_1" }),
      }),
    );
  });

  it("returns blank normalized address fields for malformed historical snapshots", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([
      documentFixture({ buyerAddressSnapshot: "legacy-address" }),
    ]);
    const service = createService(prisma);

    const report = await service.report({}, "seller_1", true);

    expect(report.documents[0]?.buyerAddress).toEqual({
      line1: "",
      line2: "",
      area: "",
      city: "",
      state: "",
      stateCode: "",
      postalCode: "",
      country: "",
      countryCode: "",
    });
  });

  it("keeps non-registered commercial invoices in the register but outside regular GSTR summaries", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([
      documentFixture({
        documentType: TaxDocumentType.COMMERCIAL_INVOICE,
        documentNumber: "CI/26-27/000001",
        sellerTaxRegistrationStatus:
          SellerTaxRegistrationStatus.NOT_REGISTERED,
        sellerGstin: null,
        gstrSupplySection: null,
        taxableValuePaise: 11800,
        igstPaise: 0,
        totalTaxPaise: 0,
        lines: [
          {
            ...documentFixture().lines[0],
            taxClassification: ProductTaxClassification.TAXABLE,
            gstRatePercent: 0,
            taxableValuePaise: 11800,
            igstPaise: 0,
            totalTaxPaise: 0,
          },
        ],
      }),
    ]);
    const service = createService(prisma);

    const report = await service.report({}, "seller_1", true);

    expect(report.summary).toMatchObject({
      documentCount: 1,
      totalTaxPaise: 0,
    });
    expect(report.documents[0]).toMatchObject({
      documentType: TaxDocumentType.COMMERCIAL_INVOICE,
      sellerTaxRegistrationStatus:
        SellerTaxRegistrationStatus.NOT_REGISTERED,
      gstrSupplySection: null,
    });
    expect(report.sections).toEqual([]);
    expect(report.hsnSummary).toEqual([]);
    expect(report.reconciliation).toMatchObject({
      errorCount: 0,
      readyToLock: true,
    });
  });

  it("does not flag nil/exempt adjustment notes as a GSTR section mismatch", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findMany.mockResolvedValue([
      documentFixture({
        id: "credit_nil_1",
        documentNumber: "CN/26-27/000002",
        documentType: TaxDocumentType.CREDIT_NOTE,
        gstrSupplySection: GstrSupplySection.NIL_EXEMPT_NON_GST,
        originalDocument: { documentNumber: "BS/26-27/000001" },
        taxableValuePaise: 11800,
        igstPaise: 0,
        totalTaxPaise: 0,
        lines: [
          {
            ...documentFixture().lines[0],
            taxClassification: ProductTaxClassification.NIL_RATED,
            gstRatePercent: 0,
            taxableValuePaise: 11800,
            igstPaise: 0,
            totalTaxPaise: 0,
          },
        ],
      }),
    ]);
    const service = createService(prisma);

    const report = await service.report({}, "seller_1", true);

    expect(report.reconciliation.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "GSTR_SECTION_MISMATCH" }),
      ]),
    );
  });

  it("blocks filing-period controls for sellers outside regular GST registration", async () => {
    const prisma = createPrisma();
    prisma.client.sellerProfile.findUnique.mockResolvedValue({
      taxRegistrationStatus: SellerTaxRegistrationStatus.COMPOSITION,
    });
    const service = createService(prisma);

    await expect(
      service.lockPeriod("seller_1", actor(), { returnPeriod: "072026" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("issues a seller-scoped debit note linked to an immutable invoice", async () => {
    const prisma = createPrisma();
    const tx = prisma.client;
    tx.taxDocument.findFirst.mockResolvedValue(documentFixture());
    tx.taxDocumentSequence.upsert.mockResolvedValue({ nextNumber: 2 });
    tx.taxDocument.create.mockResolvedValue({
      id: "debit_1",
      documentNumber: "DN/26-27/000001",
      lines: [],
    });
    const service = createService(prisma);

    const result = await service.createDebitNote(
      "seller_1",
      actor(),
      {
        originalDocumentId: "invoice_1",
        reason: "Post-sale value adjustment",
        lines: [
          {
            description: "Additional taxable value",
            hsnSacCode: "610910",
            quantity: 1,
            lineValuePaise: 11800,
            gstRatePercent: 18,
          },
        ],
      },
    );

    expect(result).toMatchObject({ documentNumber: "DN/26-27/000001" });
    expect(tx.taxDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: TaxDocumentType.DEBIT_NOTE,
          status: TaxDocumentStatus.ISSUED,
          originalDocumentId: "invoice_1",
          taxableValuePaise: 10000,
          igstPaise: 1800,
          gstrSupplySection: GstrSupplySection.CDNR,
        }),
      }),
    );
  });

  it("rejects positive GST on an exempt debit-note line", async () => {
    const prisma = createPrisma();
    prisma.client.taxDocument.findFirst.mockResolvedValue(documentFixture());
    const service = createService(prisma);

    await expect(
      service.createDebitNote("seller_1", actor(), {
        originalDocumentId: "invoice_1",
        reason: "Exempt adjustment",
        lines: [
          {
            description: "Exempt adjustment",
            taxClassification: ProductTaxClassification.EXEMPT,
            quantity: 1,
            lineValuePaise: 11800,
            gstRatePercent: 18,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new GstComplianceService(prisma as never, {
    calculateSplit: vi.fn(async () => ({
      commissionPaise: 0,
      gstOnCommissionPaise: 0,
      tdsPaise: 0,
      tcsPaise: 0,
      platformFeePaise: 0,
      netPayablePaise: 0,
    })),
  } as never);
}

function createPrisma() {
  const client = {
    seller: {
      findUnique: vi.fn(),
    },
    sellerProfile: {
      findUnique: vi.fn(),
    },
    setting: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    taxDocument: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    taxDocumentSequence: {
      upsert: vi.fn(),
    },
    taxDocumentCompliance: {
      upsert: vi.fn(),
    },
    gstFilingPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    marketplaceTaxDocument: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    orderSellerSplit: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(client),
    ),
  };
  return { client };
}

function documentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "invoice_1",
    documentNumber: "TI/26-27/000001",
    documentType: TaxDocumentType.TAX_INVOICE,
    status: TaxDocumentStatus.ISSUED,
    issueDate: new Date("2026-07-20T00:00:00.000Z"),
    supplyDate: new Date("2026-07-20T00:00:00.000Z"),
    financialYear: "26-27",
    orderId: "order_1",
    b2bOrderId: null,
    orderSellerSplitId: "split_1",
    sellerId: "seller_1",
    seller: { id: "seller_1", storeName: "Tax Ready Store" },
    sellerLegalName: "Tax Ready Store Private Limited",
    sellerTaxRegistrationStatus:
      SellerTaxRegistrationStatus.GST_REGISTERED,
    sellerGstin: "29ABCDE1234F1Z5",
    sellerAddressSnapshot: { stateCode: "29" },
    buyerLegalName: "Business Buyer",
    buyerGstin: "27ABCDE1234F1Z5",
    buyerAddressSnapshot: {
      line1: "2 Trade Road",
      city: "Mumbai",
      state: "Maharashtra",
      stateCode: "27",
      pincode: "400001",
      country: "India",
      countryCode: "IN",
    },
    placeOfSupplyStateCode: "27",
    supplyType: TaxSupplyType.INTER_STATE,
    gstrSupplySection: GstrSupplySection.B2B,
    reverseCharge: false,
    reason: null,
    currency: "INR",
    taxableValuePaise: 10000,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 1800,
    cessPaise: 0,
    totalTaxPaise: 1800,
    invoiceValuePaise: 11800,
    order: { orderNumber: "1HI-1" },
    b2bOrder: null,
    originalDocument: null,
    compliance: {
      eInvoiceStatus: GstComplianceStatus.READY,
      irn: null,
      acknowledgementNumber: null,
      acknowledgementDate: null,
      eInvoiceProvider: "MANUAL",
      eInvoiceError: null,
      eWayBillStatus: GstComplianceStatus.NOT_REQUIRED,
      eWayBillNumber: null,
      eWayBillGeneratedAt: null,
      eWayBillValidUntil: null,
      eWayBillProvider: "MANUAL",
      eWayBillError: null,
      lastSyncedAt: null,
    },
    lines: [
      {
        id: "line_1",
        lineType: "PRODUCT",
        description: "Cotton shirt",
        hsnSacCode: "610910",
        taxClassification: ProductTaxClassification.TAXABLE,
        quantity: 1,
        uqc: "NOS",
        gstRatePercent: 18,
        taxableValuePaise: 10000,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 1800,
        cessPaise: 0,
        totalTaxPaise: 1800,
        lineValuePaise: 11800,
      },
    ],
    ...overrides,
  };
}

function actor() {
  return {
    id: "user_1",
    clerkUserId: null,
    email: "seller@example.com",
    roles: [],
  };
}
