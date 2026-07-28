import { describe, expect, it } from "vitest";
import {
  convertBaseMinorToSellerMinor,
  resolveSellerOrderCurrency,
} from "./seller-order-currency";

describe("seller order currency", () => {
  it("uses immutable order-time seller price snapshots", () => {
    const context = resolveSellerOrderCurrency("INR", "seller-us", [
      {
        id: "item-1",
        sellerId: "seller-us",
        quantity: 2,
        unitPricePaise: 8_300,
        lineTotalPaise: 16_600,
        variantSnapshot: {
          sellerCurrency: "USD",
          sellerUnitPriceMinor: 1_000,
          baseCurrency: "INR",
          baseUnitPricePaise: 8_300,
        },
      },
    ]);

    expect(context).toMatchObject({
      currency: "USD",
      baseCurrency: "INR",
      source: "ORDER_ITEM_PRICE_SNAPSHOT",
      sellerSubtotalMinor: 2_000,
      itemAmounts: {
        "item-1": { unitPriceMinor: 1_000, lineTotalMinor: 2_000 },
      },
    });
    expect(convertBaseMinorToSellerMinor(830, context)).toBe(100);
  });

  it("falls back to base currency for legacy or mixed snapshots", () => {
    const context = resolveSellerOrderCurrency("INR", "seller-us", [
      {
        id: "legacy-item",
        sellerId: "seller-us",
        quantity: 1,
        unitPricePaise: 8_300,
        lineTotalPaise: 8_300,
        variantSnapshot: "Default",
      },
    ]);

    expect(context).toEqual({
      currency: "INR",
      baseCurrency: "INR",
      rate: 1,
      source: "BASE_CURRENCY_FALLBACK",
      sellerSubtotalMinor: 8_300,
      itemAmounts: {
        "legacy-item": { unitPriceMinor: 8_300, lineTotalMinor: 8_300 },
      },
    });
  });
});
