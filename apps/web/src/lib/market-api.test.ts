import { describe, expect, it } from "vitest";
import { convertBaseMinorToMarket, defaultMarketCurrency, marketNeedsRefresh } from "./market-api";

describe("market currency helpers", () => {
  it("matches backend rounding for client display conversion", () => {
    expect(
      convertBaseMinorToMarket(41400, {
        ...defaultMarketCurrency,
        baseCurrency: "INR",
        currency: "GBP",
        rate: 0.00937,
      }),
    ).toBe(Math.round((41400 / 100) * 0.00937 * 100));
  });

  it("treats missing, invalid, and expired expiresAt values as stale", () => {
    expect(marketNeedsRefresh({ expiresAt: "" })).toBe(true);
    expect(marketNeedsRefresh({ expiresAt: "not-a-date" })).toBe(true);
    expect(marketNeedsRefresh({ expiresAt: new Date(Date.now() - 1).toISOString() })).toBe(true);
    expect(marketNeedsRefresh({ expiresAt: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
  });
});
