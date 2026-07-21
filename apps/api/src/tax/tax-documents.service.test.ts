import { BadRequestException } from "@nestjs/common";
import {
  B2BOrderStatus,
  GstrSupplySection,
  ProductTaxClassification,
  Prisma,
  SellerTaxRegistrationStatus,
  TaxDocumentSource,
  TaxDocumentStatus,
  TaxDocumentType,
  TaxSupplyType,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { TaxDocumentsService, type SellerTaxContext } from "./tax-documents.service";

const registeredSeller: SellerTaxContext = {
  sellerId: "seller_1",
  storeName: "Tax Ready Store",
  legalName: "Tax Ready Store Private Limited",
  registrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
  gstin: "29ABCDE1234F1Z5",
  address: {
    countryCode: "IN",
    stateCode: "29",
  },
};

describe("TaxDocumentsService", () => {
  it("lists only issued documents owned by the authenticated customer order", async () => {
    const client = {
      taxDocument: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "tax_doc_1",
            documentNumber: "TI/26-27/000001",
            documentType: TaxDocumentType.TAX_INVOICE,
            status: TaxDocumentStatus.ISSUED,
            issueDate: new Date("2026-07-20T10:00:00.000Z"),
            supplyDate: new Date("2026-07-20T09:00:00.000Z"),
            sellerLegalName: "Tax Ready Store Private Limited",
            sellerGstin: "29ABCDE1234F1Z5",
            currency: "INR",
            invoiceValuePaise: 11800,
            totalTaxPaise: 1800,
            originalDocument: null,
          },
        ]),
      },
    };
    const service = new TaxDocumentsService({ client } as never);

    const result = await service.listCustomerOrderDocuments("user_customer_1", "ORD-1001");

    expect(client.taxDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: TaxDocumentStatus.ISSUED,
          order: {
            orderNumber: "ORD-1001",
            customer: { userId: "user_customer_1" },
          },
        },
      }),
    );
    expect(result[0]).toMatchObject({
      id: "tax_doc_1",
      label: "Tax Invoice",
      downloadFileName: "TI-26-27-000001.pdf",
    });
  });

  it("rejects a PDF request when the document is not owned by the customer", async () => {
    const client = {
      taxDocument: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new TaxDocumentsService({ client } as never);

    await expect(
      service.customerOrderDocumentPdf("user_customer_1", "ORD-1001", "tax_doc_other"),
    ).rejects.toThrow("Purchase document not found.");
  });

  it("downloads an issued B2B seller document and records a minimal audit event", async () => {
    const client = {
      taxDocument: {
        findFirst: vi.fn().mockResolvedValue(pdfDocumentFixture({ order: null })),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new TaxDocumentsService({ client } as never);

    const result = await service.sellerDocumentPdf("user_seller_1", "tax_doc_1");

    expect(result.fileName).toBe("TI-26-27-000001.pdf");
    expect(result.buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(client.taxDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "tax_doc_1",
          status: TaxDocumentStatus.ISSUED,
          seller: { userId: "user_seller_1" },
        },
      }),
    );
    expect(client.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_seller_1",
        action: "GST_TAX_DOCUMENT_PDF_DOWNLOADED",
        entityType: "TaxDocument",
        entityId: "tax_doc_1",
        newValue: {
          accessRole: "SELLER",
          sellerId: "seller_1",
        },
      },
    });
  });

  it("returns not found for a foreign, draft, or missing seller tax document", async () => {
    const client = {
      taxDocument: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new TaxDocumentsService({ client } as never);

    await expect(
      service.sellerDocumentPdf("user_seller_1", "tax_doc_other"),
    ).rejects.toThrow("Tax document not found.");
  });

  it("allows an admin to download any issued tax document", async () => {
    const client = {
      taxDocument: {
        findFirst: vi.fn().mockResolvedValue(pdfDocumentFixture()),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new TaxDocumentsService({ client } as never);

    await service.adminDocumentPdf("user_admin_1", "tax_doc_1");

    expect(client.taxDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "tax_doc_1",
          status: TaxDocumentStatus.ISSUED,
        },
      }),
    );
    expect(client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "user_admin_1",
          newValue: expect.objectContaining({ accessRole: "ADMIN" }),
        }),
      }),
    );
  });

  it("issues a numbered SAC tax invoice for a completed service booking", async () => {
    const tx = {
      serviceBooking: {
        findUnique: vi.fn().mockResolvedValue({
          id: "service_booking_1",
          sellerId: "seller_1",
          status: "COMPLETED",
          completionConfirmedAt: new Date("2026-07-21T10:00:00.000Z"),
          sellerTaxRegistrationStatusSnapshot: SellerTaxRegistrationStatus.GST_REGISTERED,
          sellerLegalNameSnapshot: "Tax Ready Services Private Limited",
          sellerGstinSnapshot: "29ABCDE1234F1Z5",
          sellerAddressSnapshot: { line1: "1 Service Road", stateCode: "29" },
          buyerLegalNameSnapshot: "Customer",
          buyerGstinSnapshot: null,
          buyerAddressSnapshot: { line1: "2 Buyer Road", stateCode: "29" },
          serviceTaxClassificationSnapshot: ProductTaxClassification.TAXABLE,
          sacCodeSnapshot: "998719",
          gstRatePercentSnapshot: new Prisma.Decimal(18),
          taxSupplyTypeSnapshot: TaxSupplyType.INTRA_STATE,
          placeOfSupplyStateCodeSnapshot: "29",
          taxableValuePaise: 10000,
          cgstPaise: 900,
          sgstPaise: 900,
          igstPaise: 0,
          cessPaise: 0,
          taxTotalPaise: 1800,
          totalPayablePaise: 11800,
          currency: "INR",
          listing: { title: "Equipment repair" },
          taxDocuments: [],
        }),
      },
      taxDocumentSequence: {
        upsert: vi.fn().mockResolvedValue({ nextNumber: 2 }),
      },
      taxDocument: {
        create: vi.fn().mockResolvedValue({ id: "service_tax_doc_1" }),
      },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    await new TaxDocumentsService({ client } as never).issueServiceBookingDocument(
      "service_booking_1",
      "issuer_1",
    );

    expect(tx.taxDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentNumber: "TI/26-27/000001",
        documentType: TaxDocumentType.TAX_INVOICE,
        source: TaxDocumentSource.SERVICE_BOOKING,
        serviceBooking: { connect: { id: "service_booking_1" } },
        totalTaxPaise: 1800,
        lines: {
          create: expect.objectContaining({
            lineType: "SERVICE",
            hsnSacCode: "998719",
            gstRatePercent: new Prisma.Decimal(18),
          }),
        },
      }),
    });
  });

  it("extracts 18 percent inclusive GST into equal CGST and SGST", () => {
    const service = createService();

    const snapshot = service.orderItemSnapshot({
      lineTotalPaise: 11800,
      discountPaise: 0,
      hsnCode: "610910",
      gstRatePercent: new Prisma.Decimal(18),
      seller: registeredSeller,
      buyerAddress: { countryCode: "IN", stateCode: "29" },
    });

    expect(snapshot).toMatchObject({
      taxSupplyTypeSnapshot: TaxSupplyType.INTRA_STATE,
      grossTaxableConsiderationPaise: 11800,
      taxableValuePaise: 10000,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
      taxTotalPaise: 1800,
    });
  });

  it("extracts 18 percent inclusive GST as IGST for interstate supplies", () => {
    const service = createService();

    const snapshot = service.orderItemSnapshot({
      lineTotalPaise: 11800,
      discountPaise: 0,
      hsnCode: "610910",
      gstRatePercent: 18,
      seller: registeredSeller,
      buyerAddress: { countryCode: "IN", stateCode: "27" },
    });

    expect(snapshot).toMatchObject({
      taxSupplyTypeSnapshot: TaxSupplyType.INTER_STATE,
      taxableValuePaise: 10000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 1800,
      taxTotalPaise: 1800,
    });
  });

  it.each([
    { hsnCode: null, gstRatePercent: 18 },
    { hsnCode: "610910", gstRatePercent: null },
  ])(
    "rejects taxable checkout when a registered seller product lacks approved GST data",
    ({ hsnCode, gstRatePercent }) => {
      const service = createService();

      expect(() =>
        service.orderItemSnapshot({
          lineTotalPaise: 11800,
          discountPaise: 0,
          hsnCode,
          gstRatePercent,
          seller: registeredSeller,
          buyerAddress: { countryCode: "IN", stateCode: "29" },
        }),
      ).toThrowError(BadRequestException);
    },
  );

  it("keeps a taxable product commercial when the seller is not GST registered", () => {
    const service = createService();
    const snapshot = service.orderItemSnapshot({
      lineTotalPaise: 11800,
      discountPaise: 0,
      hsnCode: "610910",
      gstRatePercent: 18,
      taxClassification: ProductTaxClassification.TAXABLE,
      seller: {
        ...registeredSeller,
        registrationStatus: SellerTaxRegistrationStatus.NOT_REGISTERED,
        gstin: null,
      },
      buyerAddress: { countryCode: "IN", stateCode: "29" },
    });

    expect(snapshot).toMatchObject({
      supplierTaxRegistrationStatusSnapshot:
        SellerTaxRegistrationStatus.NOT_REGISTERED,
      productTaxClassificationSnapshot: ProductTaxClassification.TAXABLE,
      gstRatePercentSnapshot: new Prisma.Decimal(0),
      taxTotalPaise: 0,
    });
  });

  it("does not collect regular GST from a composition seller", () => {
    const service = createService();
    const snapshot = service.orderItemSnapshot({
      lineTotalPaise: 11800,
      discountPaise: 0,
      hsnCode: "610910",
      gstRatePercent: 18,
      taxClassification: ProductTaxClassification.TAXABLE,
      seller: {
        ...registeredSeller,
        registrationStatus: SellerTaxRegistrationStatus.COMPOSITION,
      },
      buyerAddress: { countryCode: "IN", stateCode: "29" },
    });

    expect(snapshot.taxTotalPaise).toBe(0);
    expect(snapshot.supplierTaxRegistrationStatusSnapshot).toBe(
      SellerTaxRegistrationStatus.COMPOSITION,
    );
  });

  it("keeps registered nil-rated supplies separate from unregistered sellers", () => {
    const service = createService();
    const snapshot = service.orderItemSnapshot({
      lineTotalPaise: 11800,
      discountPaise: 0,
      hsnCode: "100100",
      gstRatePercent: 0,
      taxClassification: ProductTaxClassification.NIL_RATED,
      seller: registeredSeller,
      buyerAddress: { countryCode: "IN", stateCode: "29" },
    });

    expect(snapshot).toMatchObject({
      supplierTaxRegistrationStatusSnapshot:
        SellerTaxRegistrationStatus.GST_REGISTERED,
      productTaxClassificationSnapshot: ProductTaxClassification.NIL_RATED,
      gstRatePercentSnapshot: new Prisma.Decimal(0),
      taxTotalPaise: 0,
    });
  });

  it("rejects a not-registered seller that still supplies a GSTIN", () => {
    const service = createService();

    expect(() =>
      service.orderItemSnapshot({
        lineTotalPaise: 11800,
        discountPaise: 0,
        hsnCode: "610910",
        gstRatePercent: 18,
        taxClassification: ProductTaxClassification.TAXABLE,
        seller: {
          ...registeredSeller,
          registrationStatus: SellerTaxRegistrationStatus.NOT_REGISTERED,
        },
        buyerAddress: { countryCode: "IN", stateCode: "29" },
      }),
    ).toThrowError(BadRequestException);
  });

  it.each([
    {
      name: "regular GST taxable",
      registrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
      sellerGstin: "29ABCDE1234F1Z5",
      taxClassification: ProductTaxClassification.TAXABLE,
      gstRatePercent: 18,
      expectedDocumentType: TaxDocumentType.TAX_INVOICE,
      expectedGstrSection: GstrSupplySection.B2B,
      expectedTaxPaise: 1980,
    },
    {
      name: "composition taxable",
      registrationStatus: SellerTaxRegistrationStatus.COMPOSITION,
      sellerGstin: "29ABCDE1234F1Z5",
      taxClassification: ProductTaxClassification.TAXABLE,
      gstRatePercent: 18,
      expectedDocumentType: TaxDocumentType.BILL_OF_SUPPLY,
      expectedGstrSection: null,
      expectedTaxPaise: 0,
    },
    {
      name: "not registered taxable",
      registrationStatus: SellerTaxRegistrationStatus.NOT_REGISTERED,
      sellerGstin: null,
      taxClassification: ProductTaxClassification.TAXABLE,
      gstRatePercent: 18,
      expectedDocumentType: TaxDocumentType.COMMERCIAL_INVOICE,
      expectedGstrSection: null,
      expectedTaxPaise: 0,
    },
    {
      name: "regular GST nil-rated",
      registrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
      sellerGstin: "29ABCDE1234F1Z5",
      taxClassification: ProductTaxClassification.NIL_RATED,
      gstRatePercent: 0,
      expectedDocumentType: TaxDocumentType.BILL_OF_SUPPLY,
      expectedGstrSection: GstrSupplySection.NIL_EXEMPT_NON_GST,
      expectedTaxPaise: 0,
    },
  ])(
    "issues the correct B2B document for $name supplies",
    async ({
      registrationStatus,
      sellerGstin,
      taxClassification,
      gstRatePercent,
      expectedDocumentType,
      expectedGstrSection,
      expectedTaxPaise,
    }) => {
      const { client, tx } = createB2bDocumentClient({
        registrationStatus,
        sellerGstin,
        taxClassification,
        gstRatePercent,
      });
      const service = new TaxDocumentsService({ client } as never);

      await service.issueB2bDocument("b2b_order_1", "issuer_1");

      expect(tx.taxDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: expectedDocumentType,
            source: TaxDocumentSource.B2B_FULFILMENT,
            sellerTaxRegistrationStatus: registrationStatus,
            sellerGstin,
            gstrSupplySection: expectedGstrSection,
            totalTaxPaise: expectedTaxPaise,
            invoiceValuePaise: 12980,
          }),
        }),
      );
      expect(tx.taxDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaxDocumentStatus.ISSUED,
            issuedById: "issuer_1",
          }),
        }),
      );
    },
  );

  it.each([
    {
      buyerGstin: "27ABCDE1234F1Z5",
      sellerGstin: "29ABCDE1234F1Z5",
      expectedSection: GstrSupplySection.CDNR,
    },
    {
      buyerGstin: null,
      sellerGstin: "29ABCDE1234F1Z5",
      expectedSection: GstrSupplySection.CDNUR,
    },
    {
      buyerGstin: null,
      sellerGstin: null,
      expectedSection: null,
    },
  ])(
    "classifies credit notes as $expectedSection",
    async ({ buyerGstin, sellerGstin, expectedSection }) => {
      const tx = createCreditNoteTx(buyerGstin, sellerGstin);
      const service = createService();

      await service.createCreditNotesForRefund(tx as never, "refund_1", "issuer_1");

      expect(tx.taxDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: TaxDocumentType.CREDIT_NOTE,
            status: TaxDocumentStatus.DRAFT,
            gstrSupplySection: expectedSection,
          }),
        }),
      );
      expect(tx.taxDocument.update).toHaveBeenCalledWith({
        where: { id: "credit_note_1" },
        data: {
          status: TaxDocumentStatus.ISSUED,
          issueDate: expect.any(Date),
          issuedById: "issuer_1",
        },
      });
    },
  );

  it("creates an idempotent B2B credit note against the remaining invoice value", async () => {
    const tx = {
      taxDocument: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({
          id: "invoice_1",
          financialYear: "26-27",
          sellerId: "seller_1",
          documentNumber: "TI/26-27/000001",
          invoiceValuePaise: 23600,
          supplyDate: new Date("2026-07-20T09:00:00.000Z"),
          sellerLegalName: "Tax Ready Store Private Limited",
          sellerTaxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
          sellerGstin: "29ABCDE1234F1Z5",
          sellerAddressSnapshot: { stateCode: "29" },
          buyerLegalName: "Registered Buyer Private Limited",
          buyerGstin: "27ABCDE1234F1Z5",
          buyerAddressSnapshot: { stateCode: "27" },
          placeOfSupplyStateCode: "27",
          supplyType: TaxSupplyType.INTER_STATE,
          gstrSupplySection: GstrSupplySection.B2B,
          reverseCharge: false,
          currency: "INR",
          lines: [
            {
              hsnSacCode: "610910",
              taxClassification: ProductTaxClassification.TAXABLE,
              gstRatePercent: new Prisma.Decimal(18),
            },
          ],
        }),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { invoiceValuePaise: 11800 },
        }),
        create: vi.fn().mockResolvedValue({ id: "credit_note_1" }),
      },
      taxDocumentSequence: {
        upsert: vi.fn().mockResolvedValue({ nextNumber: 2 }),
      },
    };
    const service = createService();

    await service.createB2bCreditNote(tx as never, {
      b2bOrderId: "b2b_order_1",
      originalDocumentId: "invoice_1",
      amountPaise: 11800,
      reason: "Accepted damaged quantity",
      actorUserId: "admin_1",
      idempotencyKey: "dispute-credit-1",
      line: {
        description: "Cotton shirt adjustment",
        hsnSacCode: "610910",
        taxClassification: ProductTaxClassification.TAXABLE,
        quantity: 1,
        gstRatePercent: 18,
      },
    });

    expect(tx.taxDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: TaxDocumentType.CREDIT_NOTE,
          source: TaxDocumentSource.MANUAL_ADJUSTMENT,
          b2bOrderId: "b2b_order_1",
          originalDocumentId: "invoice_1",
          gstrSupplySection: GstrSupplySection.CDNR,
          taxableValuePaise: 10000,
          igstPaise: 1800,
          invoiceValuePaise: 11800,
          lines: {
            create: expect.objectContaining({
              taxableValuePaise: 10000,
              igstPaise: 1800,
              lineValuePaise: 11800,
            }),
          },
        }),
      }),
    );
  });
});

