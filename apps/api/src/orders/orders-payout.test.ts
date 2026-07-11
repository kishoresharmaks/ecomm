import { describe, expect, it, vi, beforeEach } from "vitest";
import { OrdersService } from "./orders.service";
import { PaymentProvider } from "@indihub/database";

describe("Delivery Partner Payout Calculation", () => {
  let service: any;
  let txMock: any;

  beforeEach(() => {
    // Create a mock OrdersService with minimal dependencies
    service = new OrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getDeliveryPartnerPayoutSettings: vi.fn().mockResolvedValue({
          minimumPerOrderPaise: 4000,
          includedDistanceKm: 3,
          basePayPaise: 4000,
          perKmPaise: 800,
          codBonusPaise: 500,
          freeDeliveryPlatformSubsidyEnabled: true,
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    txMock = {
      orderShipment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "shipment_1",
            orderId: "order_1",
            deliveryPartnerUserId: "partner_1",
            shippingPaise: 0,
            seller: { addresses: [{}] },
            order: {
              orderNumber: "ORD-123",
              currency: "INR",
              payments: [{ provider: PaymentProvider.RAZORPAY, method: "RAZORPAY" }],
              shippingAddressSnapshot: null,
            },
          },
        ]),
      },
      deliveryPartnerWalletEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "entry_1" }),
      },
      setting: {
        findMany: vi.fn().mockResolvedValue([
          { key: "delivery_partner.payout.minimum_per_order_paise", value: 4000 },
          { key: "delivery_partner.payout.included_distance_km", value: 3 },
          { key: "delivery_partner.payout.base_pay_paise", value: 4000 },
          { key: "delivery_partner.payout.per_km_paise", value: 800 },
          { key: "delivery_partner.payout.cod_bonus_paise", value: 500 },
          { key: "delivery_partner.payout.free_delivery_platform_subsidy_enabled", value: true },
        ]),
      },
    };
  });

  it("pays base pay for distance under included distance (1km)", async () => {
    vi.spyOn(service, "deliveryPartnerEarningDistance").mockResolvedValue({
      distanceKm: 1,
      provider: "HAVERSINE",
      accuracy: "STRAIGHT_LINE",
    });

    await service.creditLocalDeliveryPartnerEarnings(txMock, {
      orderId: "order_1",
      shipmentId: "shipment_1",
      deliveryPartnerUserId: "partner_1",
      createdById: "system",
      deliveryDetailId: "detail_1",
    });

    // 1km is < 3km included. Formula: 40 + MAX(0, 1-3) * 8 = 40.
    expect(txMock.deliveryPartnerWalletEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 4000, // 40 rupees
          metadata: expect.objectContaining({
            calculation: expect.objectContaining({
              billableDistanceKm: 0,
              perKmPayPaise: 0,
            }),
          }),
        }),
      }),
    );
  });

  it("pays base pay for distance equal to included distance (3km)", async () => {
    vi.spyOn(service, "deliveryPartnerEarningDistance").mockResolvedValue({
      distanceKm: 3,
      provider: "HAVERSINE",
      accuracy: "STRAIGHT_LINE",
    });

    await service.creditLocalDeliveryPartnerEarnings(txMock, {
      orderId: "order_1",
      shipmentId: "shipment_1",
      deliveryPartnerUserId: "partner_1",
      createdById: "system",
      deliveryDetailId: "detail_1",
    });

    // 3km is == 3km included. Formula: 40 + MAX(0, 3-3) * 8 = 40.
    expect(txMock.deliveryPartnerWalletEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 4000,
          metadata: expect.objectContaining({
            calculation: expect.objectContaining({
              billableDistanceKm: 0,
              perKmPayPaise: 0,
            }),
          }),
        }),
      }),
    );
  });

  it("pays base pay plus extra for distance over included distance (5km)", async () => {
    vi.spyOn(service, "deliveryPartnerEarningDistance").mockResolvedValue({
      distanceKm: 5,
      provider: "HAVERSINE",
      accuracy: "STRAIGHT_LINE",
    });

    await service.creditLocalDeliveryPartnerEarnings(txMock, {
      orderId: "order_1",
      shipmentId: "shipment_1",
      deliveryPartnerUserId: "partner_1",
      createdById: "system",
      deliveryDetailId: "detail_1",
    });

    // 5km > 3km included. Extra = 2km. Formula: 40 + (2 * 8) = 56.
    expect(txMock.deliveryPartnerWalletEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 5600, // 56 rupees
          metadata: expect.objectContaining({
            calculation: expect.objectContaining({
              billableDistanceKm: 2,
              perKmPayPaise: 1600, // 2km * 8 rupees
            }),
          }),
        }),
      }),
    );
  });

  it("adds COD bonus correctly (5km + COD)", async () => {
    txMock.orderShipment.findMany.mockResolvedValue([
      {
        id: "shipment_1",
        orderId: "order_1",
        deliveryPartnerUserId: "partner_1",
        shippingPaise: 0,
        seller: { addresses: [{}] },
        order: {
          orderNumber: "ORD-123",
          currency: "INR",
          payments: [{ provider: PaymentProvider.COD, method: "COD" }], // COD PAYMENT
          shippingAddressSnapshot: null,
        },
      },
    ]);

    vi.spyOn(service, "deliveryPartnerEarningDistance").mockResolvedValue({
      distanceKm: 5,
      provider: "HAVERSINE",
      accuracy: "STRAIGHT_LINE",
    });

    await service.creditLocalDeliveryPartnerEarnings(txMock, {
      orderId: "order_1",
      shipmentId: "shipment_1",
      deliveryPartnerUserId: "partner_1",
      createdById: "system",
      deliveryDetailId: "detail_1",
    });

    // 5km > 3km included. Extra = 2km. Formula: 40 + (2 * 8) + 5 COD = 61.
    expect(txMock.deliveryPartnerWalletEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 6100, // 61 rupees
        }),
      }),
    );
  });
});
