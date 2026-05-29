import { indihubFetch } from "./api";

export type LocationCountry = {
  id: string;
  code: string;
  name: string;
  currency: string;
  locale: string;
  phoneCode: string;
  postalCodeLabel: string;
  postalCodePattern?: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type LocationSubdivision = {
  id: string;
  countryId: string;
  code: string;
  name: string;
  type: string;
  country?: LocationCountry;
};

export type LocationCity = {
  id: string;
  subdivisionId: string;
  code: string;
  name: string;
  subdivision?: LocationSubdivision & { country?: LocationCountry };
};

export type LocationArea = {
  id: string;
  cityId: string;
  code: string;
  name: string;
  postalCode?: string | null;
  city?: LocationCity;
};

export function listLocationCountries() {
  return indihubFetch<LocationCountry[]>("/api/locations/countries");
}

export function listLocationStates(countryCode?: string) {
  const suffix = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : "";
  return indihubFetch<LocationSubdivision[]>(`/api/locations/states${suffix}`);
}

export function listLocationCities(stateCode?: string) {
  const suffix = stateCode ? `?stateCode=${encodeURIComponent(stateCode)}` : "";
  return indihubFetch<LocationCity[]>(`/api/locations/cities${suffix}`);
}

export function listLocationAreas(params: { cityCode?: string; search?: string; postalCode?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.cityCode) {
    query.set("cityCode", params.cityCode);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.postalCode) {
    query.set("postalCode", params.postalCode);
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return indihubFetch<LocationArea[]>(`/api/locations/areas${suffix}`);
}

export type AdminLocationCoverage = {
  country: LocationCountry;
  counts: {
    subdivisions: number;
    cities: number;
    areas: number;
  };
  sources: Array<{
    id: string;
    code: string;
    name: string;
    provider: string;
    sourceType: string;
    countryCode?: string | null;
    sourceUrl?: string | null;
    licenseNote?: string | null;
    enabled: boolean;
    lastRunAt?: string | null;
  }>;
  latestRun?: AdminLocationImportRun | null;
};

export type AdminLocationImportRun = {
  id: string;
  mode: "IMPORT" | "REFRESH";
  status: "RUNNING" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED";
  countryCode?: string | null;
  sourceUrl?: string | null;
  sourceChecksum?: string | null;
  importedCountries: number;
  importedSubdivisions: number;
  importedCities: number;
  importedAreas: number;
  skippedRows: number;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  source?: {
    code: string;
    name: string;
    provider: string;
  };
};
