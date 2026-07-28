import { describe, expect, it, vi } from "vitest";
import {
  CourierProviderMode,
  DeliveryMode,
  DeliveryRoutingFailureReason,
  Prisma,
} from "@indihub/database";
import {
  DeliveryRoutingService,
  type DeliveryRoutingAddress,
  type DeliveryRoutingQuote,
} from "./delivery-routing.service";
import { RouteDistanceService } from "../maps/route-distance.service";
import {
  CheckoutDeliveryPreference,
  CheckoutRoutingPaymentMethod,
} from "./dto/delivery-routing.dto";

type ShippingRateCard = Prisma.ShippingRateCardGetPayload<Record<string, never>>;

type DeliveryRoutingServiceTestAccess = {
  resolveRateCardCharge(
    card: ShippingRateCard | null,
    address: DeliveryRoutingAddress | null,
    sellerId?: string | null,
  ): Promise<number | null>;
  nonNegativeInt(value: number): number;
};

describe("DeliveryRoutingService location serviceability", () => {
  it("summarizes ready location coverage from location, seller, delivery, rate-card, and payment data", async () => {
    const prisma = {
      client: {
        locationCountry: {
          findUnique: vi.fn().mockResolvedValue({
            id: "country-in",
            code: "IN",
            name: "India",
            enabled: true,
          }),
        },
        locationSubdivision: {
          findFirst: vi.fn().mockResolvedValue({
            id: "state-tn",
            code: "IN-TN",
            name: "Tamil Nadu",
            active: true,
          }),
        },
        locationCity: {
          findFirst: vi.fn().mockResolvedValue({
            id: "city-cbe",
            code: "IN-TN-CBE",
            name: "Coimbatore",
            active: true,
          }),
        },
        locationArea: {
          findFirst: vi.fn().mockResolvedValue({
            id: "area-rs",
            code: "PIN-641012-RS",
            name: "R S Puram",
            postalCode: "641012",
            active: true,
          }),
        },
        seller: {
          count: vi
            .fn()
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(4),
        },
        user: { count: vi.fn().mockResolvedValue(5) },
        shippingRateCard: { count: vi.fn().mockResolvedValue(7) },
        courierProviderSetting: { count: vi.fn().mockResolvedValue(2) },
      },
    };
    const payments = {
      checkoutMethods: vi.fn().mockResolvedValue({
        methods: [
          { method: CheckoutRoutingPaymentMethod.COD, label: "Cash on delivery", enabled: true, maxOrderPaise: 200000 },
          { method: CheckoutRoutingPaymentMethod.RAZORPAY, label: "Razorpay", enabled: true },
        ],
      }),
    };
    const service = new DeliveryRoutingService(
      prisma as never,
      undefined as never,
      undefined as never,
      payments as never,
      undefined as never,
    );
    vi.spyOn(service, "resolveDelivery").mockResolvedValue(readyQuote());

    const result = await service.locationServiceabilitySummary({
      countryCode: "IN",
      stateCode: "IN-TN",
      cityCode: "IN-TN-CBE",
      localAreaCode: "PIN-641012-RS",
      pincode: "641012",
      subtotalPaise: 99900,
      paymentMethod: CheckoutRoutingPaymentMethod.COD,
    });

    expect(result.status).toBe("READY");
    expect(result.readiness).toEqual({
      locationKnown: true,
      deliveryAvailable: true,
      codAvailable: true,
      sellerCoverage: true,
      deliveryPartnerCoverage: true,
      shippingRateConfigured: true,
    });
    expect(result.knownLocation.localArea).toMatchObject({
      code: "PIN-641012-RS",
      postalCode: "641012",
    });
    expect(result.coverage).toMatchObject({
      approvedSellerCount: 12,
      exactSellerCount: 1,
      citySellerCount: 2,
      activeDeliveryPartnerCount: 5,
      eligibleLocalPartnerCount: 1,
      activeShippingRateCardCount: 7,
      activeCourierProviderCount: 2,
    });
    expect(result.payments).toMatchObject({
      requestedMethod: CheckoutRoutingPaymentMethod.COD,
      requestedMethodEnabled: true,
      codEnabled: true,
      codMaxOrderPaise: 200000,
    });
    expect(service.resolveDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        subtotalPaise: 99900,
        paymentMethod: CheckoutRoutingPaymentMethod.COD,
      }),
    );
    expect(payments.checkoutMethods).toHaveBeenCalledWith(104900);
  });

  it("uses a live Shiprocket preferred courier quote as checkout shipping", async () => {
    const quoteShipment = vi.fn().mockResolvedValue({
      serviceable: true,
      providerCode: "SHIPROCKET",
      courierCompanyId: "43",
      courierName: "DTDC Surface",
      courierCode: "DTDC",
      freightChargePaise: 12000,
      codChargePaise: 345,
      totalChargePaise: 12345,
      currency: "INR",
      estimatedDeliveryDays: "2-4",
      shippingZone: "B",
      quotePayloadSnapshot: { pickup_postcode: "636001", delivery_postcode: "641012" },
      quoteResponseSnapshot: { data: { available_courier_companies: [] } },
    });
    const prisma = {
      client: {
        courierProviderSetting: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "provider-1",
              providerCode: "SHIPROCKET",
              displayName: "Shiprocket",
              mode: CourierProviderMode.LIVE,
              isActive: true,
              serviceableCountryCodes: ["IN"],
              credentialsConfigured: true,
              webhookSecretConfigured: true,
              notes: null,
              createdAt: new Date("2026-07-08T00:00:00.000Z"),
              updatedAt: new Date("2026-07-08T00:00:00.000Z"),
              settingsSnapshot: {
                providerCode: "SHIPROCKET",
                adapterCode: "SHIPROCKET",
                preferredCourierCompanyId: "43",
                username: "shiprocket-user",
                credentials: { password: "shiprocket-password" },
                defaultPackage: { weightGrams: 500, lengthCm: 20, breadthCm: 15, heightCm: 8 },
                liveApiCallsEnabled: true,
              },
            },
          ]),
        },
        seller: {
          findUnique: vi.fn().mockResolvedValue({
            id: "seller-1",
            storeName: "Test Seller",
            profile: { contactEmail: "seller@example.com", contactPhone: "9876543210" },
            addresses: [
              {
                line1: "Seller street",
                line2: null,
                area: "Salem",
                city: "Salem",
                state: "Tamil Nadu",
                pincode: "636001",
                country: "India",
                countryCode: "IN",
                createdAt: new Date("2026-07-08T00:00:00.000Z"),
              },
            ],
          }),
        },
        shippingRateCard: { findMany: vi.fn().mockResolvedValue([]) },
        setting: { findUnique: vi.fn().mockResolvedValue(setting("shipping.default_charge_paise", 99900)) },
      },
    };
    const adapters = {
      getAdapter: vi.fn().mockReturnValue({ quoteShipment }),
    };
    const service = new DeliveryRoutingService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      adapters as never,
    );

    const result = await service.resolveDelivery({
      requestedDeliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
      address: {
        fullName: "Buyer",
        phone: "9999999999",
        line1: "Buyer street",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641012",
        country: "India",
        countryCode: "IN",
      },
      subtotalPaise: 50000,
      paymentMethod: CheckoutRoutingPaymentMethod.COD,
      sellerId: "seller-1",
      sellerType: null,
      package: { weightGrams: 750, lengthCm: 22, breadthCm: 16, heightCm: 10 },
    });

    expect(result.shippingChargePaise).toBe(12000);
    expect(result.codSurchargePaise).toBe(345);
    expect(result.totalDeliveryChargePaise).toBe(12345);
    expect(result.shippingSnapshot).toMatchObject({
      source: "LIVE_COURIER_QUOTE",
      chargePaise: 12000,
      liveCourierQuote: {
        preferredCourierCompanyId: "43",
        courierCompanyId: "43",
        courierName: "DTDC Surface",
        totalChargePaise: 12345,
      },
    });
    expect(quoteShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCode: "SHIPROCKET",
        paymentMethod: "COD",
        subtotalPaise: 50000,
        codAmountPaise: 50000,
        sellerAddress: expect.objectContaining({ pincode: "636001" }),
        shippingAddress: expect.objectContaining({ pincode: "641012" }),
        parcel: expect.objectContaining({ weightGrams: 750 }),
        settings: expect.objectContaining({ preferredCourierCompanyId: "43" }),
      }),
    );
  });
});

