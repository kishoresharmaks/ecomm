import { describe, expect, it } from "vitest";
import {
  canBypassMaintenancePreview,
  isDeliveryMaintenancePath,
  isStorefrontMaintenancePath,
  normalizeMaintenanceScope,
} from "./maintenance-mode";

describe("maintenance mode helpers", () => {
  it("blocks only storefront shopping routes", () => {
    expect(isStorefrontMaintenancePath("/")).toBe(true);
    expect(isStorefrontMaintenancePath("/categories/electronics")).toBe(true);
    expect(isStorefrontMaintenancePath("/products/phone")).toBe(true);
    expect(isStorefrontMaintenancePath("/stores/local-shop")).toBe(true);
    expect(isStorefrontMaintenancePath("/checkout/success/ORD-1")).toBe(true);
    expect(isStorefrontMaintenancePath("/account/orders")).toBe(false);
    expect(isStorefrontMaintenancePath("/b2b/enquiries")).toBe(false);
    expect(isStorefrontMaintenancePath("/support/chat")).toBe(false);
    expect(isStorefrontMaintenancePath("/privacy-policy")).toBe(false);
  });

  it("keeps delivery partner registration out of delivery maintenance", () => {
    expect(isDeliveryMaintenancePath("/delivery")).toBe(true);
    expect(isDeliveryMaintenancePath("/delivery/orders/ORD-1")).toBe(true);
    expect(isDeliveryMaintenancePath("/delivery/register")).toBe(false);
  });

  it("allows preview bypass only for authenticated back-office roles", () => {
    const params = new URLSearchParams("maintenance_preview=1");

    expect(canBypassMaintenancePreview(params, { isAuthenticated: true, roles: ["ADMIN"] })).toBe(true);
    expect(canBypassMaintenancePreview(params, { isAuthenticated: true, roles: ["FINANCE"] })).toBe(true);
    expect(canBypassMaintenancePreview(params, { isAuthenticated: true, roles: ["COURIER_MANAGER"] })).toBe(true);
    expect(canBypassMaintenancePreview(params, { isAuthenticated: true, roles: ["SELLER"] })).toBe(false);
    expect(canBypassMaintenancePreview(params, { isAuthenticated: false, roles: ["ADMIN"] })).toBe(false);
    expect(canBypassMaintenancePreview(new URLSearchParams(), { isAuthenticated: true, roles: ["ADMIN"] })).toBe(false);
  });

  it("coerces public text lengths", () => {
    const normalized = normalizeMaintenanceScope("storefront", {
      enabled: true,
      message: "x".repeat(260),
      eta: "y".repeat(180),
    });

    expect(normalized.enabled).toBe(true);
    expect(normalized.message).toHaveLength(240);
    expect(normalized.eta).toHaveLength(160);
  });
});
