import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(() => Promise.resolve()),
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock("react-native", () => ({
  AccessibilityInfo: {
    announceForAccessibility: vi.fn(),
  },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

import {
  convertBaseMinorToMarket,
  defaultMobileMarketCurrency,
  formatOrderBaseAmount,
  formatOrderDisplayTotal,
  marketNeedsRefresh,
} from "./mobile-market";

describe("mobile market currency helpers", () => {
  it("matches backend normal integer rounding exactly", () => {
    expect(
      convertBaseMinorToMarket(41400, {
        ...defaultMobileMarketCurrency,
        baseCurrency: "INR",
        currency: "GBP",
        rate: 0.00937,
      }),
    ).toBe(Math.round((41400 / 100) * 0.00937 * 100));
  });

  it("treats missing, invalid, and expired rate expiry as stale", () => {
    expect(marketNeedsRefresh({ expiresAt: null })).toBe(true);
    expect(marketNeedsRefresh({ expiresAt: "not-a-date" })).toBe(true);
    expect(marketNeedsRefresh({ expiresAt: new Date(Date.now() - 1).toISOString() })).toBe(true);
    expect(marketNeedsRefresh({ expiresAt: new Date(Date.now() + 60_000).toISOString() })).toBe(false);
  });

  it("formats buyer totals and old order fallback totals safely", () => {
    const buyerOrder = {
      totalPaise: 41400,
      currency: "INR",
      buyerCurrency: "USD",
      buyerTotalMinor: 497,
    };

    expect(formatOrderDisplayTotal(buyerOrder)).toBe("$4.97");
    expect(formatOrderBaseAmount(buyerOrder, buyerOrder.totalPaise)).toBe("₹414");
    expect(formatOrderDisplayTotal({ totalPaise: 41400, currency: "INR" })).toBe("₹414");
  });
});
