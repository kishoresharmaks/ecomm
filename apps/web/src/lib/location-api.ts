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
  metadata?: Record<string, unknown> | null;
  city?: LocationCity;
};

export type AdminIndiaPincodeImportQuality = {
  totalRows: number;
  acceptedRows: number;
  skippedRows: number;
  missingRequiredRows: number;
  invalidPincodeRows: number;
  unknownStateRows: number;
  duplicateSourceRows: number;
  uniquePincodes: number;
  multiOfficePincodes: number;
  stateCount: number;
  districtCityCount: number;
  localAreaCount: number;
  deliveryStatusCounts: Record<string, number>;
  officeTypeCounts: Record<string, number>;
  readyToApply: boolean;
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
  metadata?: {
    acceptedRows?: number;
    sourceResourceId?: string;
    hierarchyMapping?: string;
    quality?: AdminIndiaPincodeImportQuality;
  } | null;
  startedAt: string;
  finishedAt?: string | null;
  source?: {
    code: string;
    name: string;
    provider: string;
  };
};

export type AdminIndiaPostalLookupPostOffice = {
  name: string;
  branchType: string | null;
  deliveryStatus: string | null;
  circle: string | null;
  district: string | null;
  division: string | null;
  region: string | null;
  block: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  databaseMatch?: AdminIndiaPostalStoredArea | null;
};

export type AdminIndiaPostalStoredArea = {
  code: string;
  name: string;
  postalCode: string | null;
  cityName: string;
  cityCode: string;
  stateName: string;
  stateCode: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminIndiaPostalLookupComparison = {
  status: "MATCHED" | "PARTIAL" | "NOT_IMPORTED" | "DATABASE_ONLY" | "NO_DATA";
  storedAreaCount: number;
  matchedPostOfficeCount: number;
  missingPostOfficeCount: number;
  extraStoredAreaCount: number;
  storedAreas: AdminIndiaPostalStoredArea[];
  missingPostOffices: AdminIndiaPostalLookupPostOffice[];
  extraStoredAreas: AdminIndiaPostalStoredArea[];
};

export type AdminIndiaPostalLookupResponse = {
  provider: "api.postalpincode.in";
  queryType: "PINCODE" | "POST_OFFICE";
  query: string;
  sourceUrl: string;
  status: "SUCCESS" | "NOT_FOUND";
  message: string;
  postOffices: AdminIndiaPostalLookupPostOffice[];
  comparison?: AdminIndiaPostalLookupComparison;
};

export type AdminLocationServiceabilitySummary = {
  status: "READY" | "PARTIAL" | "NOT_SERVICEABLE";
  query: {
    countryCode: string | null;
    stateCode: string | null;
    cityCode: string | null;
    pincode: string | null;
    localAreaCode: string | null;
    subtotalPaise: number;
    paymentMethod: "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
  };
  knownLocation: {
    country: { code: string; name: string; enabled: boolean } | null;
    state: { code: string; name: string; active: boolean } | null;
    city: { code: string; name: string; active: boolean } | null;
    localArea: { code: string; name: string; postalCode: string | null; active: boolean } | null;
  };
  readiness: {
    locationKnown: boolean;
    deliveryAvailable: boolean;
    codAvailable: boolean;
    sellerCoverage: boolean;
    deliveryPartnerCoverage: boolean;
    shippingRateConfigured: boolean;
  };
  delivery: {
    mode: string;
    routingFailed: boolean;
    routingFailureReason: string | null;
    routingFailureNote: string | null;
    matchedRateCardId: string | null;
    matchedRateCardName: string | null;
    shippingChargePaise: number;
    codSurchargePaise: number;
    totalDeliveryChargePaise: number;
    recommendedPartnerUserId: string | null;
    recommendedPartnerName: string | null;
    courierProviderCode: string | null;
    warnings: string[];
    diagnostics: {
      localPartnersChecked: number;
      localEligiblePartners: number;
      rejectedPartnersSkipped: number;
      codLimitSkipped: number;
      rateCardsChecked: number;
      providerChecked: string | null;
    };
  };
  payments: {
    requestedMethod: "RAZORPAY" | "COD" | "BANK_TRANSFER" | "MANUAL";
    requestedMethodEnabled: boolean;
    codEnabled: boolean;
    codMaxOrderPaise: number | null;
    methods: Array<{
      method: string;
      label: string;
      enabled: boolean;
      note?: string;
    }>;
  };
  coverage: {
    approvedSellerCount: number;
    exactSellerCount: number;
    citySellerCount: number;
    stateSellerCount: number;
    countrySellerCount: number;
    activeDeliveryPartnerCount: number;
    eligibleLocalPartnerCount: number;
    activeShippingRateCardCount: number;
    activeCourierProviderCount: number;
  };
  nextActions: string[];
};