function createService() {
  return new TaxDocumentsService({ client: {} } as never);
}

function pdfDocumentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "tax_doc_1",
    documentNumber: "TI/26-27/000001",
    documentType: TaxDocumentType.TAX_INVOICE,
    issueDate: new Date("2026-07-20T10:00:00.000Z"),
    supplyDate: new Date("2026-07-20T09:00:00.000Z"),
    sellerId: "seller_1",
    sellerLegalName: "Tax Ready Store Private Limited",
    sellerTaxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
    sellerGstin: "29ABCDE1234F1Z5",
    sellerAddressSnapshot: { line1: "1 Market Road", stateCode: "29" },
    buyerLegalName: "Registered Buyer Private Limited",
    buyerGstin: "27ABCDE1234F1Z5",
    buyerAddressSnapshot: { line1: "2 Trade Road", stateCode: "27" },
    placeOfSupplyStateCode: "27",
    supplyType: TaxSupplyType.INTER_STATE,
    reverseCharge: false,
    currency: "INR",
    taxableValuePaise: 10000,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 1800,
    cessPaise: 0,
    totalTaxPaise: 1800,
    invoiceValuePaise: 11800,
    reason: null,
    originalDocument: null,
    order: { orderNumber: "1HI-1" },
    b2bOrder: { orderNumber: "B2B-1" },
    lines: [
      {
        description: "Cotton shirt",
        sku: "SHIRT-1",
        hsnSacCode: "610910",
        taxClassification: ProductTaxClassification.TAXABLE,
        quantity: 1,
        uqc: "NOS",
        taxableValuePaise: 10000,
        gstRatePercent: new Prisma.Decimal(18),
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 1800,
        cessPaise: 0,
        lineValuePaise: 11800,
      },
    ],
    compliance: null,
    ...overrides,
  };
}

