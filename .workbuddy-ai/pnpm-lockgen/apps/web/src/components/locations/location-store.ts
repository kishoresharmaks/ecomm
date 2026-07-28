"use client";

import { useEffect, useMemo, useState } from "react";
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

export const locationQueryCacheOptions = {
  countries: {
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  catalog: {
    staleTime: 15 * 60 * 1000,
    gcTime: 45 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  areas: {
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
} as const;

const defaultLocationAreaDebounceMs = 300;

type LocationAreaStoreInput = {
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  search?: string | null;
  postalCode?: string | null;
  limit?: number;
  minimumSearchLength?: number;
  debounceMs?: number;
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
    ...locationQueryCacheOptions.countries,
  });
  const statesQuery = useQuery({
    queryKey: locationQueryKeys.states(normalizedCountryCode),
    queryFn: () => listLocationStates(normalizedCountryCode),
    enabled: Boolean(normalizedCountryCode),
    ...locationQueryCacheOptions.catalog,
  });
  const citiesQuery = useQuery({
    queryKey: locationQueryKeys.cities(cityRequest.queryParams),
    queryFn: () => listLocationCities(cityRequest.queryParams),
    enabled: cityRequest.enabled,
    ...locationQueryCacheOptions.catalog,
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
  const debounceMs = input.debounceMs ?? defaultLocationAreaDebounceMs;
  const debouncedSearch = useDebouncedValue(input.search ?? "", debounceMs);
  const debouncedPostalCode = useDebouncedValue(input.postalCode ?? "", debounceMs);
  const request = useMemo(
    () => {
      const requestInput: LocationAreaStoreInput = {
        countryCode: input.countryCode ?? null,
        stateCode: input.stateCode ?? null,
        cityCode: input.cityCode ?? null,
        search: debouncedSearch,
        postalCode: debouncedPostalCode,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.minimumSearchLength !== undefined ? { minimumSearchLength: input.minimumSearchLength } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      };

      return buildLocationAreaStoreRequest(requestInput);
    },
    [
      debouncedPostalCode,
      debouncedSearch,
      input.countryCode,
      input.cityCode,
      input.stateCode,
      input.limit,
      input.minimumSearchLength,
      input.enabled,
    ],
  );
  const query = useQuery<LocationArea[]>({
    queryKey: locationQueryKeys.areas(request.queryParams),
    queryFn: () => listLocationAreas(request.queryParams),
    enabled: request.enabled,
    ...locationQueryCacheOptions.areas,
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

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value);
      return;
    }

    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}
