import { describe, expect, it } from "vitest";
import {
  buildLocationAreaStoreRequest,
  buildLocationCityCatalogRequest,
  locationQueryCacheOptions,
} from "./location-store";

describe("location central store request builder", () => {
  it("loads India cities by country when a form needs all city choices before state selection", () => {
    expect(
      buildLocationCityCatalogRequest({
        countryCode: "in",
        loadCitiesAcrossCountry: true,
      }),
    ).toEqual({
      queryParams: {
        countryCode: "IN",
      },
      enabled: true,
    });
  });

  it("keeps normal forms state-scoped for city loading", () => {
    expect(
      buildLocationCityCatalogRequest({
        countryCode: "IN",
      }),
    ).toEqual({
      queryParams: {},
      enabled: false,
    });
  });

  it("filters city loading by state after a state is selected", () => {
    expect(
      buildLocationCityCatalogRequest({
        countryCode: "IN",
        stateCode: "in-tn",
        loadCitiesAcrossCountry: true,
      }),
    ).toEqual({
      queryParams: {
        countryCode: "IN",
        stateCode: "IN-TN",
      },
      enabled: true,
    });
  });

  it("searches local areas across the selected state after enough text is typed", () => {
    expect(
      buildLocationAreaStoreRequest({
        countryCode: "in",
        stateCode: "in-tn",
        cityCode: "IN-TN-CBE",
        search: "Omalur",
        limit: 50,
      }),
    ).toMatchObject({
      canSearchAcrossCities: true,
      scopedCityCode: "",
      queryParams: {
        countryCode: "IN",
        stateCode: "IN-TN",
        search: "Omalur",
        limit: 50,
      },
      enabled: true,
    });
  });

  it("keeps city scoped area loading for initial dropdown lists", () => {
    expect(
      buildLocationAreaStoreRequest({
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-CBE",
        limit: 100,
      }),
    ).toMatchObject({
      canSearchAcrossCities: false,
      scopedCityCode: "IN-TN-CBE",
      queryParams: {
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-CBE",
        limit: 100,
      },
      enabled: true,
    });
  });

  it("supports pincode-based local-area lookup from the same store path", () => {
    expect(
      buildLocationAreaStoreRequest({
        countryCode: "IN",
        postalCode: "636455",
        limit: 25,
      }),
    ).toMatchObject({
      queryParams: {
        countryCode: "IN",
        postalCode: "636455",
        limit: 25,
      },
      enabled: true,
    });
  });

  it("keeps location query cache windows high enough for traffic-heavy forms", () => {
    expect(locationQueryCacheOptions.countries.refetchOnWindowFocus).toBe(false);
    expect(locationQueryCacheOptions.catalog.refetchOnWindowFocus).toBe(false);
    expect(locationQueryCacheOptions.areas.refetchOnWindowFocus).toBe(false);
    expect(locationQueryCacheOptions.countries.staleTime).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(locationQueryCacheOptions.catalog.staleTime).toBeGreaterThanOrEqual(15 * 60 * 1000);
    expect(locationQueryCacheOptions.areas.staleTime).toBeGreaterThanOrEqual(3 * 60 * 1000);
  });
});
