import { describe, expect, it, vi } from "vitest";
import {
  DeliveryMode,
  DeliveryRoutingFailureReason,
  Prisma,
} from "@indihub/database";
import { DeliveryRoutingService, type DeliveryRoutingQuote } from "./delivery-routing.service";
import {
  CheckoutDeliveryPreference,
  CheckoutRoutingPaymentMethod,
} from "./dto/delivery-routing.dto";

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
