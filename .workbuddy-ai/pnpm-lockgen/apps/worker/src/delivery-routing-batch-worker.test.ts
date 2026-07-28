import {
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryStatus,
  OrderStatus,
  prisma,
} from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeInternalApiBaseUrl, processDeliveryBatches } from "./delivery-routing-batch-worker";

vi.mock("@indihub/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@indihub/database")>();
  return {
    ...actual,
    prisma: {
      orderShipment: {
        findMany: vi.fn(),
      },
    },
  };
});

const db = prisma as unknown as {
  orderShipment: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe("delivery routing batch worker", () => {
  const originalInternalApiUrl = process.env.INTERNAL_API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalInternalSecret = process.env.INTERNAL_API_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T10:00:00.000Z"));
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    process.env.INTERNAL_API_SECRET = "test-secret";
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    restoreEnv("INTERNAL_API_URL", originalInternalApiUrl);
    restoreEnv("NEXT_PUBLIC_API_URL", originalPublicApiUrl);
    restoreEnv("INTERNAL_API_SECRET", originalInternalSecret);
  });

  it("groups packed local-delivery shipments by seller and posts to the prefixed internal API", async () => {
    db.orderShipment.findMany.mockResolvedValue([
      { id: "shipment-1", orderId: "order-1", sellerId: "seller-a" },
      { id: "shipment-2", orderId: "order-2", sellerId: "seller-a" },
      { id: "shipment-3", orderId: "order-3", sellerId: "seller-b" },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(processDeliveryBatches()).resolves.toEqual({
      processedBatches: 2,
      totalOrders: 4,
    });

    expect(db.orderShipment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: DeliveryStatus.PACKED,
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        updatedAt: { lte: new Date("2026-07-11T09:57:00.000Z") },
        order: {
          orderStatus: { not: OrderStatus.CANCELLED },
          deliveryStatus: { not: DeliveryStatus.CANCELLED },
        },
        OR: [
          { deliveryPartnerUserId: null },
          {
            assignmentStatus: {
              in: [DeliveryAssignmentStatus.REJECTED, DeliveryAssignmentStatus.CANCELLED],
            },
          },
        ],
      }),
      select: { id: true, orderId: true, sellerId: true },
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/internal/delivery/batch-assign",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-internal-secret": "test-secret" }),
        body: JSON.stringify({
          orderIds: ["order-1", "order-2"],
          shipmentIds: ["shipment-1", "shipment-2"],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/internal/delivery/batch-assign",
      expect.objectContaining({
        body: JSON.stringify({ orderIds: ["order-3"], shipmentIds: ["shipment-3"] }),
      }),
    );
  });

  it("does not duplicate the api prefix when the base URL already includes it", () => {
    expect(normalizeInternalApiBaseUrl("https://api.1handindia.com/api/")).toBe(
      "https://api.1handindia.com/api",
    );
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
