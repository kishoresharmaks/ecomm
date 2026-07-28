import { afterEach, describe, expect, it, vi } from "vitest";
import { MapsService } from "./maps.service";
import { mapRoutingSettingKeys } from "../settings/map-routing-settings";

describe("MapsService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns an unconfigured response when no Mapbox token exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { service } = createService();

    const result = await service.reverseGeocode({ latitude: 11.6643, longitude: 78.146 });

    expect(result).toMatchObject({
      configured: false,
      provider: "MAPBOX",
      latitude: 11.6643,
      longitude: 78.146,
      address: null,
      rawPlaceName: null,
      locationConfidenceScore: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a configured Mapbox token and normalizes the first address feature", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            text: "Mettu Street",
            place_name: "Mettu Street, Salem, Tamil Nadu 636001, India",
            relevance: 0.91,
            context: [
              { id: "postcode.123", text: "636001" },
              { id: "place.456", text: "Salem" },
              { id: "region.789", text: "Tamil Nadu" },
              { id: "country.000", text: "India", short_code: "in" },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { service } = createService([
      setting(mapRoutingSettingKeys.mapboxAccessToken, "mapbox-token"),
    ]);

    const result = await service.reverseGeocode({ latitude: 11.6643, longitude: 78.146 });

    expect(result).toMatchObject({
      configured: true,
      provider: "MAPBOX",
      address: {
        line1: "Mettu Street",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636001",
        country: "India",
        countryCode: "IN",
      },
      rawPlaceName: "Mettu Street, Salem, Tamil Nadu 636001, India",
      locationConfidenceScore: 91,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "api.mapbox.com",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps coordinates saveable when Mapbox returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { service } = createService([
      setting(mapRoutingSettingKeys.mapboxAccessToken, "mapbox-token"),
    ]);

    const result = await service.reverseGeocode({ latitude: 11.6643, longitude: 78.146 });

    expect(result).toMatchObject({
      configured: true,
      address: null,
      rawPlaceName: null,
      locationConfidenceScore: null,
    });
  });

  it("uses broad Mapbox place features as city suggestions when context omits place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: "place.456",
              place_type: ["place"],
              text: "Salem",
              place_name: "Salem, Tamil Nadu, India",
              relevance: 0.88,
              context: [
                { id: "region.789", text: "Tamil Nadu" },
                { id: "country.000", text: "India", short_code: "in" },
              ],
            },
          ],
        }),
      }),
    );
    const { service } = createService([
      setting(mapRoutingSettingKeys.mapboxAccessToken, "mapbox-token"),
    ]);

    const result = await service.reverseGeocode({ latitude: 11.6643, longitude: 78.146 });

    expect(result).toMatchObject({
      configured: true,
      address: {
        line1: "Salem",
        city: "Salem",
        state: "Tamil Nadu",
        country: "India",
        countryCode: "IN",
      },
      locationConfidenceScore: 88,
    });
  });

  it("dedupes repeated reverse-geocode lookups for rounded coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            text: "Mettu Street",
            place_name: "Mettu Street, Salem, Tamil Nadu 636001, India",
            relevance: 0.91,
            context: [
              { id: "postcode.123", text: "636001" },
              { id: "place.456", text: "Salem" },
              { id: "region.789", text: "Tamil Nadu" },
              { id: "country.000", text: "India", short_code: "in" },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { prisma, service } = createService([
      setting(mapRoutingSettingKeys.mapboxAccessToken, "mapbox-token"),
    ]);

    const first = await service.reverseGeocode({ latitude: 11.664301, longitude: 78.146001 });
    const second = await service.reverseGeocode({ latitude: 11.664304, longitude: 78.146004 });

    expect(first.latitude).toBe(11.664301);
    expect(second.latitude).toBe(11.664304);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.client.setting.findMany).toHaveBeenCalledTimes(1);
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
    service: new MapsService(prisma as never),
  };
}

function setting(key: string, value: unknown) {
  return { key, value };
}
