import { describe, expect, it, vi } from "vitest";
import { LocationsService } from "./locations.service";

describe("LocationsService", () => {
  it("lists cities by country when no state is selected", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new LocationsService({
      client: {
        locationCity: { findMany },
      },
    } as never);

    await service.listCities({ countryCode: "in" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          subdivision: expect.objectContaining({
            active: true,
            country: expect.objectContaining({
              code: "IN",
              enabled: true,
            }),
          }),
        }),
      }),
    );
  });

  it("searches local areas by country/state without requiring a city first", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new LocationsService({
      client: {
        locationArea: { findMany },
      },
    } as never);

    await service.listAreas({
      countryCode: "in",
      stateCode: "in-tn",
      search: "omalur",
      limit: 25,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: expect.objectContaining({
          active: true,
          city: expect.objectContaining({
            active: true,
            subdivision: expect.objectContaining({
              code: "IN-TN",
              active: true,
              country: expect.objectContaining({
                code: "IN",
                enabled: true,
              }),
            }),
          }),
          OR: expect.arrayContaining([
            { name: { contains: "omalur", mode: "insensitive" } },
            { postalCode: { contains: "omalur" } },
            { code: { contains: "OMALUR" } },
          ]),
        }),
      }),
    );
  });

  it("dedupes identical local-area lookup requests within the public cache window", async () => {
    const areas = [{ id: "area-1", code: "IN-TN-SLM-FR", name: "Fairlands" }];
    const findMany = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(areas), 1);
        }),
    );
    const service = new LocationsService({
      client: {
        locationArea: { findMany },
      },
    } as never);

    const [first, second, third] = await Promise.all([
      service.listAreas({
        countryCode: "in",
        stateCode: "in-tn",
        cityCode: "in-tn-slm",
        search: "fairlands",
        limit: 25,
      }),
      service.listAreas({
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        search: "fairlands",
        limit: 25,
      }),
      service.listAreas({
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        search: "fairlands",
        limit: 25,
      }),
    ]);

    expect(first).toBe(areas);
    expect(second).toBe(areas);
    expect(third).toBe(areas);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("uses exact postal-code matching for full numeric local-area searches", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new LocationsService({
      client: {
        locationArea: { findMany },
      },
    } as never);

    await service.listAreas({
      countryCode: "IN",
      search: "636001",
      limit: 25,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ postalCode: "636001" }]),
        }),
      }),
    );
  });
});
