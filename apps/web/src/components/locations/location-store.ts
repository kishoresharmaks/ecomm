"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listLocationAreas,
  listLocationCities,
  listLocationCountries,
  listLocationStates,
  type LocationArea,
  type LocationCityQuery,
} from "../../lib/location-api";
import { normalizeLocalAreaSearchValue } from "./location-utils";

export const locationQueryKeys = {
  countries: () => ["locations", "countries"] as const,
  states: (countryCode: string) => ["locations", "states", countryCode] as const,
  cities: (params: LocationCityQuery) =>
    ["locations", "cities", params.countryCode ?? "", params.stateCode ?? ""] as const,
  areas: (params: LocationAreaStoreRequest["queryParams"]) =>
    [
      "locations",
      "areas",
      params.countryCode ?? "",
      params.stateCode ?? "",
      params.cityCode ?? "",
      params.search ?? "",
      params.postalCode ?? "",
      params.limit ?? "",
    ] as const,
};

type LocationAreaStoreInput = {
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  search?: string | null;
  postalCode?: string | null;
  limit?: number;
  minimumSearchLength?: number;
  enabled?: boolean;
};

type LocationAreaQueryParams = {
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  search?: string;
  postalCode?: string;
  limit?: number;
};

type LocationCatalogInput = {
  countryCode?: string | null;
  stateCode?: string | null;
  loadCitiesAcrossCountry?: boolean;
};

export type LocationCityCatalogRequest = {
  queryParams: LocationCityQuery;
  enabled: boolean;
};

export type LocationAreaStoreRequest = {
  areaLookupSearch: string;
  canSearchAcrossCities: boolean;
  scopedCityCode: string;
  queryParams: LocationAreaQueryParams;
  enabled: boolean;
};

export function buildLocationCityCatalogRequest(input: LocationCatalogInput): LocationCityCatalogRequest {
  const countryCode = cleanCode(input.countryCode);
  const stateCode = cleanCode(input.stateCode);
  const queryParams: LocationCityQuery = {};

  if (stateCode) {
    queryParams.stateCode = stateCode;
    if (countryCode) {
      queryParams.countryCode = countryCode;
    }
  } else if (input.loadCitiesAcrossCountry && countryCode) {
    queryParams.countryCode = countryCode;
  }

  return {
    queryParams,
    enabled: Boolean(stateCode || (input.loadCitiesAcrossCountry && countryCode)),
  };
}

export function buildLocationAreaStoreRequest(input: LocationAreaStoreInput): LocationAreaStoreRequest {
  const countryCode = cleanCode(input.countryCode);
  const stateCode = cleanCode(input.stateCode);
  const cityCode = cleanCode(input.cityCode);
  const postalCode = cleanCode(input.postalCode);
  const areaLookupSearch = normalizeLocalAreaSearchValue(input.search ?? "");
  const minimumSearchLength = input.minimumSearchLength ?? 2;
  const canSearchAcrossCities = areaLookupSearch.trim().length >= minimumSearchLength;
  const scopedCityCode = canSearchAcrossCities ? "" : cityCode;
  const queryParams: LocationAreaQueryParams = {};

  if (countryCode) {
    queryParams.countryCode = countryCode;
  }
  if (stateCode) {
    queryParams.stateCode = stateCode;
  }
  if (scopedCityCode) {
    queryParams.cityCode = scopedCityCode;
  }
  if (areaLookupSearch) {
    queryParams.search = areaLookupSearch;
  }
  if (postalCode) {
    queryParams.postalCode = postalCode;
  }
  if (input.limit) {
    queryParams.limit = input.limit;
  }

  return {
    areaLookupSearch,
    canSearchAcrossCities,
    scopedCityCode,
    queryParams,
    enabled: Boolean(input.enabled !== false && (postalCode || scopedCityCode || canSearchAcrossCities)),
  };
}

export function useLocationCatalog({
  countryCode,
  stateCode,
  loadCitiesAcrossCountry = false,
}: LocationCatalogInput) {
  const normalizedCountryCode = cleanCode(countryCode);
  const normalizedStateCode = cleanCode(stateCode);
  const cityRequest = useMemo(
    () =>
      buildLocationCityCatalogRequest({
        countryCode: normalizedCountryCode,
        stateCode: normalizedStateCode,
        loadCitiesAcrossCountry,
      }),
    [loadCitiesAcrossCountry, normalizedCountryCode, normalizedStateCode],
  );

  const countriesQuery = useQuery({
    queryKey: locationQueryKeys.countries(),
    queryFn: listLocationCountries,
  });
  const statesQuery = useQuery({
    queryKey: locationQueryKeys.states(normalizedCountryCode),
    queryFn: () => listLocationStates(normalizedCountryCode),
    enabled: Boolean(normalizedCountryCode),
  });
  const citiesQuery = useQuery({
    queryKey: locationQueryKeys.cities(cityRequest.queryParams),
    queryFn: () => listLocationCities(cityRequest.queryParams),
    enabled: cityRequest.enabled,
  });

  return {
    countriesQuery,
    statesQuery,
    citiesQuery,
    countries: countriesQuery.data ?? [],
    states: statesQuery.data ?? [],
    cities: citiesQuery.data ?? [],
  };
}

export function useLocationAreaStore(input: LocationAreaStoreInput) {
  const request = useMemo(
    () => buildLocationAreaStoreRequest(input),
    [
      input.countryCode,
      input.stateCode,
      input.cityCode,
      input.search,
      input.postalCode,
      input.limit,
      input.minimumSearchLength,
      input.enabled,
    ],
  );
  const query = useQuery<LocationArea[]>({
    queryKey: locationQueryKeys.areas(request.queryParams),
    queryFn: () => listLocationAreas(request.queryParams),
    enabled: request.enabled,
  });

  return {
    ...query,
    ...request,
    areas: query.data ?? [],
  };
}

function cleanCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}
