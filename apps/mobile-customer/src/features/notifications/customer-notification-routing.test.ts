import { describe, expect, it, vi } from "vitest";
import { isAllowedCustomerNotificationHref, openCustomerNotification, routeForCustomerNotification } from "./customer-notification-routing";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({
  router: {
    push: pushMock,
  },
}));

describe("customer notification routing", () => {
  it("allows only approved customer app hrefs", () => {
    expect(isAllowedCustomerNotificationHref("/deals")).toBe(true);
    expect(isAllowedCustomerNotificationHref("/orders/1HI202606190001")).toBe(true);
    expect(isAllowedCustomerNotificationHref("/products/cotton-shirt")).toBe(true);
    expect(isAllowedCustomerNotificationHref("/admin/orders")).toBe(false);
    expect(isAllowedCustomerNotificationHref("https://example.com/deals")).toBe(false);
  });

  it("builds fallback routes from typed payload fields", () => {
    expect(routeForCustomerNotification({ orderNumber: "ORD 1001" })).toBe("/orders/ORD%201001");
    expect(routeForCustomerNotification({ productSlug: "cotton-shirt" })).toBe("/product/cotton-shirt");
    expect(routeForCustomerNotification({})).toBe("/account/notifications");
  });

  it("opens allowed hrefs through expo router", () => {
    openCustomerNotification({ href: "/deals" });
    expect(pushMock).toHaveBeenCalledWith("/deals");
  });
});
