import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteDistanceService } from "./route-distance.service";
import { mapRoutingSettingKeys } from "../settings/map-routing-settings";

describe("RouteDistanceService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns unavailable when origin or destination coordinates are missing", async () => {
    const { service } = createService();

    const result = await service.calculate({
      origin: { latitude: null, longitude: null, label: "Seller pickup" },
      destination: { latitude: 11.6643, longitude: 78.146, label: "Customer address" },
    });

    expect(result).toMatchObject({
      provider: "NONE",
      accuracy: "UNAVAILABLE",
      distanceKm: null,
      failureReason: "Missing origin or destination coordinates.",
    });
  });

  it("uses Haversine distance when routed providers are disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = createService();

    const result = await service.calculate({
      origin: { latitude: 11.6643, longitude: 78.146, label: "Seller pickup" },
      destination: { latitude: 11.6743, longitude: 78.146, label: "Customer address" },
    });

    expect(result.provider).toBe("HAVERSINE");
    expect(result.accuracy).toBe("STRAIGHT_LINE");
    expect(result.distanceKm).toBeGreaterThan(1);
    expect(result.distanceKm).toBeLessThan(1.2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Google Routes road distance when enabled and configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distanceMeters: 2468, duration: "370s" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { service } = createService([
      setting(mapRoutingSettingKeys.enabled, true),
      setting(mapRoutingSettingKeys.provider, "GOOGLE_ROUTES"),
      setting(mapRoutingSettingKeys.googleApiToken, "google-token"),
      setting(mapRoutingSettingKeys.googleTravelMode, "TWO_WHEELER"),
      setting(mapRoutingSettingKeys.fallbackToHaversine, true),
    ]);

    const result = await service.calculate({
      origin: { latitude: 11.6643, longitude: 78.146, label: "Seller pickup" },
      destination: { latitude: 11.6743, longitude: 78.156, label: "Customer address" },
    });

    expect(result).toMatchObject({
      provider: "GOOGLE_ROUTES",
      accuracy: "ROAD_ROUTE",
      distanceMeters: 2468,
      distanceKm: 2.468,
      durationSeconds: 370,
      fallbackUsed: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "google-token",
        }),
      }),
    );
  });
});

function createService(settings: Array<{ key: string; value: unknown }> = []) {
  const prisma = {
    client: {
      setting: {
        findMany: vi.fn().mockResolvedValue(settings),
      },
    },
  };

  return {
    prisma,
    service: new RouteDistanceService(prisma as never),
  };
}

function setting(key: string, value: unknown) {
  return { key, value };
}
