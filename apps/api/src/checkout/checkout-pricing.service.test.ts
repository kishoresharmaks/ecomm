import { describe, expect, it, vi } from "vitest";
import { DeliveryMode, SellerType } from "@indihub/database";
import { CheckoutPricingService } from "./checkout-pricing.service";
import { CheckoutDeliveryPreference } from "./dto/delivery-routing.dto";

describe("CheckoutPricingService", () => {
  it("adds buyer platform fee to checkout total when enabled", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", 0),
          setting("checkout.platform_fee.enabled", true),
          setting("checkout.platform_fee.type", "PERCENTAGE"),
          setting("checkout.platform_fee.value_bps", 100),
          setting("checkout.platform_fee.fixed_paise", 0)
        ])
      }
    };
    const service = new CheckoutPricingService({ client: tx } as never, undefined);

    const result = await service.calculateCharges(10000, tx as never);

    expect(result).toMatchObject({
      subtotalPaise: 10000,
      shippingPaise: 0,
      platformFeePaise: 100,
      totalPaise: 10100
    });
  });

  it("keeps fixed buyer platform fee as one order-level charge", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", 0),
          setting("checkout.platform_fee.enabled", true),
          setting("checkout.platform_fee.type", "FIXED"),
          setting("checkout.platform_fee.value_bps", 1000),
          setting("checkout.platform_fee.fixed_paise", 500)
        ])
      }
    };
    const service = new CheckoutPricingService({ client: tx } as never, undefined);

    const oneItemResult = await service.calculateCharges(10000, tx as never);
    const multipleQuantityResult = await service.calculateCharges(50000, tx as never);

    expect(oneItemResult).toMatchObject({
      subtotalPaise: 10000,
      platformFeePaise: 500,
      totalPaise: 10500
    });
    expect(multipleQuantityResult).toMatchObject({
      subtotalPaise: 50000,
      platformFeePaise: 500,
      totalPaise: 50500
    });
  });

  it("keeps percentage buyer platform fee tied to the order subtotal", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", 0),
          setting("checkout.platform_fee.enabled", true),
          setting("checkout.platform_fee.type", "PERCENTAGE"),
          setting("checkout.platform_fee.value_bps", 1000),
          setting("checkout.platform_fee.fixed_paise", 500)
        ])
      }
    };
    const service = new CheckoutPricingService({ client: tx } as never, undefined);

    const oneItemResult = await service.calculateCharges(10000, tx as never);
    const multipleQuantityResult = await service.calculateCharges(50000, tx as never);

    expect(oneItemResult.platformFeePaise).toBe(1000);
    expect(oneItemResult.totalPaise).toBe(11000);
    expect(multipleQuantityResult.platformFeePaise).toBe(5000);
    expect(multipleQuantityResult.totalPaise).toBe(55000);
  });

  it("keeps platform fee zero when checkout fee is disabled", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", 500),
          setting("checkout.platform_fee.enabled", false),
          setting("checkout.platform_fee.type", "PERCENTAGE"),
          setting("checkout.platform_fee.value_bps", 100)
        ])
      }
    };
    const service = new CheckoutPricingService({ client: tx } as never, undefined);

    const result = await service.calculateCharges(10000, tx as never);

    expect(result.platformFeePaise).toBe(0);
    expect(result.totalPaise).toBe(10500);
  });

  it("honors legacy string-stored checkout fee settings after restart", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", "0"),
          setting("checkout.platform_fee.enabled", "true"),
          setting("checkout.platform_fee.type", "PERCENTAGE"),
          setting("checkout.platform_fee.value_bps", "250"),
          setting("checkout.platform_fee.fixed_paise", "0")
        ])
      }
    };
    const service = new CheckoutPricingService({ client: tx } as never, undefined);

    const result = await service.calculateCharges(10000, tx as never);

    expect(result.platformFeePaise).toBe(250);
    expect(result.totalPaise).toBe(10250);
  });

  it("uses delivery routing output as the immutable checkout shipping charge", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", 99900),
          setting("checkout.platform_fee.enabled", false),
          setting("checkout.platform_fee.type", "PERCENTAGE"),
          setting("checkout.platform_fee.value_bps", 0),
          setting("checkout.platform_fee.fixed_paise", 0)
        ])
      }
    };
    const routing = {
      resolveDelivery: vi.fn().mockResolvedValue({
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        totalDeliveryChargePaise: 7500,
        shippingSnapshot: {
          source: "RATE_CARD",
          chargePaise: 5000
        },
        codSurchargeSnapshot: {
          type: "FLAT",
          amountPaise: 2500
        },
        routingSnapshot: {
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          matchedRateCardId: "rate-1"
        }
      })
    };
    const service = new CheckoutPricingService({ client: tx } as never, routing as never);

    const result = await service.calculateCharges(10000, tx as never, {
      deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
      paymentMethod: "COD",
      address: { countryCode: "IN", stateCode: "IN-TN", pincode: "636114" }
    });

    expect(result.shippingPaise).toBe(7500);
    expect(result.totalPaise).toBe(17500);
    expect(result.snapshot).toMatchObject({
      shipping: {
        chargePaise: 7500,
        routing: {
          source: "RATE_CARD",
          chargePaise: 5000
        },
        codSurcharge: {
          type: "FLAT",
          amountPaise: 2500
        }
      }
    });
    expect(routing.resolveDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        paymentMethod: "COD",
        subtotalPaise: 10000
      }),
      tx
    );
  });

  it("filters product-enabled package delivery modes by checkout preference", async () => {
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          setting("shipping.default_charge_paise", 0),
          setting("checkout.platform_fee.enabled", false),
          setting("checkout.platform_fee.type", "PERCENTAGE"),
          setting("checkout.platform_fee.value_bps", 0),
          setting("checkout.platform_fee.fixed_paise", 0)
        ])
      }
    };
    const routing = {
      resolveAllDeliveryOptions: vi.fn().mockImplementation((_input, modes: DeliveryMode[]) =>
        Promise.resolve(
          modes.map((mode) => ({
            mode,
            quote: deliveryQuote(mode),
          })),
        ),
      ),
    };
    const service = new CheckoutPricingService({ client: tx } as never, routing as never);
    const sellerPackage = {
      sellerId: "seller_1",
      sellerName: "Seller One",
      sellerType: SellerType.MARKETPLACE_SELLER,
      subtotalPaise: 10000,
      allowedDeliveryModes: [
        DeliveryMode.STORE_PICKUP,
        DeliveryMode.LOCAL_DELIVERY_PARTNER,
        DeliveryMode.MANUAL_TRANSPORT,
      ],
      items: [],
      package: { weightGrams: 500, lengthCm: 20, breadthCm: 15, heightCm: 8, itemCount: 1 },
    };

    const pickupResult = await service.calculateSellerPackageCharges(
      10000,
      [sellerPackage],
      tx as never,
      {
        deliveryPreference: CheckoutDeliveryPreference.STORE_PICKUP,
        paymentMethod: "COD",
      },
    );
    const deliverResult = await service.calculateSellerPackageCharges(
      10000,
      [sellerPackage],
      tx as never,
      {
        deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        paymentMethod: "COD",
        address: { countryCode: "IN", stateCode: "IN-TN", pincode: "636114" },
      },
    );

    expect(pickupResult.sellerDeliveryGroups?.[0]?.availableDeliveryOptions.map((option) => option.mode)).toEqual([
      DeliveryMode.STORE_PICKUP,
    ]);
    expect(deliverResult.sellerDeliveryGroups?.[0]?.availableDeliveryOptions.map((option) => option.mode)).toEqual([
      DeliveryMode.LOCAL_DELIVERY_PARTNER,
      DeliveryMode.MANUAL_TRANSPORT,
    ]);
    expect(routing.resolveAllDeliveryOptions).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      [DeliveryMode.STORE_PICKUP],
      tx,
    );
    expect(routing.resolveAllDeliveryOptions).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      [DeliveryMode.LOCAL_DELIVERY_PARTNER, DeliveryMode.MANUAL_TRANSPORT],
      tx,
    );
  });
});

function setting(key: string, value: boolean | number | string) {
  return { key, value };
}

function deliveryQuote(mode: DeliveryMode) {
  return {
    deliveryMode: mode,
    totalDeliveryChargePaise: mode === DeliveryMode.STORE_PICKUP ? 0 : 500,
    shippingChargePaise: mode === DeliveryMode.STORE_PICKUP ? 0 : 500,
    codSurchargePaise: 0,
    shippingSnapshot: {},
    codSurchargeSnapshot: null,
    routingSnapshot: { deliveryMode: mode },
    routingFailed: false,
    routingFailureNote: null,
  };
}