function readyQuote(): DeliveryRoutingQuote {
  return {
    deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
    deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
    recommendedPartnerUserId: "partner-1",
    recommendedPartnerName: "Local partner",
    partnerMatchLabel: "local area",
    partnerSpecificityScore: 5,
    courierProviderCode: null,
    matchedRateCardId: "rate-1",
    matchedRateCardName: "Coimbatore local",
    rateCardSpecificityScore: 5,
    shippingChargePaise: 5000,
    codSurchargePaise: 0,
    totalDeliveryChargePaise: 5000,
    freeShippingApplied: false,
    routingFailed: false,
    routingFailureReason: null as DeliveryRoutingFailureReason | null,
    routingFailureNote: null,
    fallbackReason: null,
    warnings: [],
    diagnostics: {
      localPartnersChecked: 2,
      localEligiblePartners: 1,
      rejectedPartnersSkipped: 0,
      codLimitSkipped: 0,
      rateCardsChecked: 3,
      providerChecked: null,
    },
    shippingSnapshot: { source: "RATE_CARD" } as Prisma.InputJsonObject,
    codSurchargeSnapshot: { type: "NONE" } as Prisma.InputJsonObject,
    routingSnapshot: { matchedRateCardId: "rate-1" } as Prisma.InputJsonObject,
  };
}

