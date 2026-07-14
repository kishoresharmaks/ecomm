import { Prisma } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
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

  it("bypasses an unexpired cached rate when forceRefresh is requested", async () => {
    const fetchedAt = new Date("2026-07-14T06:00:00.000Z");
    const expiresAt = new Date("2026-07-14T12:00:00.000Z");
    const cachedRate = {
      baseCurrency: "INR",
      quoteCurrency: "USD",
      rate: new Prisma.Decimal(0.01046),
      provider: "frankfurter",
      fetchedAt,
      expiresAt,
    };
    const refreshedRate = {
      ...cachedRate,
      rate: new Prisma.Decimal(0.0104),
      fetchedAt: new Date("2026-07-14T07:00:00.000Z"),
      expiresAt: new Date("2026-07-14T13:00:00.000Z"),
    };
    const prisma = {
      client: {
        locationCountry: {
          findUnique: vi.fn().mockResolvedValue({
            code: "US",
            name: "United States",
            currency: "USD",
            locale: "en-US",
            enabled: true,
          }),
        },
        currencyRate: {
          findUnique: vi.fn().mockResolvedValue(cachedRate),
          upsert: vi.fn().mockResolvedValue(refreshedRate),
        },
      },
    } as unknown as PrismaService;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ rate: 0.0104 }),
    } as Response);
    const service = new MarketService(prisma);

    const result = await service.getMarketCurrency("US", { requireFresh: true, forceRefresh: true });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.rate).toBe(0.0104);
    expect(result.isStale).toBe(false);

    fetchSpy.mockRestore();
  });

  it("uses forced fresh rates for checkout snapshots", async () => {
    const service = new MarketService({} as PrismaService);
    const getMarketCurrency = vi
      .spyOn(service, "getMarketCurrency")
      .mockResolvedValue({} as MarketCurrencySnapshot);

    await service.buildCheckoutSnapshot("US");

    expect(getMarketCurrency).toHaveBeenCalledWith("US", { requireFresh: true, forceRefresh: true });
  });
});
