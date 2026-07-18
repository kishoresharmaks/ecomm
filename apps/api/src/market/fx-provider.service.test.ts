import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { FxProviderService, type RuntimeFxProvider } from "./fx-provider.service";

describe("FxProviderService", () => {
  it("parses CurrencyAPI quotes without putting the credential in the URL", async () => {
    const service = new FxProviderService({} as PrismaService);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: { last_updated_at: "2026-07-18T06:00:00Z" },
        data: { USD: { code: "USD", value: 0.0117 } },
      }),
    } as Response);
    const provider: RuntimeFxProvider = {
      id: "currencyapi",
      providerCode: "CURRENCYAPI",
      displayName: "CurrencyAPI",
      adapterCode: "CURRENCYAPI",
      apiBaseUrl: "https://api.currencyapi.com/v3",
      apiKey: "secret-key",
      timeoutMs: 5000,
      cacheTtlMinutes: 60,
      isPrimary: false,
      priority: 2,
      source: "DATABASE",
    };

    const quote = await service.fetchRate(provider, "INR", "USD");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).not.toContain("secret-key");
    expect(new Headers(init?.headers).get("apikey")).toBe("secret-key");
    expect(quote.rate).toBe(0.0117);
    expect(quote.providerTimestamp?.toISOString()).toBe("2026-07-18T06:00:00.000Z");
    fetchSpy.mockRestore();
  });

  it("keeps failed providers visible in a live comparison", async () => {
    const records = [providerRecord("FRANKFURTER", true), providerRecord("CURRENCYAPI", false)];
    const prisma = {
      client: {
        fxProviderSetting: {
          findMany: vi.fn().mockResolvedValue(records),
          update: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as unknown as PrismaService;
    const service = new FxProviderService(prisma);
    vi.spyOn(service, "fetchRate")
      .mockResolvedValueOnce({
        rate: 0.011,
        providerTimestamp: null,
        receivedAt: new Date(),
        rawResponse: { rate: 0.011 },
      })
      .mockRejectedValueOnce(new Error("provider unavailable"));

    const result = await service.compareQuotes({ baseCurrency: "INR", quoteCurrency: "USD", amountMinor: 10_000 });

    expect(result.quotes).toHaveLength(2);
    expect(result.quotes[0]?.status).toBe("SUCCESS");
    expect(result.quotes[1]).toMatchObject({ status: "ERROR", rate: null, error: "provider unavailable" });
  });

  it("rejects provider endpoints outside the official adapter host", async () => {
    const service = new FxProviderService({} as PrismaService);

    await expect(service.createProvider(
      { id: "finance-user" } as never,
      {
        adapterCode: "CURRENCYAPI",
        displayName: "CurrencyAPI",
        apiBaseUrl: "https://internal.example.test/latest?apikey=secret",
        isEnabled: false,
      },
    )).rejects.toThrow("official CurrencyAPI HTTPS host");
  });
});

function providerRecord(adapterCode: "FRANKFURTER" | "CURRENCYAPI", isPrimary: boolean) {
  return {
    id: adapterCode,
    providerCode: adapterCode,
    displayName: adapterCode,
    adapterCode,
    isEnabled: true,
    isPrimary,
    priority: isPrimary ? 1 : 2,
    apiBaseUrl: adapterCode === "FRANKFURTER" ? "https://api.frankfurter.dev/v2" : "https://api.currencyapi.com/v3",
    apiKeyEncrypted: null,
    credentialsConfigured: true,
    timeoutMs: 5000,
    cacheTtlMinutes: 60,
    notes: null,
    lastHealthStatus: "NEVER_TESTED",
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
