import { DeliveryAssignmentStatus } from "@indihub/database";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OrdersService } from "./orders.service";

describe("OrdersService - autoAssignDeliveryBatch", () => {
  it("calculates COD sum, exclusions, workload and syncs shipment", async () => {
    const mockPrisma = {
      client: {
        $transaction: vi.fn(async (cb) => {
          return cb(mockPrisma.client);
        }),
        $queryRaw: vi.fn().mockResolvedValue([]),
        user: { findMany: vi.fn() },
        orderShipment: { updateMany: vi.fn() },
        deliveryDetail: { updateMany: vi.fn() },
        deliveryAssignmentAttempt: { create: vi.fn() },
        deliveryEvent: { create: vi.fn() }
      }
    };

    const service = new OrdersService(
      mockPrisma as never,
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
      undefined as never
    );

    const mockOrder1 = {
      id: "o1", orderNumber: "O-1", subtotalPaise: 10000, paymentStatus: "PENDING",
      payments: [{ method: "COD", amountPaise: 10000 }],
      shippingAddressSnapshot: { latitude: 12.0, longitude: 77.0 },
      deliveryDetail: { id: "d1", status: "PACKED" },
      shipments: [{ id: "s1", seller: { addresses: [{ latitude: "12.0", longitude: "77.0" }] } }]
    } as any;
    const mockOrder2 = {
      id: "o2", orderNumber: "O-2", subtotalPaise: 5000, paymentStatus: "PENDING",
      payments: [{ method: "COD", amountPaise: 5000 }],
      shippingAddressSnapshot: { latitude: 12.0, longitude: 77.0 },
      deliveryDetail: { id: "d2", status: "PACKED" },
      shipments: [{ id: "s2", seller: { addresses: [{ latitude: "12.0", longitude: "77.0" }] } }]
    } as any;

    const rejectedSpy = vi.spyOn(service as any, "rejectedDeliveryPartnerIds").mockResolvedValue(["rejected-1"]);
    const metricsSpy = vi.spyOn(service as any, "deliveryPartnerAssignmentMetrics").mockResolvedValue({
      workload: new Map([["candidate-1", 1]]),
      rejected: new Map(),
      codExposurePaise: new Map([["candidate-1", 0]]),
      lastAssignmentAt: new Map()
    });
    const proximitySpy = vi.spyOn(service as any, "deliveryPartnerProximityDistances").mockResolvedValue(new Map([["candidate-1", 500]]));
    const findCodPaymentSpy = vi.spyOn(service as any, "findCodPayment").mockImplementation((o: any) => o.payments[0]);
    vi.spyOn(service as any, "defaultPartnerCodLimitPaise").mockResolvedValue(20000);
    vi.spyOn(service as any, "deliveryPartnerServiceAreaScore").mockReturnValue({ eligible: true, warnings: [] });

    mockPrisma.client.user.findMany.mockResolvedValue([{
      id: "candidate-1",
      deliveryProfile: { codCollectionLimitPaise: 20000, isAvailable: true }
    }]);

    await service.autoAssignDeliveryBatch([mockOrder1, mockOrder2], { id: "admin-1" } as any, "batch note");

    expect(findCodPaymentSpy).toHaveBeenCalledTimes(3);
    expect(rejectedSpy).toHaveBeenCalledTimes(2);

    expect(mockPrisma.client.orderShipment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["s1", "s2"] } }),
      data: expect.objectContaining({
        deliveryPartnerUserId: "candidate-1",
        assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
      })
    }));

    expect(mockPrisma.client.deliveryDetail.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["d1", "d2"] } }),
      data: expect.objectContaining({
        deliveryPartnerUserId: "candidate-1"
      })
    }));
  });
});
