import { DeliveryAssignmentStatus } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import type { RequestUser } from "../auth/types/indihub-request";
import { OrdersService } from "./orders.service";

type BatchOrder = Parameters<OrdersService["autoAssignDeliveryBatch"]>[0][number];
type CodPaymentOrder = {
  payments: Array<{ amountPaise: number }>;
};

type OrdersServiceTestAccess = {
  rejectedDeliveryPartnerIds(orderId: string): Promise<Set<string>>;
  deliveryPartnerAssignmentMetrics(partnerIds: string[]): Promise<{
    workload: Map<string, number>;
    codExposurePaise: Map<string, number>;
    lastAssignmentAt: Map<string, Date>;
  }>;
  deliveryPartnerProximityDistances(
    address: unknown,
    rejectedPartnerIds: Set<string>,
  ): Promise<Map<string, number>>;
  findCodPayment(order: CodPaymentOrder): CodPaymentOrder["payments"][number] | null;
  defaultPartnerCodLimitPaise(): Promise<number>;
  deliveryPartnerServiceAreaScore(...args: unknown[]): {
    eligible: boolean;
    score: number;
    matchLabel: string;
    matchedFields: string[];
    warnings: string[];
  };
};

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
      undefined as never,
      undefined as never,
    );

    const mockOrder1 = {
      id: "o1", orderNumber: "O-1", subtotalPaise: 10000, paymentStatus: "PENDING",
      payments: [{ method: "COD", amountPaise: 10000 }],
      shippingAddressSnapshot: { latitude: 12.0, longitude: 77.0 },
      deliveryDetail: { id: "d1", status: "PACKED" },
      shipments: [{ id: "s1", seller: { addresses: [{ latitude: "12.0", longitude: "77.0" }] } }]
    } as unknown as BatchOrder;
    const mockOrder2 = {
      id: "o2", orderNumber: "O-2", subtotalPaise: 5000, paymentStatus: "PENDING",
      payments: [{ method: "COD", amountPaise: 5000 }],
      shippingAddressSnapshot: { latitude: 12.0, longitude: 77.0 },
      deliveryDetail: { id: "d2", status: "PACKED" },
      shipments: [{ id: "s2", seller: { addresses: [{ latitude: "12.0", longitude: "77.0" }] } }]
    } as unknown as BatchOrder;

    const testAccess = service as unknown as OrdersServiceTestAccess;
    const rejectedSpy = vi
      .spyOn(testAccess, "rejectedDeliveryPartnerIds")
      .mockResolvedValue(new Set(["rejected-1"]));
    vi.spyOn(testAccess, "deliveryPartnerAssignmentMetrics").mockResolvedValue({
      workload: new Map([["candidate-1", 1]]),
      codExposurePaise: new Map([["candidate-1", 0]]),
      lastAssignmentAt: new Map(),
    });
    vi.spyOn(testAccess, "deliveryPartnerProximityDistances").mockResolvedValue(
      new Map([["candidate-1", 500]]),
    );
    const findCodPaymentSpy = vi
      .spyOn(testAccess, "findCodPayment")
      .mockImplementation((order) => order.payments[0] ?? null);
    vi.spyOn(testAccess, "defaultPartnerCodLimitPaise").mockResolvedValue(20000);
    vi.spyOn(testAccess, "deliveryPartnerServiceAreaScore").mockReturnValue({
      eligible: true,
      score: 100,
      matchLabel: "test service area",
      matchedFields: [],
      warnings: [],
    });

    mockPrisma.client.user.findMany.mockResolvedValue([{
      id: "candidate-1",
      deliveryProfile: { codCollectionLimitPaise: 20000, isAvailable: true }
    }]);

    const actor: RequestUser = {
      id: "admin-1",
      clerkUserId: null,
      email: "admin@example.com",
      roles: [],
    };
    await service.autoAssignDeliveryBatch([mockOrder1, mockOrder2], actor, "batch note");

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