function setting(key: string, value: boolean | number | string) {
  return { key, value };
}

// ─── ShippingRateCard Pricing Strategy Tests ─────────────────────────────────

describe("DeliveryRoutingService shipping pricing strategies", () => {
  function makeService(customRouteDistanceService?: object): DeliveryRoutingServiceTestAccess {
    const prisma = {
      client: {
        sellerAddress: {
          findFirst: vi.fn().mockResolvedValue({
            latitude: 12.971598,
            longitude: 77.594562,
          }),
        },
      },
    };
    return new DeliveryRoutingService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      customRouteDistanceService as never,
    ) as unknown as DeliveryRoutingServiceTestAccess;
  }

  function makeCard(overrides: Partial<{
    pricingType: import("@indihub/database").ShippingPricingType;
    baseChargePaise: number;
    pricingConfig: Record<string, unknown> | null;
  }>) {
    return {
      id: "card-1",
      name: "Test card",
      deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
      countryCode: null,
      stateCode: null,
      cityCode: null,
      pincode: null,
      localAreaCode: null,
      minSubtotalPaise: null,
      maxSubtotalPaise: null,
      pricingType: "FLAT" as import("@indihub/database").ShippingPricingType,
      baseChargePaise: 5000,
      pricingConfig: null,
      freeAbovePaise: null,
      codSurchargeType: "NONE" as import("@indihub/database").ShippingCodSurchargeType,
      codSurchargeFlatPaise: 0,
      codSurchargeBps: 0,
      priority: 100,
      isActive: true,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as unknown as import("@indihub/database").Prisma.ShippingRateCardGetPayload<Record<string, never>>;
  }

  it("FLAT strategy returns baseChargePaise directly", async () => {
    const service = makeService();
    const card = makeCard({ pricingType: "FLAT" as never, baseChargePaise: 4900 });
    expect(await service.resolveRateCardCharge(card, null)).toBe(4900);
  });

  it("DISTANCE strategy returns baseChargePaise when delivery is within includedDistanceKm", async () => {
    const service = makeService();
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3, perKmPaise: 800 },
    });
    // Route distance defaults to 0 in unit test (no GPS). 0 < 3, so no extra charge.
    expect(await service.resolveRateCardCharge(card, null)).toBe(4000);
  });

  it("returns null for a null card", async () => {
    const service = makeService();
    expect(await service.resolveRateCardCharge(null, null)).toBe(null);
  });

  it("DISTANCE strategy fallback: unknown strategy returns baseChargePaise", async () => {
    const service = makeService();
    const card = makeCard({ pricingType: "DISTANCE" as never, baseChargePaise: 6000, pricingConfig: null });
    expect(await service.resolveRateCardCharge(card, null)).toBe(6000);
  });

  it("DISTANCE strategy: calculates extra surcharge when distance is beyond includedDistanceKm", async () => {
    const mockRouteDistance = {
      calculate: vi.fn().mockResolvedValue({
        distanceKm: 5.5,
      }),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3, perKmPaise: 800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(6000);
    expect(mockRouteDistance.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { latitude: 12.971598, longitude: 77.594562 },
        destination: { latitude: 12.981598, longitude: 77.604562 },
      })
    );
  });

  it("DISTANCE strategy: falls back to 0 km (only base charge) when RouteDistanceService fails", async () => {
    const mockRouteDistance = {
      calculate: vi.fn().mockRejectedValue(new Error("Google Routes API Quota Exceeded")),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3, perKmPaise: 800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
  });

  it("DISTANCE strategy: falls back to 0 km when RouteDistanceService returns null / no route found", async () => {
    const mockRouteDistance = {
      calculate: vi.fn().mockResolvedValue(null),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3, perKmPaise: 800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
  });

  it("MANUAL_TRANSPORT calculates seller product policy by distance and uses the highest package charge", async () => {
    const routeDistance = {
      calculate: vi.fn().mockResolvedValue({
        distanceKm: 7.2,
        distanceMeters: 7200,
        accuracy: "STRAIGHT_LINE",
        provider: "HAVERSINE",
        fallbackUsed: true,
      }),
    };
    const client = {
      sellerAddress: {
        findFirst: vi.fn().mockResolvedValue({
          latitude: 12.971598,
          longitude: 77.594562,
        }),
      },
    };
    const service = new DeliveryRoutingService(
      { client } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      routeDistance as never,
    );

    const [result] = await service.resolveAllDeliveryOptions(
      {
        subtotalPaise: 100000,
        sellerId: "seller-1",
        address: { latitude: 12.981598, longitude: 77.604562 },
        items: [
          {
            productId: "product-1",
            productName: "Small item",
            quantity: 1,
            enabledDeliveryModes: [DeliveryMode.MANUAL_TRANSPORT],
            manualTransport: {
              freeDistanceKm: 5,
              chargePerKmMinor: 2500,
              currency: "INR",
              note: "Free within 5 km.",
            },
          },
          {
            productId: "product-2",
            productName: "Large item",
            quantity: 1,
            enabledDeliveryModes: [DeliveryMode.MANUAL_TRANSPORT],
            manualTransport: {
              freeDistanceKm: 1,
              chargePerKmMinor: 1000,
              currency: "INR",
              note: "Large item transport.",
            },
          },
        ],
      },
      [DeliveryMode.MANUAL_TRANSPORT],
      client as never,
    );

    expect(result?.quote.routingFailed).toBe(false);
    expect(result?.quote.shippingChargePaise).toBe(7500);
    expect(result?.quote.routingSnapshot).toMatchObject({
      manualTransport: {
        distanceKm: 7.2,
        freeDistanceKm: 5,
        billableKm: 3,
        chargePerKmMinor: 2500,
        sellerCurrency: "INR",
        selectedProductId: "product-1",
      },
    });
    expect(routeDistance.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { latitude: 12.971598, longitude: 77.594562 },
        destination: { latitude: 12.981598, longitude: 77.604562 },
      }),
    );
  });

  it("MANUAL_TRANSPORT is unavailable when customer address has no map coordinates", async () => {
    const client = {
      sellerAddress: {
        findFirst: vi.fn(),
      },
    };
    const service = new DeliveryRoutingService(
      { client } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { calculate: vi.fn() } as never,
    );

    const [result] = await service.resolveAllDeliveryOptions(
      {
        subtotalPaise: 100000,
        sellerId: "seller-1",
        address: { pincode: "636114" },
        items: [
          {
            productId: "product-1",
            productName: "Small item",
            quantity: 1,
            enabledDeliveryModes: [DeliveryMode.MANUAL_TRANSPORT],
            manualTransport: {
              freeDistanceKm: 5,
              chargePerKmMinor: 2500,
              currency: "INR",
              note: "Free within 5 km.",
            },
          },
        ],
      },
      [DeliveryMode.MANUAL_TRANSPORT],
      client as never,
    );

    expect(result?.quote.routingFailed).toBe(true);
    expect(result?.quote.routingFailureNote).toBe("Add a map pin to the delivery address for seller-arranged delivery.");
    expect(client.sellerAddress.findFirst).not.toHaveBeenCalled();
  });

  it("MANUAL_TRANSPORT is unavailable when a package item has no seller policy", async () => {
    const client = {
      sellerAddress: {
        findFirst: vi.fn().mockResolvedValue({
          latitude: 12.971598,
          longitude: 77.594562,
        }),
      },
    };
    const service = new DeliveryRoutingService(
      { client } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { calculate: vi.fn() } as never,
    );

    const [result] = await service.resolveAllDeliveryOptions(
      {
        subtotalPaise: 100000,
        sellerId: "seller-1",
        address: { latitude: 12.981598, longitude: 77.604562 },
        items: [
          {
            productId: "product-1",
            productName: "Unconfigured item",
            quantity: 1,
            enabledDeliveryModes: [DeliveryMode.MANUAL_TRANSPORT],
            manualTransport: null,
          },
        ],
      },
      [DeliveryMode.MANUAL_TRANSPORT],
      client as never,
    );

    expect(result?.quote.routingFailed).toBe(true);
    expect(result?.quote.routingFailureNote).toBe("Unconfigured item needs seller-arranged delivery charges before checkout.");
  });

  it("MANUAL_TRANSPORT requested with DELIVER_TO_ADDRESS uses seller distance pricing", async () => {
    const routeDistance = {
      calculate: vi.fn().mockResolvedValue({
        distanceKm: 4.1,
        distanceMeters: 4100,
        accuracy: "STRAIGHT_LINE",
        provider: "HAVERSINE",
        fallbackUsed: true,
      }),
    };
    const client = {
      sellerAddress: {
        findFirst: vi.fn().mockResolvedValue({
          latitude: 12.971598,
          longitude: 77.594562,
        }),
      },
    };
    const service = new DeliveryRoutingService(
      { client } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      routeDistance as never,
    );

    const result = await service.resolveDelivery(
      {
        deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        requestedDeliveryMode: DeliveryMode.MANUAL_TRANSPORT,
        subtotalPaise: 50000,
        sellerId: "seller-1",
        address: { latitude: 12.981598, longitude: 77.604562 },
        items: [
          {
            productId: "product-1",
            productName: "Configured item",
            quantity: 1,
            enabledDeliveryModes: [DeliveryMode.MANUAL_TRANSPORT],
            manualTransport: {
              freeDistanceKm: 2,
              chargePerKmMinor: 2000,
              currency: "INR",
              note: "Free within 2 km.",
            },
          },
        ],
      },
      client as never,
    );

    expect(result.deliveryMode).toBe(DeliveryMode.MANUAL_TRANSPORT);
    expect(result.shippingChargePaise).toBe(6000);
    expect(result.shippingSnapshot.source).toBe("MANUAL_TRANSPORT_DISTANCE");
  });

  it("MANUAL_TRANSPORT converts seller-local currency into platform base charge", async () => {
    const routeDistance = {
      calculate: vi.fn().mockResolvedValue({
        distanceKm: 1,
        distanceMeters: 1000,
        accuracy: "STRAIGHT_LINE",
        provider: "HAVERSINE",
        fallbackUsed: true,
      }),
    };
    const client = {
      sellerAddress: {
        findFirst: vi.fn().mockResolvedValue({
          latitude: 25.2048,
          longitude: 55.2708,
          countryCode: "AE",
        }),
      },
    };
    const marketService = {
      getMarketCurrency: vi.fn().mockResolvedValue({
        currency: "AED",
        baseCurrency: "INR",
        rate: 2,
      }),
    };
    const service = new DeliveryRoutingService(
      { client } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      routeDistance as never,
      marketService as never,
    );

    const [result] = await service.resolveAllDeliveryOptions(
      {
        subtotalPaise: 50000,
        sellerId: "seller-ae",
        address: { latitude: 25.2148, longitude: 55.2808 },
        items: [
          {
            productId: "product-ae",
            productName: "Configured UAE item",
            quantity: 1,
            enabledDeliveryModes: [DeliveryMode.MANUAL_TRANSPORT],
            manualTransport: {
              freeDistanceKm: 0,
              chargePerKmMinor: 200,
              currency: "AED",
              note: "AED manual transport.",
            },
          },
        ],
      },
      [DeliveryMode.MANUAL_TRANSPORT],
      client as never,
    );

    expect(result?.quote.shippingChargePaise).toBe(100);
    expect(result?.quote.routingSnapshot).toMatchObject({
      manualTransport: {
        sellerCurrency: "AED",
        sellerChargeMinor: 200,
        baseCurrency: "INR",
        baseChargeMinor: 100,
        fxRate: 2,
      },
    });
  });

  it("DISTANCE strategy edge case: seller coordinates missing", async () => {
    const mockRouteDistance = {
      calculate: vi.fn(),
    };
    const prisma = {
      client: {
        sellerAddress: {
          findFirst: vi.fn().mockResolvedValue({
            latitude: null,
            longitude: null,
          }),
        },
      },
    };
    const service = new DeliveryRoutingService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      mockRouteDistance as never,
    ) as unknown as DeliveryRoutingServiceTestAccess;
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3, perKmPaise: 800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
    expect(mockRouteDistance.calculate).not.toHaveBeenCalled();
  });

  it("DISTANCE strategy edge case: customer coordinates missing", async () => {
    const mockRouteDistance = {
      calculate: vi.fn(),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3, perKmPaise: 800 },
    });
    const address = { latitude: null, longitude: null };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
    expect(mockRouteDistance.calculate).not.toHaveBeenCalled();
  });

  it("DISTANCE strategy edge case: distance exactly equal to included distance", async () => {
    const mockRouteDistance = {
      calculate: vi.fn().mockResolvedValue({ distanceKm: 3.0 }),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3.0, perKmPaise: 800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
  });

  it("DISTANCE strategy edge case: distance less than included distance", async () => {
    const mockRouteDistance = {
      calculate: vi.fn().mockResolvedValue({ distanceKm: 2.5 }),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: 3.0, perKmPaise: 800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
  });

  it("DISTANCE strategy edge case: negative values in rate card config", async () => {
    const mockRouteDistance = {
      calculate: vi.fn().mockResolvedValue({ distanceKm: 5.0 }),
    };
    const service = makeService(mockRouteDistance);
    const card = makeCard({
      pricingType: "DISTANCE" as never,
      baseChargePaise: 4000,
      pricingConfig: { includedDistanceKm: -3.0, perKmPaise: -800 },
    });
    const address = { latitude: 12.981598, longitude: 77.604562 };

    const charge = await service.resolveRateCardCharge(card, address, "seller-123");
    expect(charge).toBe(4000);
  });

  it("DISTANCE strategy edge case: negative baseChargePaise in rate card", async () => {
    const service = makeService();
    const card = makeCard({
      pricingType: "FLAT" as never,
      baseChargePaise: -1500,
    });
    const charge = await service.resolveRateCardCharge(card, null);
    expect(charge).toBe(-1500);
    expect(charge).not.toBeNull();

    const capped = service.nonNegativeInt(charge!);
    expect(capped).toBe(0);
  });

  it("DISTANCE strategy: integrates Google Maps Routes API via global fetch stubbing", async () => {
    const settings = [
      { key: "maps.routing.enabled", value: true },
      { key: "maps.routing.provider", value: "GOOGLE_ROUTES" },
      { key: "maps.routing.google_api_token", value: "test-token" },
      { key: "maps.routing.google_travel_mode", value: "DRIVE" },
      { key: "maps.routing.fallback_to_haversine", value: false },
    ];
    const prisma = {
      client: {
        setting: {
          findMany: vi.fn().mockResolvedValue(settings),
        },
      },
    };
    const routeDistanceService = new RouteDistanceService(prisma as never);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: 5500, duration: "300s" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await routeDistanceService.calculate({
      origin: { latitude: 12.971598, longitude: 77.594562 },
      destination: { latitude: 12.981598, longitude: 77.604562 },
    });

    expect(result.distanceKm).toBe(5.5);
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
