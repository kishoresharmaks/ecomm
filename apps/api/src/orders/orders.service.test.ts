import { BadRequestException } from "@nestjs/common";
import {
  CodCollectionStatus,
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