function createCreditNoteTx(
  buyerGstin: string | null,
  sellerGstin: string | null,
) {
  return {
    refundRequest: {
      findUnique: vi.fn().mockResolvedValue({
        id: "refund_1",
        orderId: "order_1",
        returnRequestId: "return_1",
        refundNumber: "RF-1",
        currency: "INR",
        note: "Approved return",
        items: [
          {
            id: "refund_item_1",
            sellerId: "seller_1",
            returnRequestItemId: "return_item_1",
            orderItemId: "order_item_1",
            quantity: 1,
            amountPaise: 11800,
            platformFundedCouponAdjustmentPaise: 0,
            orderItem: {
              quantity: 1,
              productNameSnapshot: "Taxed product",
              variantSnapshot: { sku: "SKU-1" },
              hsnCodeSnapshot: "610910",
              gstRatePercentSnapshot: new Prisma.Decimal(18),
              productTaxClassificationSnapshot: ProductTaxClassification.TAXABLE,
              taxSupplyTypeSnapshot: TaxSupplyType.INTER_STATE,
              grossTaxableConsiderationPaise: 11800,
            },
            returnRequestItem: { id: "return_item_1" },
          },
        ],
      }),
    },
    seller: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "seller_1",
          storeName: "Tax Ready Store",
          profile: {
            businessLegalName: "Tax Ready Store Private Limited",
            taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
            gstNumber: "29ABCDE1234F1Z5",
          },
          addresses: [
            {
              line1: "1 Market Road",
              line2: null,
              area: "Central",
              city: "Bengaluru",
              state: "Karnataka",
              pincode: "560001",
              country: "India",
              countryCode: "IN",
              stateCode: "29",
            },
          ],
        },
      ]),
    },
    taxDocument: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue({
        id: "invoice_1",
        orderSellerSplitId: "split_1",
        financialYear: "26-27",
        supplyDate: new Date("2026-07-01T00:00:00.000Z"),
        sellerLegalName: "Tax Ready Store Private Limited",
        sellerTaxRegistrationStatus: sellerGstin
          ? SellerTaxRegistrationStatus.GST_REGISTERED
          : SellerTaxRegistrationStatus.NOT_REGISTERED,
        sellerGstin,
        sellerAddressSnapshot: { stateCode: "29" },
        buyerLegalName: "Business Buyer",
        buyerGstin,
        buyerAddressSnapshot: { stateCode: "27" },
        placeOfSupplyStateCode: "27",
        supplyType: TaxSupplyType.INTER_STATE,
        gstrSupplySection: sellerGstin
          ? buyerGstin
            ? GstrSupplySection.B2B
            : GstrSupplySection.B2CS
          : null,
        reverseCharge: false,
      }),
      create: vi.fn().mockResolvedValue({ id: "credit_note_1" }),
      update: vi.fn().mockResolvedValue({ id: "credit_note_1" }),
    },
    taxDocumentSequence: {
      upsert: vi.fn().mockResolvedValue({ nextNumber: 2 }),
    },
  };
}

