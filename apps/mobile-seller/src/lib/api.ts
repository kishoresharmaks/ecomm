const DEFAULT_API_URL = "http://localhost:4000/api";
const REQUEST_TIMEOUT_MS = 12000;

export type BearerTokenOptions = {
  skipCache?: boolean;
};

export type MobileAuthHeaders = {
  bearerToken?: string | null;
  getBearerToken?: (options?: BearerTokenOptions) => Promise<string | null | undefined>;
  onUnauthorized?: (error: MobileApiError) => void;
};

export type ApiRequestOptions = {
  path: string;
  token?: string | null;
  auth?: MobileAuthHeaders;
  searchParams?: Record<string, string | number | null | undefined>;
  signal?: AbortSignal;
};

export class MobileApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
  }
}

export function apiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_API_URL;
  }

  throw new Error("EXPO_PUBLIC_API_URL is required for seller mobile builds.");
}

export async function getJson<T>(options: ApiRequestOptions): Promise<T> {
  return requestJson<T>("GET", options);
}

export async function postJson<T>(options: ApiRequestOptions & { body?: unknown }): Promise<T> {
  return requestJson<T>("POST", options);
}

export async function patchJson<T>(options: ApiRequestOptions & { body?: unknown }): Promise<T> {
  return requestJson<T>("PATCH", options);
}

export async function deleteJson<T>(options: ApiRequestOptions): Promise<T> {
  return requestJson<T>("DELETE", options);
}

export async function postNoContent(options: ApiRequestOptions & { body?: unknown }): Promise<void> {
  await requestRaw("POST", options, { retryUnauthorized: true });
}

async function requestJson<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  options: ApiRequestOptions & { body?: unknown },
): Promise<T> {
  const result = await requestRaw(method, options, { retryUnauthorized: true });
  if (result.response.status === 204) {
    return undefined as T;
  }
  return (await result.response.json()) as T;
}

async function requestRaw(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  options: ApiRequestOptions & { body?: unknown },
  settings: { retryUnauthorized: boolean },
) {
  let result = await send(method, options, { skipCache: false });

  if (result.response.status === 401 && settings.retryUnauthorized && options.auth?.getBearerToken) {
    result = await send(method, options, { skipCache: true });
  }

  if (!result.response.ok) {
    const error = new MobileApiError(await safeErrorMessage(result.response), result.response.status);
    if (result.response.status === 401) {
      options.auth?.onUnauthorized?.(error);
    }
    throw error;
  }

  return result;
}

async function send(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  options: ApiRequestOptions & { body?: unknown },
  tokenOptions: BearerTokenOptions,
) {
  const url = buildApiUrl(options.path, options.searchParams);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortListener = () => controller.abort();
  options.signal?.addEventListener("abort", abortListener, { once: true });

  try {
    const bearerToken = await bearerTokenForRequest(options, tokenOptions);
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST" || method === "PATCH" ? { "Content-Type": "application/json" } : {}),
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      ...(method === "POST" || method === "PATCH" ? { body: JSON.stringify(options.body ?? {}) } : {}),
      signal: controller.signal,
    });

    return { response, bearerToken };
  } catch (error) {
    if (error instanceof MobileApiError) {
      throw error;
    }
    throw new MobileApiError("We could not reach 1HandIndia. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortListener);
  }
}

async function bearerTokenForRequest(options: ApiRequestOptions, tokenOptions: BearerTokenOptions) {
  if (options.auth?.getBearerToken) {
    try {
      return (await options.auth.getBearerToken(tokenOptions)) ?? options.auth.bearerToken ?? options.token ?? null;
    } catch {
      return options.auth.bearerToken ?? options.token ?? null;
    }
  }

  return options.auth?.bearerToken ?? options.token ?? null;
}

function buildApiUrl(path: string, searchParams?: ApiRequestOptions["searchParams"]) {
  const url = new URL(`${apiBaseUrl()}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function safeErrorMessage(response: Response) {
  const status = response.status;
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status >= 500) {
    return "1HandIndia is taking longer than expected. Please try again.";
  }

  const details = await readErrorDetails(response);
  if (details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return sanitizeAuthMessage(message, status);
    }
    if (Array.isArray(message)) {
      return sanitizeAuthMessage(message.join(", "), status);
    }
  }

  return "Something went wrong. Please check the details and try again.";
}

async function readErrorDetails(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

export function sanitizeAuthMessage(message: string, status: number) {
  const lower = message.toLowerCase();
  if (
    status === 401 ||
    lower.includes("clerk") ||
    lower.includes("jwt") ||
    lower.includes("bearer") ||
    lower.includes("session token")
  ) {
    return "Your session has expired. Please sign in again.";
  }

  return message.trim() || "Something went wrong. Please check the details and try again.";
}
