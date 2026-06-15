import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { MarketService, type MarketCurrencySnapshot } from "./market.service";

describe("MarketService currency conversion", () => {
  it("uses the same normal integer rounding contract as checkout snapshots", () => {
    const service = new MarketService({} as PrismaService);
    const market: MarketCurrencySnapshot = {
      countryCode: "GB",
      countryName: "United Kingdom",
      currency: "GBP",
      locale: "en-GB",
      baseCurrency: "INR",
      rate: 0.00937,
      provider: "frankfurter",
      fetchedAt: new Date("2026-06-13T00:00:00.000Z"),
      expiresAt: new Date("2026-06-13T01:00:00.000Z"),
      isStale: false,
    };

    expect(service.convertMinorUnits(41400, market)).toBe(Math.round((41400 / 100) * market.rate * 100));
  });
});
