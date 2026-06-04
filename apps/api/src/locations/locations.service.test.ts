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
});
