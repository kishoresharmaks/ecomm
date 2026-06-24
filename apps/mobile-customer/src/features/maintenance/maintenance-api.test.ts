import { describe, expect, it } from "vitest";
import { getStorefrontMaintenance, type MaintenanceScopeSetting } from "./maintenance-api";

describe("mobile maintenance settings", () => {
  it("finds the storefront maintenance scope", () => {
    const settings: MaintenanceScopeSetting[] = [
      { scope: "seller", enabled: true, message: "Seller pause", eta: "Soon" },
      { scope: "storefront", enabled: true, message: "Shopping pause", eta: "Back by 3 PM" },
    ];

    expect(getStorefrontMaintenance(settings)).toMatchObject({
      scope: "storefront",
      enabled: true,
      message: "Shopping pause",
      eta: "Back by 3 PM",
    });
  });

  it("returns null when storefront settings are not available", () => {
    expect(getStorefrontMaintenance(undefined)).toBeNull();
    expect(getStorefrontMaintenance([{ scope: "delivery", enabled: false, message: "", eta: "" }])).toBeNull();
  });
});
