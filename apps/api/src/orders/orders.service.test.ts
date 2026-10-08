import { BadRequestException } from "@nestjs/common";
import {
  CodCollectionStatus,
  CourierShipmentStatus,
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryStatus,
  PaymentProvider,
  PaymentStatus,
  RoleCode,
  UserStatus,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

describe("OrdersService", () => {
  it("normalizes single seller order payment method query strings before building Prisma filters", async () => {
    const prisma = createOrdersPrismaMock([], { sellerId: "seller_1" });
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await service.listSellerOrders(
      { id: "user_1" } as never,
      { paymentMethod: "RAZORPAY" as never, limit: 30 },
    );

    expect(prisma.client.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payments: {
            some: {
              method: {
                in: ["RAZORPAY"],
              },
            },
          },
          sellerSplits: {
            some: {
              sellerId: "seller_1",
            },
          },
        }),
      }),
    );
  });

  it("normalizes delivery partner availability query strings before building Prisma filters", async () => {
    const partner = {
      id: "partner_1",
      email: "ravi@example.com",
      phone: "9876543210",
      fullName: "Ravi",
      status: UserStatus.ACTIVE,
      deliveryProfile: {
        isAvailable: true,
        phone: "9876543210",
        vehicleNumber: "TN 30 AB 1234",
        priority: 100,
        serviceCountryCode: "IN",
        serviceStateCode: "IN-TN",
        serviceCityCode: "IN-TN-SALEM",
        serviceAreas: [
          {
            isActive: true,
            pincode: "636304",
            localAreaCode: null,
          },
        ],
        baseLatitude: null,
        baseLongitude: null,
        serviceRadiusKm: null,
        codCashLimitPaise: null,
        notes: null,
      },
      userRoles: [{ role: { code: RoleCode.DELIVERY_PARTNER } }],
    };
    const prisma = createOrdersPrismaMock([partner]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await service.listDeliveryPartners({ isAvailable: "true" as never, limit: 100 });

    expect(prisma.client.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryProfile: {
            is: {
              isAvailable: true,
            },
          },
        }),
      }),
    );
  });

  it("rejects invalid delivery partner availability query values", async () => {
    const service = new OrdersService(
      createOrdersPrismaMock([]) as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await expect(service.listDeliveryPartners({ isAvailable: "yes" as never })).rejects.toThrow(BadRequestException);
  });

  it("keeps shipment assignment state in sync for batched local delivery assignment", async () => {
    const prisma = createOrdersPrismaMock([deliveryPartner()]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const batch = [
      batchOrder("order-1", "delivery-1", "shipment-1"),
      batchOrder("order-2", "delivery-2", "shipment-2"),
    ];

    await service.autoAssignDeliveryBatch(batch as never, null, "Auto assigned by test.", {
      shipmentIds: ["shipment-1", "shipment-2"],
    });

    expect(prisma.client.$transaction).toHaveBeenCalled();
    expect(prisma.tx.orderShipment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["shipment-1", "shipment-2"] },
        assignmentStatus: { not: DeliveryAssignmentStatus.ACCEPTED },
      }),
      data: expect.objectContaining({
        deliveryPartnerUserId: "partner_1",
        assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      }),
    }));
  });

  it("uses total pending COD across the batch before choosing a delivery partner", async () => {
    const prisma = createOrdersPrismaMock([deliveryPartner({ codCashLimitPaise: 500_000 })]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const batch = [
      batchOrder("order-1", "delivery-1", "shipment-1", { codAmountPaise: 400_000 }),
      batchOrder("order-2", "delivery-2", "shipment-2", { codAmountPaise: 400_000 }),
    ];

    await service.autoAssignDeliveryBatch(batch as never, null, "Auto assigned by test.", {
      shipmentIds: ["shipment-1", "shipment-2"],
    });

    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it("excludes already-collected COD from assigned pending exposure metrics", async () => {
    const prisma = createOrdersPrismaMock([deliveryPartner({ codCashLimitPaise: 500_000 })]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await service.autoAssignDeliveryBatch(
      [batchOrder("order-1", "delivery-1", "shipment-1", { codAmountPaise: 100_000 })] as never,
      null,
      "Auto assigned by test.",
      { shipmentIds: ["shipment-1"] },
    );

    expect(prisma.client.deliveryDetail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          codCollectionStatus: { not: CodCollectionStatus.COLLECTED },
        }),
      }),
    );
  });

  it("excludes already-collected COD from projected assigned exposure", async () => {
    const prisma = createOrdersPrismaMock([]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: "profile_1", depositWalletBalancePaise: 0 },
      ]),
      deliveryDetail: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { codCollectedAmountPaise: 100_000 } }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const exposure = await service.calculateProjectedCodExposure(tx as never, "partner_1");

    expect(exposure.netExposure).toBe(100_000);
    expect(tx.deliveryDetail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          codCollectionStatus: { not: CodCollectionStatus.COLLECTED },
        }),
      }),
    );
  });

  it("includes newly assigned COD liability in projected limit checks", async () => {
    const prisma = createOrdersPrismaMock([]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const helper = service as unknown as {
      pendingCodAmountForPartnerAssignment: (
        order: unknown,
        currentPartnerUserId: string | null,
        currentAssignmentStatus: DeliveryAssignmentStatus | null,
        nextPartnerUserId: string,
      ) => number;
    };
    const order = {
      paymentStatus: PaymentStatus.PENDING,
      payments: [
        {
          provider: PaymentProvider.COD,
          method: "COD",
          status: PaymentStatus.PENDING,
          amountPaise: 125_000,
        },
      ],
    };

    expect(
      helper.pendingCodAmountForPartnerAssignment(order, null, null, "partner_1"),
    ).toBe(125_000);
  });

  it("does not re-add COD liability when the same partner is already assigned", async () => {
    const prisma = createOrdersPrismaMock([]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const helper = service as unknown as {
      pendingCodAmountForPartnerAssignment: (
        order: unknown,
        currentPartnerUserId: string,
        currentAssignmentStatus: DeliveryAssignmentStatus,
        nextPartnerUserId: string,
      ) => number;
    };
    const order = {
      paymentStatus: PaymentStatus.PENDING,
      payments: [
        {
          provider: PaymentProvider.COD,
          method: "COD",
          status: PaymentStatus.PENDING,
          amountPaise: 125_000,
        },
      ],
    };

    expect(
      helper.pendingCodAmountForPartnerAssignment(
        order,
        "partner_1",
        DeliveryAssignmentStatus.ASSIGNED,
        "partner_1",
      ),
    ).toBe(0);
  });

  it("rejects a seller attempt to replace an already recorded E-Way Bill Number", async () => {
    const service = new OrdersService(
      createOrdersPrismaMock([]) as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const helper = service as unknown as {
      updateSellerShipmentStatusGuarded: (
        tx: unknown,
        input: Record<string, unknown>,
      ) => Promise<void>;
    };
    const tx = {
      orderShipment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "shipment-1",
          shipmentNumber: "SHP-1001",
          orderId: "order-1",
          sellerId: "seller-1",
          subtotalPaise: 5_500_000,
          shippingPaise: 0,
          codSurchargePaise: 0,
          status: DeliveryStatus.PENDING,
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          packages: [
            {
              id: "package-1",
              ewayBillNumber: "123456789012",
              weightGrams: null,
              lengthCm: null,
              breadthCm: null,
              heightCm: null,
              itemAllocations: [],
            },
          ],
        }),
      },
    };

    await expect(
      helper.updateSellerShipmentStatusGuarded(tx, {
        orderSellerSplitId: "split-1",
        nextStatus: DeliveryStatus.PACKED,
        actorUserId: "seller-user-1",
        requiresEWayBill: true,
        ewayBillNumber: "999999999999",
        updateData: {},
        createData: {},
      }),
    ).rejects.toThrow("The E-Way Bill Number is locked after saving.");
  });

  it("aggregates package dimensions from saved item allocations", () => {
    const service = new OrdersService(
      createOrdersPrismaMock([]) as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    const helper = service as unknown as {
      packageDimensionsFromAllocations: (value: unknown) => {
        weightGrams: number;
        lengthCm: number;
        breadthCm: number;
        heightCm: number;
      };
    };

    expect(
      helper.packageDimensionsFromAllocations([
        { quantity: 2, weightGrams: 750, lengthCm: 24, breadthCm: 12, heightCm: 7 },
        { quantity: 1, weightGrams: 300, lengthCm: 18, breadthCm: 19, heightCm: 11 },
      ]),
    ).toEqual({
      weightGrams: 1_800,
      lengthCm: 24,
      breadthCm: 19,
      heightCm: 11,
    });
  });

  it("does not include deliveredAt when updating courierShipment on delivery", async () => {
    const service = new OrdersService(
      {} as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    const tx = {
      orderShipment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "shipment_1",
          shipmentNumber: "SHP-1",
          orderId: "order_1",
          sellerId: "seller_1",
          subtotalPaise: 1000,
          shippingPaise: 0,
          codSurchargePaise: 0,
          status: DeliveryStatus.IN_TRANSIT,
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          packages: [],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderShipmentPackage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      courierShipment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const updateGuarded = (
      service as unknown as {
        updateSellerShipmentStatusGuarded: (
          tx: unknown,
          input: Record<string, unknown>,
        ) => Promise<void>;
      }
    ).updateSellerShipmentStatusGuarded.bind(service);

    await updateGuarded(tx, {
      orderSellerSplitId: "split_1",
      nextStatus: DeliveryStatus.DELIVERED,
      actorUserId: "user_1",
      requiresEWayBill: false,
      updateData: {},
      createData: {},
    });

    expect(tx.courierShipment.updateMany).toHaveBeenCalledWith({
      where: {
        orderShipmentId: "shipment_1",
        trackingStatus: { notIn: [CourierShipmentStatus.DELIVERED, CourierShipmentStatus.CANCELLED] },
      },
      data: {
        trackingStatus: CourierShipmentStatus.DELIVERED,
        bookingError: null,
      },
    });
    const updateData = tx.courierShipment.updateMany.mock.calls[0]?.[0]?.data;
    expect(updateData).not.toHaveProperty("deliveredAt");
  });

  it("cancels courier shipment and triggers automatic Razorpay refund when seller cancels package", async () => {
    const courierLogisticsMock = {
      cancelShipmentForSellerSplit: vi.fn().mockResolvedValue({ success: true }),
    };
    const returnsServiceMock = {
      processSellerSplitCancellation: vi.fn().mockResolvedValue({
        cancellationLines: [{ orderItemId: "item_1", quantity: 1, grossPaise: 1000, buyerRefundPaise: 1000 }],
        cancelledQuantity: 1,
        cancelledGrossPaise: 1000,
        buyerRefundPaise: 1000,
        refundNumber: "REF-20261006-0001",
        canAutoInitiateRazorpay: true,
        allItemsCancelled: true,
      }),
      initiateRefund: vi.fn().mockResolvedValue({ success: true }),
    };
    const taxDocumentsMock = {
      cancelDraftOrderDocuments: vi.fn().mockResolvedValue([]),
    };

    const orderRecord = {
      id: "ord_1",
      orderNumber: "1HI-1001",
      orderStatus: "CONFIRMED",
      deliveryStatus: "PACKED",
      paymentStatus: "PAID",
      currency: "INR",
      subtotalPaise: 1000,
      totalPaise: 1000,
      customerId: "cust_1",
      customer: {
        id: "cust_1",
        userId: "cust_user_1",
        user: { email: "customer@example.com", name: "Customer" },
      },
      items: [],
      sellerCashReceivables: [],
      statusEvents: [],
      deliveryEvents: [],
      sellerSplits: [
        {
          id: "split_1",
          orderId: "ord_1",
          sellerId: "seller_1",
          sellerStatus: "PROCESSING",
          sellerSubtotalPaise: 1000,
          seller: { id: "seller_1", storeName: "Test Store", slug: "test-store" },
          sellerCashReceivables: [],
          shipment: null,
        },
      ],
      shipments: [
        {
          id: "ship_1",
          shipmentNumber: "SHP-001",
          sellerId: "seller_1",
          orderSellerSplitId: "split_1",
          status: "PACKED",
          deliveryMode: "THIRD_PARTY_COURIER",
          subtotalPaise: 1000,
          shippingPaise: 0,
          codSurchargePaise: 0,
          assignmentStatus: null,
          packages: [],
          courierShipments: [],
          sellerCashReceivable: null,
        },
      ],
      payments: [
        {
          id: "pay_1",
          status: "PAID",
          provider: "RAZORPAY",
          method: "RAZORPAY",
          amountPaise: 1000,
          currency: "INR",
          createdAt: new Date(),
          providerPaymentId: "pay_123",
        },
      ],
      deliveryDetail: {
        id: "del_1",
        status: "PACKED",
        deliveryMode: "THIRD_PARTY_COURIER",
        events: [],
      },
    };

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findFirst: vi.fn().mockResolvedValue({ id: "ord_1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(orderRecord),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderSellerSplit: {
        findMany: vi.fn().mockResolvedValue(orderRecord.sellerSplits),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderShipment: {
        findMany: vi.fn().mockResolvedValue(orderRecord.shipments),
        findUnique: vi.fn().mockResolvedValue(orderRecord.shipments[0]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderShipmentPackage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue(orderRecord.payments),
      },
      deliveryDetail: {
        findUnique: vi.fn().mockResolvedValue(orderRecord.deliveryDetail),
        upsert: vi.fn().mockResolvedValue(orderRecord.deliveryDetail),
      },
      orderStatusEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      deliveryEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      courierShipment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      client: {
        ...tx,
        seller: {
          findUnique: vi.fn().mockResolvedValue({ id: "seller_1", userId: "user_1" }),
          findFirst: vi.fn().mockResolvedValue({ id: "seller_1", userId: "user_1" }),
        },
        order: {
          ...tx.order,
          findUnique: vi.fn().mockResolvedValue({
            ...orderRecord,
            orderStatus: "CANCELLED",
            deliveryStatus: "CANCELLED",
            paymentStatus: "REFUNDED",
            items: [],
          }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...orderRecord,
            orderStatus: "CANCELLED",
            deliveryStatus: "CANCELLED",
            paymentStatus: "REFUNDED",
            items: [],
          }),
        },
        $transaction: vi.fn().mockImplementation((callback) => callback(tx)),
      },
    };

    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { notifyEvent: vi.fn().mockResolvedValue({}) } as never,
      { notifyCustomer: vi.fn().mockResolvedValue({}) } as never,
      undefined as never,
      taxDocumentsMock as never,
      undefined as never,
      courierLogisticsMock as never,
      returnsServiceMock as never,
    );

    await service.updateSellerOrderStatus(
      { id: "user_1" } as never,
      "1HI-1001",
      { sellerStatus: "CANCELLED" as never, note: "Inventory shortage" },
    );

    // Verified: ReturnsService processed split cancellation
    expect(returnsServiceMock.processSellerSplitCancellation).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        orderId: "ord_1",
        sellerId: "seller_1",
        orderSellerSplitId: "split_1",
        note: "Inventory shortage",
      }),
    );

    // Verified: Shiprocket courier shipment cancellation called
    expect(courierLogisticsMock.cancelShipmentForSellerSplit).toHaveBeenCalledWith(
      "split_1",
      "user_1",
    );

    // Verified: Automatic Razorpay refund initiated
    expect(returnsServiceMock.initiateRefund).toHaveBeenCalledWith(
      { id: "user_1" },
      "REF-20261006-0001",
      expect.objectContaining({
        method: "RAZORPAY",
      }),
    );

    // Verified: Draft tax documents cancelled
    expect(taxDocumentsMock.cancelDraftOrderDocuments).toHaveBeenCalledWith(
      tx,
      "ord_1",
      "Inventory shortage",
    );
  });

  it("isolates refund requests and cash receivables strictly to the authenticated seller in multi-vendor orders", async () => {
    const multiVendorOrder = {
      id: "ord_mv_1",
      orderNumber: "1HI-9999",
      idempotencyKey: null,
      orderKind: "STANDARD",
      parentOrder: null,
      replacementReturnRequest: null,
      orderStatus: "CONFIRMED",
      paymentStatus: "PAID",
      deliveryStatus: "DELIVERED",
      subtotalPaise: 8000,
      shippingPaise: 0,
      platformFeePaise: 0,
      couponCode: null,
      couponTitle: null,
      couponDiscountPaise: 0,
      couponMerchandiseDiscountPaise: 0,
      couponShippingDiscountPaise: 0,
      couponPlatformFundedDiscountPaise: 0,
      couponSellerFundedDiscountPaise: 0,
      totalPaise: 8000,
      currency: "INR",
      buyerCountryCode: "IN",
      buyerCurrency: "INR",
      buyerSubtotalMinor: 8000,
      buyerShippingMinor: 0,
      buyerPlatformFeeMinor: 0,
      buyerTotalMinor: 8000,
      fxRate: null,
      fxProvider: null,
      fxRateFetchedAt: null,
      shippingAddressSnapshot: {},
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      updatedAt: new Date("2026-10-01T10:00:00.000Z"),
      items: [
        {
          id: "item_s1",
          sellerId: "seller_1",
          replacementSourceOrderItemId: null,
          replacementSourceReturnItemId: null,
          productNameSnapshot: "Seller 1 Product",
          variantSnapshot: null,
          quantity: 2,
          activeQuantity: 2,
          cancelledQuantity: 0,
          returnedQuantity: 0,
          refundedQuantity: 0,
          replacementQuantity: 0,
          lifecycleStatus: "ACTIVE",
          unitPricePaise: 2500,
          lineTotalPaise: 5000,
          currency: "INR",
          originalUnitPricePaise: 2500,
          dealDiscountBps: null,
          dealDiscountPaise: 0,
          dealId: null,
          dealSnapshot: null,
          couponDiscountPaise: 0,
          couponPlatformFundedDiscountPaise: 0,
          couponSellerFundedDiscountPaise: 0,
          returnPolicySnapshot: null,
          returnItems: [],
          product: null,
        },
        {
          id: "item_s2",
          sellerId: "seller_2",
          replacementSourceOrderItemId: null,
          replacementSourceReturnItemId: null,
          productNameSnapshot: "Seller 2 Product",
          variantSnapshot: null,
          quantity: 1,
          activeQuantity: 1,
          cancelledQuantity: 0,
          returnedQuantity: 0,
          refundedQuantity: 0,
          replacementQuantity: 0,
          lifecycleStatus: "ACTIVE",
          unitPricePaise: 3000,
          lineTotalPaise: 3000,
          currency: "INR",
          originalUnitPricePaise: 3000,
          dealDiscountBps: null,
          dealDiscountPaise: 0,
          dealId: null,
          dealSnapshot: null,
          couponDiscountPaise: 0,
          couponPlatformFundedDiscountPaise: 0,
          couponSellerFundedDiscountPaise: 0,
          returnPolicySnapshot: null,
          returnItems: [],
          product: null,
        },
      ],
      payments: [
        {
          id: "pay_1",
          provider: "RAZORPAY",
          method: "RAZORPAY",
          amountPaise: 8000,
          currency: "INR",
          status: "PAID",
          createdAt: new Date("2026-10-01T10:00:00.000Z"),
        },
      ],
      sellerSplits: [
        {
          id: "split_s1",
          orderId: "ord_mv_1",
          sellerId: "seller_1",
          sellerSubtotalPaise: 5000,
          couponDiscountPaise: 0,
          couponPlatformFundedDiscountPaise: 0,
          couponSellerFundedDiscountPaise: 0,
          couponAdjustmentPaise: 0,
          commissionPaise: 500,
          gstOnCommissionPaise: 90,
          tdsPaise: 50,
          tcsPaise: 50,
          platformFeePaise: 0,
          refundAdjustmentPaise: 0,
          netPayablePaise: 4310,
          sellerStatus: "CONFIRMED",
          createdAt: new Date("2026-10-01T10:00:00.000Z"),
          updatedAt: new Date("2026-10-01T10:00:00.000Z"),
          seller: { id: "seller_1", storeName: "Store 1", slug: "store-1" },
          sellerCashReceivables: [],
          shipment: null,
        },
        {
          id: "split_s2",
          orderId: "ord_mv_1",
          sellerId: "seller_2",
          sellerSubtotalPaise: 3000,
          couponDiscountPaise: 0,
          couponPlatformFundedDiscountPaise: 0,
          couponSellerFundedDiscountPaise: 0,
          couponAdjustmentPaise: 0,
          commissionPaise: 300,
          gstOnCommissionPaise: 54,
          tdsPaise: 30,
          tcsPaise: 30,
          platformFeePaise: 0,
          refundAdjustmentPaise: 0,
          netPayablePaise: 2586,
          sellerStatus: "CONFIRMED",
          createdAt: new Date("2026-10-01T10:00:00.000Z"),
          updatedAt: new Date("2026-10-01T10:00:00.000Z"),
          seller: { id: "seller_2", storeName: "Store 2", slug: "store-2" },
          sellerCashReceivables: [],
          shipment: null,
        },
      ],
      shipments: [],
      sellerCashReceivables: [
        {
          id: "rec_s1",
          receivableNumber: "REC-S1-001",
          orderId: "ord_mv_1",
          orderSellerSplitId: "split_s1",
          sellerId: "seller_1",
          source: "DELIVERY_COD",
          status: "OPEN",
          grossCashCollectedPaise: 5000,
          platformDuePaise: 500,
          offsetPaise: 0,
          settledPaise: 0,
          waivedPaise: 0,
          outstandingPaise: 5000,
          currency: "INR",
          openedAt: new Date("2026-10-01T10:00:00.000Z"),
          settledAt: null,
          waivedAt: null,
        },
        {
          id: "rec_s2",
          receivableNumber: "REC-S2-002",
          orderId: "ord_mv_1",
          orderSellerSplitId: "split_s2",
          sellerId: "seller_2",
          source: "DELIVERY_COD",
          status: "OPEN",
          grossCashCollectedPaise: 3000,
          platformDuePaise: 300,
          offsetPaise: 0,
          settledPaise: 0,
          waivedPaise: 0,
          outstandingPaise: 3000,
          currency: "INR",
          openedAt: new Date("2026-10-01T10:00:00.000Z"),
          settledAt: null,
          waivedAt: null,
        },
      ],
      refundRequests: [
        {
          id: "ref_s1",
          refundNumber: "REF-S1-001",
          status: "PENDING_REVIEW",
          reason: "Defective item from seller 1",
          method: "RAZORPAY",
          amountPaise: 2500,
          approvedAmountPaise: 2500,
          currency: "INR",
          note: "Customer return note for seller 1",
          createdAt: new Date("2026-10-02T10:00:00.000Z"),
          approvedAt: null,
          reviewedAt: null,
          items: [
            {
              id: "ref_item_1",
              orderItemId: "item_s1",
              orderSellerSplitId: "split_s1",
              sellerId: "seller_1",
              quantity: 1,
              amountPaise: 2500,
              approvedAmountPaise: 2500,
            },
          ],
        },
        {
          id: "ref_s2",
          refundNumber: "REF-S2-002",
          status: "APPROVED",
          reason: "Competitor secret return reason for seller 2",
          method: "RAZORPAY",
          amountPaise: 3000,
          approvedAmountPaise: 3000,
          currency: "INR",
          note: "Private merchant note for seller 2",
          createdAt: new Date("2026-10-02T11:00:00.000Z"),
          approvedAt: new Date("2026-10-02T12:00:00.000Z"),
          reviewedAt: new Date("2026-10-02T12:00:00.000Z"),
          items: [
            {
              id: "ref_item_2",
              orderItemId: "item_s2",
              orderSellerSplitId: "split_s2",
              sellerId: "seller_2",
              quantity: 1,
              amountPaise: 3000,
              approvedAmountPaise: 3000,
            },
          ],
        },
        {
          id: "ref_mixed",
          refundNumber: "REF-MIX-003",
          status: "PROCESSING",
          reason: "Combined package issue",
          method: "RAZORPAY",
          amountPaise: 5500,
          approvedAmountPaise: 5500,
          currency: "INR",
          note: "Customer return of both items",
          createdAt: new Date("2026-10-03T09:00:00.000Z"),
          approvedAt: null,
          reviewedAt: null,
          items: [
            {
              id: "ref_item_mixed_1",
              orderItemId: "item_s1",
              orderSellerSplitId: "split_s1",
              sellerId: "seller_1",
              quantity: 1,
              amountPaise: 2500,
              approvedAmountPaise: 2500,
            },
            {
              id: "ref_item_mixed_2",
              orderItemId: "item_s2",
              orderSellerSplitId: "split_s2",
              sellerId: "seller_2",
              quantity: 1,
              amountPaise: 3000,
              approvedAmountPaise: 3000,
            },
          ],
        },
      ],
      deliveryDetail: {
        id: "del_1",
        status: "DELIVERED",
        deliveryMode: "THIRD_PARTY_COURIER",
        events: [],
      },
      statusEvents: [],
      deliveryEvents: [],
    };

    const prisma = {
      client: {
        seller: {
          findUnique: vi.fn().mockResolvedValue({ id: "seller_1", userId: "user_1" }),
        },
        order: {
          findFirst: vi.fn().mockResolvedValue(multiVendorOrder),
        },
      },
    };

    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    const result = await service.getSellerOrder({ id: "user_1" } as never, "1HI-9999");

    // 1. Items strictly scoped to seller_1
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sellerId).toBe("seller_1");
    expect(result.items[0]?.id).toBe("item_s1");

    // 2. Seller splits strictly scoped to seller_1
    expect(result.sellerSplits).toHaveLength(1);
    expect(result.sellerSplits[0]?.sellerId).toBe("seller_1");

    // 3. Top-level cash receivables strictly scoped to seller_1 (rec_s2 completely stripped)
    expect(result.sellerCashReceivables).toHaveLength(1);
    expect(result.sellerCashReceivables[0]?.id).toBe("rec_s1");
    expect(result.sellerCashReceivables.some((r: { id: string }) => r.id === "rec_s2")).toBe(false);

    // 4. Refund requests strictly scoped to seller_1:
    // ref_s2 (belonging only to seller_2) MUST be completely stripped
    expect(result.refundRequests).toHaveLength(2);
    expect(result.refundRequests.some((r: { id: string }) => r.id === "ref_s2")).toBe(false);

    // ref_s1 has seller_1 items only
    const resRef1 = result.refundRequests.find((r: { id: string }) => r.id === "ref_s1");
    expect(resRef1).toBeDefined();
    expect(resRef1?.amountPaise).toBe(2500);
    expect(resRef1?.items).toHaveLength(1);
    expect(resRef1?.items[0]?.sellerId).toBe("seller_1");

    // ref_mixed has seller_2 items stripped and amounts recalculated to seller_1's portion only
    const resMixed = result.refundRequests.find((r: { id: string }) => r.id === "ref_mixed");
    expect(resMixed).toBeDefined();
    expect(resMixed?.amountPaise).toBe(2500); // 2500 instead of 5500
    expect(resMixed?.approvedAmountPaise).toBe(2500); // 2500 instead of 5500
    expect(resMixed?.items).toHaveLength(1);
    expect(resMixed?.items[0]?.sellerId).toBe("seller_1");
    expect(resMixed?.items.some((item: { sellerId: string }) => item.sellerId === "seller_2")).toBe(false);
  });
});

