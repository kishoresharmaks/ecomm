import { describe, expect, it } from "vitest";
import { sellerDashboardMode } from "./seller-dashboard";

describe("seller dashboard mode", () => {
  it("selects retail, service, hybrid, and legacy modes", () => {
    expect(sellerDashboardMode({ enabledCapabilities: ["RETAIL"] }, undefined)).toBe("retail");
    expect(sellerDashboardMode({ enabledCapabilities: ["SERVICE"] }, undefined)).toBe("service");
    expect(sellerDashboardMode({ enabledCapabilities: ["RETAIL", "SERVICE"] }, undefined)).toBe("hybrid");
    expect(sellerDashboardMode({ sellerType: "MARKETPLACE_SELLER" }, undefined)).toBe("retail");
    expect(sellerDashboardMode({ sellerType: "SERVICE_PROVIDER" }, undefined)).toBe("service");
  });

  it("prefers report capabilities when available", () => {
    expect(
      sellerDashboardMode(
        { enabledCapabilities: ["RETAIL"] },
        { seller: { id: "seller_1", enabledCapabilities: ["SERVICE"] } },
      ),
    ).toBe("service");
    expect(
      sellerDashboardMode(
        { enabledCapabilities: ["RETAIL"] },
        { seller: { id: "seller_1", primaryCapability: "SERVICE" } },
      ),
    ).toBe("service");
  });
});
