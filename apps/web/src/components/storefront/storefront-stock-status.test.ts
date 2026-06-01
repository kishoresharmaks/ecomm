import { describe, expect, it } from "vitest";
import { getStorefrontStockStatus } from "./storefront-stock-status";

describe("storefront stock status", () => {
  it("hides exact buyer-facing stock counts", () => {
    expect(getStorefrontStockStatus(95).label).toBe("In stock");
    expect(getStorefrontStockStatus(10).label).toBe("In stock");
    expect(getStorefrontStockStatus(9).label).toBe("Few left");
    expect(getStorefrontStockStatus(1).label).toBe("Few left");
    expect(getStorefrontStockStatus(0).label).toBe("Sold out");
  });
});