function createOrdersPrismaMock(partners: unknown[], options: { sellerId?: string } = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    deliveryDetail: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    orderShipment: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    deliveryAssignmentAttempt: {
      create: vi.fn().mockResolvedValue({}),
    },
    deliveryEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    tx,
    client: {
      $transaction: vi.fn(async (callback) => callback(tx)),
      deliveryDetail: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { codCollectedAmountPaise: 0 } }),
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      deliveryAssignmentAttempt: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      deliveryPartnerPayout: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaise: 0 }, _count: { _all: 0 } }),
      },
      deliveryPartnerWalletEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaise: 0 }, _count: { _all: 0 } }),
      },
      orderShipment: {
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      order: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      seller: {
        findUnique: vi.fn().mockResolvedValue(options.sellerId ? { id: options.sellerId } : null),
      },
      setting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      user: {
        count: vi.fn().mockResolvedValue(partners.length),
        findMany: vi.fn().mockResolvedValue(partners),
      },
    },
  };
}

function deliveryPartner(options: { codCashLimitPaise?: number | null } = {}) {
  return {
    id: "partner_1",
    email: "ravi@example.com",
    phone: "9876543210",
    fullName: "Ravi",
    status: UserStatus.ACTIVE,
    createdAt: new Date("2026-07-11T09:00:00.000Z"),
      deliveryProfile: {
      isAvailable: true,
      phone: "9876543210",
      vehicleNumber: "TN 30 AB 1234",
      priority: 100,
      serviceCountryCode: null,
      serviceStateCode: null,
      serviceCityCode: null,
      serviceAreas: [],
      baseLatitude: null,
      baseLongitude: null,
      serviceRadiusKm: null,
      codCashLimitPaise: options.codCashLimitPaise ?? null,
      depositWalletBalancePaise: 0,
      notes: null,
    },
    userRoles: [{ role: { code: RoleCode.DELIVERY_PARTNER } }],
  };
}

function batchOrder(
  id: string,
  deliveryDetailId: string,
  shipmentId: string,
  options: { codAmountPaise?: number } = {},
) {
  return {
    id,
    paymentStatus: options.codAmountPaise ? PaymentStatus.PENDING : PaymentStatus.PAID,
    shippingAddressSnapshot: {
      countryCode: "IN",
      stateCode: "IN-TN",
      cityCode: "IN-TN-SLM",
      pincode: "636001",
      localAreaCode: "PIN-636001",
    },
    payments: options.codAmountPaise
      ? [{ provider: PaymentProvider.COD, method: "COD", amountPaise: options.codAmountPaise }]
      : [],
    deliveryDetail: {
      id: deliveryDetailId,
      status: DeliveryStatus.PACKED,
    },
    shipments: [
      {
        id: shipmentId,
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        status: DeliveryStatus.PACKED,
      },
    ],
  };
}
