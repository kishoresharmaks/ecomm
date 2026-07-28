import {
  B2BDisputeResolutionType,
  B2BFinancialReconciliationStatus,
  B2BFulfilmentSource,
  B2BFulfilmentStatus,
  B2BOrderAmendmentStatus,
  B2BOrderStatus,
  B2BPaymentMethod,
  B2BPaymentRecordStatus,
  B2BPaymentScheduleStatus,
  B2BPaymentStatus,
  B2BReceivableStatus,
  B2BSupportCaseType,
  B2BSupportCaseStatus,
  ProductTaxClassification,
  TaxDocumentStatus,
  TaxDocumentType,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { B2BOperationsService } from "./b2b-operations.service";

describe("B2BOperationsService online payments and exports", () => {
  const prisma = {
    client: {
      b2BPaymentRecord: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      b2BMutationRecord: {
        findUnique: vi.fn(),
      },
      b2BPaymentAllocation: {
        findMany: vi.fn(),
      },
      b2BPaymentProof: {
        findMany: vi.fn(),
      },
      b2BSupportCase: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      b2BErpExportJob: {
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
  const payments = {
    createRazorpayProviderOrder: vi.fn(),
    razorpayCheckoutPublicKey: vi.fn(),
    verifyRazorpayProviderPayment: vi.fn(),
  };
  const storage = {
    saveB2BErpExport: vi.fn(),
  };
  const taxDocuments = {
    createB2bCreditNote: vi.fn(),
  };
  const actor = {
    id: "00000000-0000-4000-8000-000000000001",
    roles: ["BUSINESS_BUYER"],
  };
  const order = {
    id: "00000000-0000-4000-8000-000000000010",
    orderNumber: "B2B-1001",
    status: B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
    version: 3,
    currency: "INR",
    buyerPayableAmountPaise: 100_000,
    paidAmountPaise: 0,
    paymentStatus: B2BPaymentStatus.PENDING,
    paymentSchedules: [
      {
        id: "00000000-0000-4000-8000-000000000020",
        amountPaise: 100_000,
        paidAmountPaise: 0,
        status: B2BPaymentScheduleStatus.DUE,
      },
    ],
  };
  let service: B2BOperationsService;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.B2B_ORDER_TO_CASH_V2_ENABLED = "true";
    service = new B2BOperationsService(
      prisma as never,
      storage as never,
      taxDocuments as never,
      payments as never,
    );
    vi.spyOn(service, "getOrder").mockResolvedValue(order as never);
    prisma.client.b2BMutationRecord.findUnique.mockResolvedValue(null);
  });

  it("creates one provider order for an idempotent B2B UPI payment request", async () => {
    const payment = {
      id: "00000000-0000-4000-8000-000000000030",
      b2bOrderId: order.id,
      idempotencyKey: "b2b-upi-payment-request",
      requestedScheduleId: order.paymentSchedules[0]!.id,
      method: B2BPaymentMethod.UPI,
      status: B2BPaymentRecordStatus.SUBMITTED,
      amountPaise: 100_000,
      currency: "INR",
      providerOrderId: null,
    };
    prisma.client.b2BPaymentRecord.findUnique.mockResolvedValue(null);
    prisma.client.b2BPaymentRecord.create.mockResolvedValue(payment);
    prisma.client.b2BPaymentRecord.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.client.b2BPaymentRecord.findUniqueOrThrow.mockResolvedValue({
      ...payment,
      providerOrderId: "order_b2b_1",
    });
    payments.createRazorpayProviderOrder.mockResolvedValue({
      keyId: "rzp_test_public",
      razorpayOrderId: "order_b2b_1",
      amountPaise: 100_000,
      currency: "INR",
      providerStatus: "created",
    });

    const result = await service.createOnlinePayment(
      actor as never,
      order.orderNumber,
      "b2b-upi-payment-request",
      {
        method: B2BPaymentMethod.UPI,
        amountPaise: 100_000,
        paymentScheduleId: order.paymentSchedules[0]!.id,
      },
    );

    expect(payments.createRazorpayProviderOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaise: 100_000,
        receipt: order.orderNumber,
        notes: expect.objectContaining({
          b2bPaymentRecordId: payment.id,
          paymentMethod: B2BPaymentMethod.UPI,
        }),
      }),
    );
    expect(result).toMatchObject({
      paymentRecordId: payment.id,
      razorpayOrderId: "order_b2b_1",
      paymentMethod: B2BPaymentMethod.UPI,
    });
  });

  it("settles only a captured provider payment and invokes allocation once", async () => {
    const payment = {
      id: "00000000-0000-4000-8000-000000000031",
      b2bOrderId: order.id,
      requestedScheduleId: order.paymentSchedules[0]!.id,
      method: B2BPaymentMethod.UPI,
      status: B2BPaymentRecordStatus.SUBMITTED,
      amountPaise: 100_000,
      currency: "INR",
      providerOrderId: "order_b2b_2",
      providerPaymentId: null,
      referenceNumber: "order_b2b_2",
      allocations: [],
      order: {
        ...order,
        receivable: null,
      },
    };
    prisma.client.b2BPaymentRecord.findFirst.mockResolvedValue(payment);
    payments.verifyRazorpayProviderPayment.mockResolvedValue({
      providerPaymentId: "pay_b2b_2",
      providerOrderId: "order_b2b_2",
      amountPaise: 100_000,
      currency: "INR",
      status: "captured",
      method: "card",
      captured: true,
      payload: { status: "captured" },
    });
    const tx = {
      b2BPaymentRecord: {
        findUnique: vi.fn().mockResolvedValue(payment),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    prisma.client.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const internals = service as unknown as {
      allocatePayment: (...args: unknown[]) => Promise<number>;
      recordMutation: (...args: unknown[]) => Promise<unknown>;
      enqueueOutbox: (...args: unknown[]) => Promise<void>;
    };
    const allocate = vi.spyOn(internals, "allocatePayment").mockResolvedValue(0);
    vi.spyOn(internals, "recordMutation").mockResolvedValue({});
    vi.spyOn(internals, "enqueueOutbox").mockResolvedValue();

    await service.verifyOnlinePayment(
      actor as never,
      order.orderNumber,
      "verify-b2b-online-payment",
      {
        paymentRecordId: payment.id,
        razorpayOrderId: "order_b2b_2",
        razorpayPaymentId: "pay_b2b_2",
        razorpaySignature: "a".repeat(64),
      },
    );

    expect(tx.b2BPaymentRecord.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: expect.objectContaining({
        status: B2BPaymentRecordStatus.CLEARED,
        method: B2BPaymentMethod.RAZORPAY,
        providerPaymentId: "pay_b2b_2",
        providerMethod: "card",
      }),
    });
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it("allocates the requested schedule first and preserves an overpayment balance", async () => {
    const tx = {
      b2BPaymentAllocation: { create: vi.fn().mockResolvedValue({}) },
      b2BPaymentSchedule: {
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(1),
      },
      b2BPaymentRecord: { update: vi.fn().mockResolvedValue({}) },
      b2BOrder: { update: vi.fn().mockResolvedValue({}) },
      b2BReceiptVoucher: {
        create: vi.fn().mockResolvedValue({ voucherNumber: "RV-1001" }),
      },
    };
    const internals = service as unknown as {
      allocatePayment: (client: unknown, payment: unknown) => Promise<number>;
      enqueueOutbox: (...args: unknown[]) => Promise<void>;
    };
    vi.spyOn(internals, "enqueueOutbox").mockResolvedValue();

    const unallocatedAmountPaise = await internals.allocatePayment(tx, {
      id: "00000000-0000-4000-8000-000000000032",
      b2bOrderId: order.id,
      requestedScheduleId: "schedule-2",
      method: B2BPaymentMethod.RAZORPAY,
      amountPaise: 1700,
      referenceNumber: "pay-over",
      order: {
        paidAmountPaise: 0,
        buyerPayableAmountPaise: 2000,
        paymentStatus: B2BPaymentStatus.PENDING,
        status: B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
        version: 1,
        paymentSchedules: [
          {
            id: "schedule-1",
            amountPaise: 1000,
            paidAmountPaise: 0,
            fulfilmentGate: true,
            status: B2BPaymentScheduleStatus.DUE,
          },
          {
            id: "schedule-2",
            amountPaise: 400,
            paidAmountPaise: 0,
            fulfilmentGate: false,
            status: B2BPaymentScheduleStatus.DUE,
          },
        ],
        receivable: null,
      },
    });

    const allocationCalls = tx.b2BPaymentAllocation.create.mock.calls;
    expect(allocationCalls[0]?.[0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentScheduleId: "schedule-2",
          amountPaise: 400,
        }),
      }),
    );
    expect(unallocatedAmountPaise).toBe(300);
  });

  it("persists ERP export content with row count and a SHA-256 hash", async () => {
    prisma.client.b2BErpExportJob.create.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000040",
      exportNumber: "ERP-1001",
    });
    storage.saveB2BErpExport.mockResolvedValue({
      provider: "local",
      assetKey: "1handindia/b2b/erp-exports/ERP-1001/orders.csv",
    });
    prisma.client.b2BErpExportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "00000000-0000-4000-8000-000000000040",
        ...data,
      }),
    );
    vi.spyOn(service, "erpOrderExport").mockResolvedValue({
      fileName: "b2b-orders.csv",
      contentType: "text/csv; charset=utf-8",
      content: "orderNumber,status\r\nB2B-1001,CLOSED",
      rowCount: 1,
    });

    await service.createErpOrderExportJob(actor as never, {}, "csv");

    expect(prisma.client.b2BErpExportJob.update).toHaveBeenCalledWith({
      where: { id: "00000000-0000-4000-8000-000000000040" },
      data: expect.objectContaining({
        status: "COMPLETED",
        rowCount: 1,
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        fileKey: "1handindia/b2b/erp-exports/ERP-1001/orders.csv",
        legacyContent: null,
      }),
      select: expect.any(Object),
    });
  });

  it("blocks changing a fulfilment source after its procurement order exists", async () => {
    vi.spyOn(
      service as unknown as {
        assertSellerPermission: (...args: unknown[]) => Promise<void>;
      },
      "assertSellerPermission",
    ).mockResolvedValue();
    vi.spyOn(service, "getOrder").mockResolvedValue({
      ...order,
      sellerId: "00000000-0000-4000-8000-000000000050",
      status: B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000051",
          lineNumber: 1,
          quantity: 10,
          productVariantId: "00000000-0000-4000-8000-000000000052",
          fulfilmentPlan: {
            id: "00000000-0000-4000-8000-000000000053",
            source: B2BFulfilmentSource.PROCURE,
            procurementOrder: {
              id: "00000000-0000-4000-8000-000000000054",
            },
            productionJob: null,
          },
        },
      ],
    } as never);
    const tx = {
      b2BFulfilmentPlan: {
        upsert: vi.fn(),
      },
    };
    prisma.client.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service.upsertFulfilmentPlans(
        actor as never,
        order.orderNumber,
        "change-procurement-source",
        {
          version: order.version,
          lines: [
            {
              orderLineId: "00000000-0000-4000-8000-000000000051",
              source: B2BFulfilmentSource.PRODUCE,
              plannedQuantity: 10,
            },
          ],
        },
      ),
    ).rejects.toThrow(
      "must remain procurement-sourced because a procurement order already exists",
    );
    expect(tx.b2BFulfilmentPlan.upsert).not.toHaveBeenCalled();
  });

  it("keeps mixed procurement and production orders in the broad fulfilment state", async () => {
    vi.spyOn(
      service as unknown as {
        assertSellerPermission: (...args: unknown[]) => Promise<void>;
      },
      "assertSellerPermission",
    ).mockResolvedValue();
    vi.spyOn(service, "getOrder").mockResolvedValue({
      ...order,
      sellerId: "00000000-0000-4000-8000-000000000060",
      status: B2BOrderStatus.IN_FULFILMENT,
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000061",
          lineNumber: 1,
          quantity: 4,
          productVariantId: null,
          fulfilmentPlan: null,
        },
        {
          id: "00000000-0000-4000-8000-000000000062",
          lineNumber: 2,
          quantity: 6,
          productVariantId: null,
          fulfilmentPlan: null,
        },
      ],
    } as never);
    const tx = {
      b2BFulfilmentPlan: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    prisma.client.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const internals = service as unknown as {
      advanceOrder: (...args: unknown[]) => Promise<void>;
      recordMutation: (...args: unknown[]) => Promise<unknown>;
    };
    const advance = vi
      .spyOn(internals, "advanceOrder")
      .mockResolvedValue();
    vi.spyOn(internals, "recordMutation").mockResolvedValue({});

    await service.upsertFulfilmentPlans(
      actor as never,
      order.orderNumber,
      "mixed-source-plan",
      {
        version: order.version,
        lines: [
          {
            orderLineId: "00000000-0000-4000-8000-000000000061",
            source: B2BFulfilmentSource.PROCURE,
            plannedQuantity: 4,
          },
          {
            orderLineId: "00000000-0000-4000-8000-000000000062",
            source: B2BFulfilmentSource.PRODUCE,
            plannedQuantity: 6,
          },
        ],
      },
    );

    expect(tx.b2BFulfilmentPlan.upsert).toHaveBeenCalledTimes(2);
    expect(tx.b2BFulfilmentPlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: B2BFulfilmentStatus.PENDING,
          readyQuantity: 0,
        }),
      }),
    );
    expect(advance).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      B2BOrderStatus.IN_FULFILMENT,
      actor.id,
      undefined,
    );
  });

  it("blocks commercial amendment approval after buyer funds clear", async () => {
    vi.spyOn(service, "getOrder").mockResolvedValue({
      ...order,
      paidAmountPaise: 500,
      status: B2BOrderStatus.IN_FULFILMENT,
      amendments: [
        {
          id: "00000000-0000-4000-8000-000000000070",
          amendmentNumber: "AM-1001",
          status: B2BOrderAmendmentStatus.REQUESTED,
          baseOrderVersion: order.version,
          lineChanges: [
            {
              orderLineId: "00000000-0000-4000-8000-000000000071",
              quantity: 2,
            },
          ],
          paymentDueAt: null,
        },
      ],
      lines: [
        {
          id: "00000000-0000-4000-8000-000000000071",
          quantity: 1,
          unitPricePaise: 1000,
          lineValuePaise: 1000,
          fulfilmentPlan: null,
        },
      ],
      paymentRecords: [{ status: B2BPaymentRecordStatus.CLEARED }],
      taxDocuments: [],
      warehouseTasks: [],
      packages: [],
      shipments: [],
      transportChargePaise: 0,
      commissionRateBps: 0,
    } as never);

    await expect(
      service.decideOrderAmendment(
        actor as never,
        order.orderNumber,
        "00000000-0000-4000-8000-000000000070",
        "approve-funded-amendment",
        {
          version: order.version,
          approved: true,
          reason: "Buyer approved the revised quantity.",
        },
      ),
    ).rejects.toThrow(
      "Commercial amendments require finance reversal before recorded buyer funds exist",
    );
  });

  it("records a reconciliation exception from immutable allocations without correcting caches", async () => {
    vi.spyOn(service, "getOrder").mockResolvedValue({
      ...order,
      paidAmountPaise: 500,
      buyerPayableAmountPaise: 1000,
      settlementStatus: "NOT_ELIGIBLE",
      settlementEligibleAt: null,
      paymentSchedules: [
        {
          id: "schedule-1",
          installmentNumber: 1,
          amountPaise: 1000,
          paidAmountPaise: 500,
          status: B2BPaymentScheduleStatus.PARTIALLY_PAID,
        },
      ],
      receivable: {
        id: "receivable-1",
        originalAmountPaise: 1000,
        outstandingAmountPaise: 500,
        entries: [],
      },
    } as never);
    prisma.client.b2BPaymentAllocation.findMany.mockResolvedValue([
      { amountPaise: 700 },
    ]);
    prisma.client.b2BPaymentProof.findMany.mockResolvedValue([]);
    const tx = {
      b2BFinancialReconciliation: {
        create: vi.fn().mockResolvedValue({}),
      },
      b2BMutationRecord: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prisma.client.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await service.reconcileFinances(
      actor as never,
      order.orderNumber,
      "check-ledger",
      { version: order.version, correct: false },
    );

    expect(tx.b2BFinancialReconciliation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: B2BFinancialReconciliationStatus.EXCEPTION,
        expectedPaidAmountPaise: 700,
        actualPaidAmountPaise: 500,
        expectedOutstandingPaise: 300,
        actualOutstandingPaise: 500,
        corrected: false,
      }),
    });
  });

  it("keeps a fully refunded credit-note dispute at zero outstanding", async () => {
    const disputeOrder = {
      ...order,
      status: B2BOrderStatus.DELIVERY_DISPUTED,
      paidAmountPaise: 11_800,
      buyerPayableAmountPaise: 11_800,
      subtotalPaise: 11_800,
      commissionRateBps: 0,
      paymentMethod: B2BPaymentMethod.MANUAL,
      businessBuyerId: "buyer-1",
      sellerId: "seller-1",
      transportMode: null,
      transportNote: null,
      supportCases: [
        {
          id: "case-1",
          caseNumber: "CASE-1",
          status: B2BSupportCaseStatus.OPEN,
          b2bOrderLineId: "line-1",
          shipmentId: null,
        },
      ],
      disputeResolutions: [],
      lines: [
        {
          id: "line-1",
          productId: "product-1",
          productVariantId: null,
          description: "Damaged goods",
          quantity: 1,
          hsnSacCode: "610910",
          taxClassification: ProductTaxClassification.TAXABLE,
          gstRatePercent: 18,
        },
      ],
      taxDocuments: [
        {
          id: "invoice-1",
          status: TaxDocumentStatus.ISSUED,
          documentType: TaxDocumentType.TAX_INVOICE,
        },
      ],
      paymentSchedules: [
        {
          id: "schedule-1",
          installmentNumber: 1,
          amountPaise: 11_800,
          paidAmountPaise: 11_800,
          status: B2BPaymentScheduleStatus.PAID,
        },
      ],
      receivable: {
        id: "receivable-1",
        originalAmountPaise: 11_800,
        outstandingAmountPaise: 0,
        entries: [],
      },
    };
    vi.spyOn(service, "getOrder").mockResolvedValue(disputeOrder as never);
    taxDocuments.createB2bCreditNote.mockResolvedValue({ id: "credit-note-1" });
    const tx = {
      b2BPaymentProof: { create: vi.fn().mockResolvedValue({}) },
      b2BPaymentSchedule: { update: vi.fn().mockResolvedValue({}) },
      b2BReceivableEntry: { create: vi.fn().mockResolvedValue({}) },
      b2BReceivable: { update: vi.fn().mockResolvedValue({}) },
      b2BSupportCase: { update: vi.fn().mockResolvedValue({}) },
      b2BDisputeResolution: { create: vi.fn().mockResolvedValue({}) },
      b2BShipment: { count: vi.fn().mockResolvedValue(0) },
    };
    prisma.client.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const internals = service as unknown as {
      advanceOrder: (...args: unknown[]) => Promise<void>;
      enqueueOutbox: (...args: unknown[]) => Promise<void>;
      recordMutation: (...args: unknown[]) => Promise<unknown>;
    };
    vi.spyOn(internals, "advanceOrder").mockResolvedValue();
    vi.spyOn(internals, "enqueueOutbox").mockResolvedValue();
    vi.spyOn(internals, "recordMutation").mockResolvedValue({});

    await service.resolveDispute(
      actor as never,
      order.orderNumber,
      "case-1",
      "full-refund-dispute",
      {
        version: order.version,
        resolutionType: B2BDisputeResolutionType.RETURN_AND_REFUND,
        reason: "Goods were returned and fully refunded.",
        returnQuantity: 1,
        refundAmountPaise: 11_800,
        receivableAdjustmentPaise: 11_800,
      },
    );

    expect(tx.b2BReceivable.update).toHaveBeenCalledWith({
      where: { id: "receivable-1" },
      data: expect.objectContaining({
        outstandingAmountPaise: 0,
        status: B2BReceivableStatus.PAID,
      }),
    });
    expect(tx.b2BReceivableEntry.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        entryType: "REFUND",
        balanceAfterPaise: 0,
      }),
    });
  });

  it("blocks generic closure of an unresolved delivery dispute", async () => {
    prisma.client.b2BSupportCase.findUnique.mockResolvedValue({
      caseType: B2BSupportCaseType.DELIVERY,
      shipmentId: "shipment-1",
      disputeResolution: null,
      order: { status: B2BOrderStatus.DELIVERY_DISPUTED },
    });

    await expect(
      service.updateSupportCase(actor as never, "case-1", {
        status: B2BSupportCaseStatus.RESOLVED,
        resolution: "Closed manually.",
      }),
    ).rejects.toThrow(
      "Use the structured dispute resolution action before closing a delivery dispute.",
    );
    expect(prisma.client.b2BSupportCase.update).not.toHaveBeenCalled();
  });
});
