import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type FxProviderAdapterCode = "FRANKFURTER" | "CURRENCYAPI";

export type FxProvider = {
  id: string;
  providerCode: string;
  displayName: string;
  adapterCode: FxProviderAdapterCode;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number;
  apiBaseUrl: string | null;
  credentialsConfigured: boolean;
  timeoutMs: number;
  cacheTtlMinutes: number;
  notes: string | null;
  lastHealthStatus: "NEVER_TESTED" | "HEALTHY" | "ERROR";
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportedFxProvider = {
  adapterCode: FxProviderAdapterCode;
  providerCode: string;
  displayName: string;
  apiBaseUrl: string;
  requiresApiKey: boolean;
  description: string;
};

export type FxProviderList = {
  items: FxProvider[];
  supportedProviders: SupportedFxProvider[];
  runtimeFallback: {
    providerCode: string;
    displayName: string;
    adapterCode: FxProviderAdapterCode;
    credentialsConfigured: boolean;
    source: "ENVIRONMENT_FALLBACK";
  } | null;
  baseCurrency: string;
};

export type UpsertFxProviderPayload = {
  adapterCode: FxProviderAdapterCode;
  providerCode?: string;
  displayName: string;
  isEnabled?: boolean;
  isPrimary?: boolean;
  priority?: number;
  apiBaseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  timeoutMs?: number;
  cacheTtlMinutes?: number;
  notes?: string;
};

export type FxQuote = {
  providerId: string | null;
  providerCode: string;
  displayName: string;
  adapterCode: FxProviderAdapterCode;
  isPrimary: boolean;
  status: "SUCCESS" | "ERROR";
  rate: number | null;
  convertedMinor: number | null;
  providerTimestamp: string | null;
  receivedAt: string;
  latencyMs: number;
  error: string | null;
  deviationBps?: number | null;
};

export type FxQuoteComparison = {
  baseCurrency: string;
  quoteCurrency: string;
  amountMinor: number;
  generatedAt: string;
  primaryProviderCode: string | null;
  quotes: FxQuote[];
};

export function listFxProviders(auth: IndihubAuthHeaders) {
  return indihubFetch<FxProviderList>("/api/admin/finance/fx-providers", undefined, auth);
}

export function createFxProvider(auth: IndihubAuthHeaders, payload: UpsertFxProviderPayload) {
  return indihubFetch<FxProvider>(
    "/api/admin/finance/fx-providers",
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function updateFxProvider(
  auth: IndihubAuthHeaders,
  providerId: string,
  payload: UpsertFxProviderPayload,
) {
  return indihubFetch<FxProvider>(
    `/api/admin/finance/fx-providers/${encodeURIComponent(providerId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function makeFxProviderPrimary(auth: IndihubAuthHeaders, providerId: string) {
  return indihubFetch<FxProvider>(
    `/api/admin/finance/fx-providers/${encodeURIComponent(providerId)}/primary`,
    { method: "PATCH" },
    auth,
  );
}

export function compareFxQuotes(
  auth: IndihubAuthHeaders,
  payload: { baseCurrency: string; quoteCurrency: string; amountMinor: number },
) {
  return indihubFetch<FxQuoteComparison>(
    "/api/admin/finance/fx-providers/quotes/compare",
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function testFxProvider(
  auth: IndihubAuthHeaders,
  providerId: string,
  payload: { baseCurrency: string; quoteCurrency: string; amountMinor: number },
) {
  return indihubFetch<FxQuote>(
    `/api/admin/finance/fx-providers/${encodeURIComponent(providerId)}/test`,
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}
