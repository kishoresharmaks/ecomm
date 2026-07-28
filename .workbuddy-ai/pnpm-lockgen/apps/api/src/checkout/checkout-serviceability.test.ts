import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DeliveryMode } from "@indihub/database";
import {
  assertCheckoutDeliveryServiceable,
  checkoutDeliveryUnavailableMessage,
} from "./checkout-serviceability";
import { CheckoutDeliveryPreference } from "./dto/delivery-routing.dto";
import type { DeliveryRoutingQuote } from "./delivery-routing.service";

describe("checkout delivery serviceability", () => {
  it("blocks order placement when delivery routing failed for a real address", () => {
    expect(() =>
      assertCheckoutDeliveryServiceable(
        {
          deliveryRouting: quote({
            routingFailed: true,
            routingFailureNote: "No courier provider serves this country.",
          }),
        },
        {
          addressProvided: true,
          deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it("does not block early checkout summary before an address is selected", () => {
    expect(() =>
      assertCheckoutDeliveryServiceable(
        {
          deliveryRouting: quote({
            routingFailed: true,
            routingFailureNote: "No address selected.",
          }),
        },
        {
          addressProvided: false,
          deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        },
      ),
    ).not.toThrow();
  });

  it("does not block store pickup", () => {
    expect(() =>
      assertCheckoutDeliveryServiceable(
        {
          deliveryRouting: quote({
            deliveryMode: DeliveryMode.STORE_PICKUP,
            routingFailed: false,
          }),
        },
        {
          addressProvided: true,
          deliveryPreference: CheckoutDeliveryPreference.STORE_PICKUP,
        },
      ),
    ).not.toThrow();
  });

  it("keeps the customer-facing unavailable message clear", () => {
    expect(checkoutDeliveryUnavailableMessage("No local partner matched.")).toBe(
      "This delivery address is not serviceable yet. No local partner matched. Choose another address or contact support.",
    );
  });
});

function quote(overrides: Partial<DeliveryRoutingQuote>): DeliveryRoutingQuote {
  return {
    deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
    deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
    recommendedPartnerUserId: null,
    recommendedPartnerName: null,
    partnerMatchLabel: null,
    partnerSpecificityScore: 0,
    courierProviderCode: null,
    matchedRateCardId: null,
    matchedRateCardName: null,
    rateCardSpecificityScore: 0,
    shippingChargePaise: 0,
    codSurchargePaise: 0,
    totalDeliveryChargePaise: 0,
    freeShippingApplied: false,
    routingFailed: false,
    routingFailureReason: null,
    routingFailureNote: null,
    fallbackReason: null,
    warnings: [],
    diagnostics: {
      localPartnersChecked: 0,
      localEligiblePartners: 0,
      rejectedPartnersSkipped: 0,
      codLimitSkipped: 0,
      rateCardsChecked: 0,
      providerChecked: null,
    },
    shippingSnapshot: {},
    codSurchargeSnapshot: {},
    routingSnapshot: {},
    ...overrides,
  };
}
