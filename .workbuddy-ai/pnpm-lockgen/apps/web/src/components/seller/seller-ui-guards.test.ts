import { describe, expect, it } from "vitest";
import { IndihubApiError } from "../../lib/api";
import {
  isSellerOnboardingRequiredError,
  requiredSellerCapability,
} from "./seller-ui-guards";

describe("seller UI guards", () => {
  it("maps retail and service routes to their required capability", () => {
    expect(requiredSellerCapability("/seller/products/new")).toBe("RETAIL");
    expect(requiredSellerCapability("/seller/reports/inventory")).toBe("RETAIL");
    expect(requiredSellerCapability("/seller/service-bookings/SVC-1")).toBe("SERVICE");
    expect(requiredSellerCapability("/seller/finance/wallet")).toBeNull();
  });

  it("does not mislabel operational 403 responses as missing onboarding", () => {
    expect(
      isSellerOnboardingRequiredError(
        new IndihubApiError("Seller account is required.", 403),
      ),
    ).toBe(true);
    expect(
      isSellerOnboardingRequiredError(
        new IndihubApiError("Seller approval is required for product operations.", 403),
      ),
    ).toBe(false);
    expect(
      isSellerOnboardingRequiredError(
        new IndihubApiError("Shop location coordinates and address must be set before adding products.", 403),
      ),
    ).toBe(false);
  });
});
