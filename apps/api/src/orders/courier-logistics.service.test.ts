import {
  CourierShipmentStatus,
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryStatus,
  OrderShipmentPackageStatus,
  PaymentStatus,
  SellerType,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { CourierLogisticsService } from "./courier-logistics.service";

describe("CourierLogisticsService", () => {
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
