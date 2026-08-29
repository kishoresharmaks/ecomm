import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import {
  CourierShipmentStatus,
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryStatus,
  OrderShipmentPackageStatus,
  OrderStatus,
  PaymentStatus,
  SellerType,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { CourierLogisticsService } from "./courier-logistics.service";

describe("CourierLogisticsService", () => {
  it("counts courier dashboard metrics across delivery modes and excludes cancelled routing failures", async () => {
    const prisma = {
      client: {
        orderShipmentPackage: {
          count: vi.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(1),
        },
        courierShipment: {
          count: vi.fn().mockResolvedValue(0),
        },
        courierConsignmentPackage: {
          count: vi.fn().mockResolvedValue(0),
        },
        orderShipment: {
          count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
        },
        courierCodRemittance: {
          count: vi.fn().mockResolvedValue(0),
        },
        courierProviderSetting: {
          count: vi.fn().mockResolvedValue(0),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    const result = await service.getCourierDashboard();

    expect(result.metrics.delivered).toBe(1);
    expect(prisma.client.orderShipmentPackage.count).toHaveBeenNthCalledWith(2, {
      where: {
        order: { orderStatus: { not: "CANCELLED" }, deliveryStatus: { not: "CANCELLED" } },
        OR: [
          { status: OrderShipmentPackageStatus.DELIVERED },
          { orderShipment: { status: DeliveryStatus.DELIVERED } },
          { order: { deliveryStatus: DeliveryStatus.DELIVERED } },
        ],
      },
    });
    expect(prisma.client.orderShipment.count).toHaveBeenNthCalledWith(1, {
      where: {
        order: { orderStatus: { not: "CANCELLED" }, deliveryStatus: { not: "CANCELLED" } },
        status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
        OR: [{ routingFailed: true }, { routingPermanentFailureAt: { not: null } }],
      },
    });
  });

  it("lists routing failures when embedded packages omit their own shipment relations", async () => {
    const prisma = {
      client: {
        orderShipment: {
          findMany: vi.fn().mockResolvedValue([routingFailureShipment()]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    const result = await service.listRoutingFailures({});

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "shipment-1",
      shipmentNumber: "SHP-1001",
      packageCount: 1,
      firstPackage: {
        id: "package-1",
        packageNumber: "PKG-1001",
        courierTrackingStatus: CourierShipmentStatus.FAILED,
        awbNumber: "AWB1001",
        courierCode: "SHIPROCKET",
        order: {
          id: "order-1",
          orderNumber: "1HI-1001",
        },
        seller: {
          id: "seller-1",
          storeName: "Coimbatore Store",
        },
        orderShipment: null,
      },
    });
  });

  it("normalizes stale package status from delivered parent shipments in package readback", async () => {
    const stalePackageShipment = {
      ...routingFailureShipment(),
      status: DeliveryStatus.DELIVERED,
      order: {
        ...routingFailureShipment().order,
        deliveryStatus: DeliveryStatus.DELIVERED,
      },
      packages: [
        {
          ...routingFailureShipment().packages[0],
          status: OrderShipmentPackageStatus.PACKING_PENDING,
        },
      ],
      courierShipment: null,
    };
    const prisma = {
      client: {
        orderShipment: {
          findMany: vi.fn().mockResolvedValue([stalePackageShipment]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    const result = await service.listRoutingFailures({});

    expect(result.items[0]?.firstPackage).toMatchObject({
      status: OrderShipmentPackageStatus.DELIVERED,
      storedStatus: OrderShipmentPackageStatus.PACKING_PENDING,
    });
  });

  it("lists local delivery queue as active work only", async () => {
    const prisma = {
      client: {
        orderShipment: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);
    vi.spyOn(
      service as unknown as { listActiveDeliveryPartners: () => Promise<unknown[]> },
      "listActiveDeliveryPartners",
    ).mockResolvedValue([]);

    const result = await service.listLocalDeliveryQueue({ search: "SHP-1001" });

    expect(result).toEqual({ items: [], partners: [], total: 0, page: 1, limit: 50 });
    const expectedWhere = {
      order: { orderStatus: { not: OrderStatus.CANCELLED }, deliveryStatus: { not: DeliveryStatus.CANCELLED } },
      deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
      OR: [
        { shipmentNumber: { contains: "SHP-1001", mode: "insensitive" } },
        { order: { orderNumber: { contains: "SHP-1001", mode: "insensitive" } } },
        { seller: { storeName: { contains: "SHP-1001", mode: "insensitive" } } },
        { partnerName: { contains: "SHP-1001", mode: "insensitive" } },
      ],
    };
    expect(prisma.client.orderShipment.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }],
      skip: 0,
      take: 50,
    });
    expect(prisma.client.orderShipment.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("lists courier packages with dashboard quick filters and search composed together", async () => {
    const prisma = {
      client: {
        orderShipmentPackage: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await service.listCourierPackages({
      quickFilter: "IN_TRANSIT",
      providerCode: "shiprocket",
      search: "AWB1001",
    });

    const expectedWhere = {
      AND: [
        {
          order: { orderStatus: { not: OrderStatus.CANCELLED }, deliveryStatus: { not: DeliveryStatus.CANCELLED } },
          orderShipment: { status: { not: DeliveryStatus.CANCELLED } },
          status: { not: OrderShipmentPackageStatus.CANCELLED },
          courierPackages: {
            some: {
              trackingStatus: {
                in: [
                  CourierShipmentStatus.PICKED_UP,
                  CourierShipmentStatus.IN_TRANSIT,
                  CourierShipmentStatus.OUT_FOR_DELIVERY,
                  CourierShipmentStatus.RTO_INITIATED,
                  CourierShipmentStatus.RTO_IN_TRANSIT,
                ],
              },
            },
          },
        },
        {
          courierPackages: {
            some: {
              courierConsignment: { providerCode: "SHIPROCKET" },
            },
          },
        },
        {
          OR: [
            { packageNumber: { contains: "AWB1001", mode: "insensitive" } },
            { orderShipment: { shipmentNumber: { contains: "AWB1001", mode: "insensitive" } } },
            { order: { orderNumber: { contains: "AWB1001", mode: "insensitive" } } },
            { seller: { storeName: { contains: "AWB1001", mode: "insensitive" } } },
            { courierPackages: { some: { awbNumber: { contains: "AWB1001", mode: "insensitive" } } } },
          ],
        },
      ],
    };
    expect(prisma.client.orderShipmentPackage.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }],
      skip: 0,
      take: 50,
    });
    expect(prisma.client.orderShipmentPackage.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("excludes cancelled parent orders from the default courier package list and paginates", async () => {
    const prisma = {
      client: {
        orderShipmentPackage: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    const result = await service.listCourierPackages({ page: 2, limit: 25 });

    const expectedWhere = {
      AND: [
        {
          order: { orderStatus: { not: OrderStatus.CANCELLED }, deliveryStatus: { not: DeliveryStatus.CANCELLED } },
          orderShipment: { status: { not: DeliveryStatus.CANCELLED } },
          status: { not: OrderShipmentPackageStatus.CANCELLED },
        },
      ],
    };
    expect(result).toEqual({ items: [], total: 0, page: 2, limit: 25 });
    expect(prisma.client.orderShipmentPackage.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }],
      skip: 25,
      take: 25,
    });
    expect(prisma.client.orderShipmentPackage.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("lists courier COD remittances as active handoff records only", async () => {
    const prisma = {
      client: {
        courierCodRemittance: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await service.listCourierCodRemittances({ search: "AWB1001" });

    const expectedWhere = {
      order: { orderStatus: { not: OrderStatus.CANCELLED }, deliveryStatus: { not: DeliveryStatus.CANCELLED } },
      orderShipment: { status: { not: DeliveryStatus.CANCELLED } },
      OR: [
        { awbNumber: { contains: "AWB1001", mode: "insensitive" } },
        { remittanceReference: { contains: "AWB1001", mode: "insensitive" } },
        { reportReference: { contains: "AWB1001", mode: "insensitive" } },
        { orderShipment: { shipmentNumber: { contains: "AWB1001", mode: "insensitive" } } },
        { order: { orderNumber: { contains: "AWB1001", mode: "insensitive" } } },
      ],
    };
    expect(prisma.client.courierCodRemittance.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      include: expect.any(Object),
      orderBy: [{ updatedAt: "desc" }],
      skip: 0,
      take: 50,
    });
    expect(prisma.client.courierCodRemittance.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("stable-stringifies nested webhook payload objects", () => {
    const service = new CourierLogisticsService({} as never, undefined as never);
    const stableStringify = (
      service as unknown as { stableStringify: (value: unknown) => string }
    ).stableStringify.bind(service);

    expect(
      stableStringify({
        z: 1,
        a: {
          c: 3,
          b: [{ y: 2, x: 1 }],
        },
      }),
    ).toBe('{"a":{"b":[{"x":1,"y":2}],"c":3},"z":1}');
  });

  it("cancels previous local-delivery assignment attempts when reassigning partners", async () => {
    const tx = courierAssignmentTransactionMocks();
    const prisma = {
      client: {
        orderShipment: {
          findUnique: vi.fn().mockResolvedValue(
            localDeliveryShipment({
              deliveryPartnerUserId: "old-partner",
              assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
            }),
          ),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: "new-partner" }),
        },
        $transaction: vi.fn((callback) => callback(tx)),
        orderShipmentPackage: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await service.assignLocalDeliveryShipment({ id: "admin-1" } as never, "shipment-1", {
      deliveryPartnerUserId: "new-partner",
      assignmentNote: "Reassign from courier workspace.",
    });

    expect(tx.deliveryAssignmentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: DeliveryAssignmentStatus.ASSIGNED,
        partnerUserId: { not: "new-partner" },
      },
      data: {
        status: DeliveryAssignmentStatus.CANCELLED,
        respondedAt: expect.any(Date),
        note: "Reassign from courier workspace.",
      },
    });
    expect(tx.deliveryAssignmentAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        deliveryDetailId: "delivery-detail-1",
        partnerUserId: "new-partner",
        source: "MANUAL",
        status: DeliveryAssignmentStatus.ASSIGNED,
        assignedById: "admin-1",
      }),
    });
  });

  it("cancels active local-delivery attempts without creating a new attempt when unassigning", async () => {
    const tx = courierAssignmentTransactionMocks();
    const prisma = {
      client: {
        orderShipment: {
          findUnique: vi.fn().mockResolvedValue(
            localDeliveryShipment({
              deliveryPartnerUserId: "old-partner",
              assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
            }),
          ),
        },
        $transaction: vi.fn((callback) => callback(tx)),
        orderShipmentPackage: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await service.assignLocalDeliveryShipment({ id: "admin-1" } as never, "shipment-1", {
      assignmentNote: "Unassign from courier workspace.",
    });

    expect(tx.deliveryAssignmentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: DeliveryAssignmentStatus.ASSIGNED,
      },
      data: {
        status: DeliveryAssignmentStatus.CANCELLED,
        respondedAt: expect.any(Date),
        note: "Unassign from courier workspace.",
      },
    });
    expect(tx.deliveryAssignmentAttempt.create).not.toHaveBeenCalled();
  });

  it("downloads courier labels only from public HTTPS URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/pdf") },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Response);
    const prisma = {
      client: {
        orderShipmentPackage: {
          findUnique: vi.fn().mockResolvedValue(courierLabelPackage("https://labels.courier.example/label.pdf")),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    const label = await service.getCourierPackageLabel("package-1");

    expect(label).toMatchObject({
      contentType: "application/pdf",
      fileName: "PKG-1001-label.pdf",
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://labels.courier.example/label.pdf");
    fetchSpy.mockRestore();
  });

  it("blocks private courier label URLs before server-side fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue("application/pdf") },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Response);
    const prisma = {
      client: {
        orderShipmentPackage: {
          findUnique: vi.fn().mockResolvedValue(courierLabelPackage("https://127.0.0.1/label.pdf")),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(service.getCourierPackageLabel("package-1")).rejects.toThrow(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("blocks courier package booking for closed orders and shipments", async () => {
    const prisma = {
      client: {
        orderShipmentPackage: {
          findUnique: vi.fn().mockResolvedValue({
            id: "package-1",
            deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
            status: OrderShipmentPackageStatus.READY_FOR_BOOKING,
            order: {
              orderStatus: OrderStatus.CANCELLED,
              deliveryStatus: DeliveryStatus.CANCELLED,
            },
            orderShipment: {
              shipmentNumber: "SHP-1001",
              status: DeliveryStatus.CANCELLED,
            },
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(
      service.bookPackage({ id: "admin-1" } as never, "package-1", { providerCode: "SHIPROCKET" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("blocks routing override for delivered shipments", async () => {
    const prisma = {
      client: {
        orderShipment: {
          findUnique: vi.fn().mockResolvedValue({
            id: "shipment-1",
            deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
            status: DeliveryStatus.DELIVERED,
            order: {
              orderStatus: OrderStatus.DELIVERED,
              deliveryStatus: DeliveryStatus.DELIVERED,
            },
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(
      service.overrideRoutingFailure({ id: "admin-1" } as never, "shipment-1", {
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("blocks local delivery assignment for cancelled shipments", async () => {
    const prisma = {
      client: {
        orderShipment: {
          findUnique: vi.fn().mockResolvedValue({
            id: "shipment-1",
            deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
            status: DeliveryStatus.CANCELLED,
            order: {
              orderStatus: OrderStatus.CANCELLED,
              deliveryStatus: DeliveryStatus.CANCELLED,
              deliveryDetail: null,
            },
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(
      service.assignLocalDeliveryShipment({ id: "admin-1" } as never, "shipment-1", {
        deliveryPartnerUserId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("cancels a booked provider order once and persists the cancellation audit", async () => {
    const cancelShipment = vi.fn().mockResolvedValue({
      success: true,
      message: "Cancelled.",
      cancelPayloadSnapshot: { ids: [844722] },
      cancelResponseSnapshot: { status: "ok" },
    });
    const tx = {
      courierShipment: { update: vi.fn().mockResolvedValue({}) },
      courierConsignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      courierConsignmentPackage: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      orderShipment: { update: vi.fn().mockResolvedValue({}) },
      orderShipmentPackage: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      client: {
        orderShipment: {
          findFirst: vi.fn().mockResolvedValue({
            id: "shipment-1",
            courierShipment: {
              id: "courier-shipment-1",
              providerCode: "SHIPROCKET",
              providerOrderId: "844722",
              awbNumber: "AWB1001",
              trackingStatus: CourierShipmentStatus.BOOKED,
            },
            seller: {
              courierProviderSettings: [
                {
                  providerCode: "SHIPROCKET",
                  isActive: true,
                  settingsSnapshot: { adapterCode: "SHIPROCKET" },
                },
              ],
            },
          }),
        },
        $transaction: vi.fn(async (callback) => callback(tx)),
      },
    };
    const service = new CourierLogisticsService(prisma as never, {
      getAdapter: vi.fn().mockReturnValue({ cancelShipment }),
    } as never);

    const result = await service.cancelShipmentForSellerSplit("split-1", "admin-1");

    expect(result?.success).toBe(true);
    expect(cancelShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCode: "SHIPROCKET",
        providerOrderId: "844722",
        awbNumber: "AWB1001",
      }),
    );
    expect(tx.courierShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "courier-shipment-1" },
        data: expect.objectContaining({
          trackingStatus: CourierShipmentStatus.CANCELLED,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-1",
        action: "courier_shipment.cancellation.synced",
        entityType: "courier_shipment",
        entityId: "courier-shipment-1",
        newValue: expect.objectContaining({
          cancelPayloadSnapshot: { ids: [844722] },
          cancelResponseSnapshot: { status: "ok" },
        }),
      }),
    });
  });

  it("treats an already cancelled provider shipment as idempotent", async () => {
    const cancelShipment = vi.fn();
    const prisma = {
      client: {
        orderShipment: {
          findFirst: vi.fn().mockResolvedValue({
            id: "shipment-1",
            courierShipment: {
              id: "courier-shipment-1",
              providerCode: "SHIPROCKET",
              providerOrderId: "844722",
              awbNumber: "AWB1001",
              trackingStatus: CourierShipmentStatus.CANCELLED,
            },
            seller: { courierProviderSettings: [] },
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, {
      getAdapter: vi.fn().mockReturnValue({ cancelShipment }),
    } as never);

    const result = await service.cancelShipmentForSellerSplit("split-1", "admin-1");

    expect(result).toEqual({
      success: true,
      message: "Courier shipment was already cancelled.",
    });
    expect(cancelShipment).not.toHaveBeenCalled();
  });

  it("rejects tracking webhooks with UnauthorizedException when webhook secret is unconfigured", async () => {
    const prisma = {
      client: {
        courierProviderSetting: {
          findUnique: vi.fn().mockResolvedValue({
            providerCode: "SHIPROCKET",
            isActive: true,
            webhookSecretConfigured: false,
            settingsSnapshot: {},
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(
      service.handleTrackingWebhook("SHIPROCKET", { status: "DELIVERED" }, "any-signature"),
    ).rejects.toThrow(new UnauthorizedException("Courier webhook secret is not configured."));
  });

  it("rejects tracking webhooks when webhookSecretConfigured is true but secret is missing", async () => {
    const prisma = {
      client: {
        courierProviderSetting: {
          findUnique: vi.fn().mockResolvedValue({
            providerCode: "SHIPROCKET",
            isActive: true,
            webhookSecretConfigured: true,
            settingsSnapshot: { webhookSecret: "   " },
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(
      service.handleTrackingWebhook("SHIPROCKET", { status: "DELIVERED" }, "any-signature"),
    ).rejects.toThrow(new UnauthorizedException("Courier webhook secret is not configured."));
  });

  it("rejects tracking webhooks when signature is invalid", async () => {
    const prisma = {
      client: {
        courierProviderSetting: {
          findUnique: vi.fn().mockResolvedValue({
            providerCode: "SHIPROCKET",
            isActive: true,
            webhookSecretConfigured: true,
            settingsSnapshot: { adapterCode: "SHIPROCKET", webhookSecret: "valid-secret" },
          }),
        },
      },
    };
    const service = new CourierLogisticsService(prisma as never, undefined as never);

    await expect(
      service.handleTrackingWebhook("SHIPROCKET", { status: "DELIVERED" }, "wrong-secret"),
    ).rejects.toThrow(new UnauthorizedException("Invalid Shiprocket webhook signature."));
  });
});

function routingFailureShipment() {
  const now = new Date("2026-07-02T12:00:00.000Z");

  return {
    id: "shipment-1",
    shipmentNumber: "SHP-1001",
    deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
    status: DeliveryStatus.PENDING,
    assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
    assignmentExpiresAt: null,
    routingFailed: true,
    routingFailureReason: "COURIER_PROVIDER_INACTIVE",
    routingFailureNote: "No active provider was available.",
    routingFirstFailedAt: now,
    routingPermanentFailureAt: null,
    courierProviderCode: "SHIPROCKET",
    deliveryPartnerUserId: null,
    assignmentNote: null,
    deliveryPartner: null,
    courierCodRemittance: null,
    order: {
      id: "order-1",
      orderNumber: "1HI-1001",
      paymentStatus: PaymentStatus.PENDING,
      deliveryStatus: DeliveryStatus.PENDING,
      shippingAddressSnapshot: { city: "Coimbatore" },
      createdAt: now,
    },
    seller: {
      id: "seller-1",
      storeName: "Coimbatore Store",
      sellerType: SellerType.MARKETPLACE_SELLER,
      profile: null,
    },
    packages: [
      {
        id: "package-1",
        packageNumber: "PKG-1001",
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        status: OrderShipmentPackageStatus.BOOKING_PENDING,
        weightGrams: 500,
        lengthCm: 10,
        breadthCm: 8,
        heightCm: 6,
        declaredValuePaise: 99900,
        shippingPaise: 6000,
        codSurchargePaise: 0,
        sequence: 1,
        courierPackages: [],
      },
    ],
    courierShipment: {
      id: "courier-shipment-1",
      trackingStatus: CourierShipmentStatus.FAILED,
      awbNumber: "AWB1001",
      trackingUrl: "https://courier.example/track/AWB1001",
    },
  };
}

function courierLabelPackage(labelUrl: string) {
  return {
    id: "package-1",
    packageNumber: "PKG-1001",
    deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
    courierPackages: [
      {
        labelUrl,
        trackingStatus: CourierShipmentStatus.BOOKED,
        courierConsignment: {
          providerCode: "SHIPROCKET",
        },
      },
    ],
  };
}

function localDeliveryShipment({
  deliveryPartnerUserId,
  assignmentStatus,
}: {
  deliveryPartnerUserId: string | null;
  assignmentStatus: DeliveryAssignmentStatus;
}) {
  return {
    id: "shipment-1",
    orderId: "order-1",
    deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
    status: DeliveryStatus.PENDING,
    deliveryPartnerUserId,
    assignmentStatus,
    order: {
      orderStatus: OrderStatus.PROCESSING,
      deliveryStatus: DeliveryStatus.PENDING,
      deliveryDetail: {
        id: "delivery-detail-1",
        status: DeliveryStatus.PENDING,
        deliveryPartnerUserId,
        assignmentStatus,
      },
    },
  };
}

function courierAssignmentTransactionMocks() {
  return {
    deliveryDetail: {
      upsert: vi.fn().mockResolvedValue({
        id: "delivery-detail-1",
        status: DeliveryStatus.PENDING,
      }),
    },
    deliveryAssignmentAttempt: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "attempt-1" }),
    },
    orderShipment: {
      update: vi.fn().mockResolvedValue({ id: "shipment-1" }),
    },
    deliveryEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}