function createB2bDocumentClient(input: {
  registrationStatus: SellerTaxRegistrationStatus;
  sellerGstin: string | null;
  taxClassification: ProductTaxClassification;
  gstRatePercent: number;
}) {
  const tx = {
    taxDocument: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "b2b_tax_document_1" }),
      update: vi.fn().mockResolvedValue({
        id: "b2b_tax_document_1",
        documentNumber: "DOC/26-27/000001",
        status: TaxDocumentStatus.ISSUED,
        issueDate: new Date("2026-07-20T10:00:00.000Z"),
        lines: [],
      }),
    },
    b2BOrder: {
      findUnique: vi.fn().mockResolvedValue({
        id: "b2b_order_1",
        status: B2BOrderStatus.FULFILLED,
        sellerId: "seller_1",
        productId: "product_1",
        quantity: 1,
        unitPricePaise: 11800,
        subtotalPaise: 11800,
        transportChargePaise: 1180,
        currency: "INR",
        fulfilledAt: new Date("2026-07-20T09:00:00.000Z"),
        product: {
          name: "B2B product",
          hsnCode: "610910",
          gstRatePercent: new Prisma.Decimal(input.gstRatePercent),
          taxClassification: input.taxClassification,
        },
        seller: {
          id: "seller_1",
          storeName: "Tax Ready Store",
          profile: {
            businessLegalName: "Tax Ready Store Private Limited",
            taxRegistrationStatus: input.registrationStatus,
            gstNumber: input.sellerGstin,
          },
          addresses: [
            {
              line1: "1 Market Road",
              line2: null,
              area: "Central",
              city: "Bengaluru",
              state: "Karnataka",
              pincode: "560001",
              country: "India",
              countryCode: "IN",
              stateCode: "29",
            },
          ],
        },
        businessBuyer: {
          companyName: "Registered Buyer Private Limited",
          gstNumber: "29AAACB1234C1Z7",
          addresses: [
            {
              line1: "2 Trade Road",
              line2: null,
              area: "Central",
              city: "Bengaluru",
              state: "Karnataka",
              pincode: "560002",
              country: "India",
              countryCode: "IN",
              stateCode: "29",
            },
          ],
        },
      }),
    },
    taxDocumentSequence: {
      upsert: vi.fn().mockResolvedValue({ nextNumber: 2 }),
    },
  };

  return {
    tx,
    client: {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    },
  };
}
