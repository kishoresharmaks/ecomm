export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type BearerTokenOptions = {
  skipCache?: boolean;
};

export type IndihubAuthHeaders = {
  platformUserId?: string;
  clerkUserId?: string;
  bearerToken?: string;
  getBearerToken?: (options?: BearerTokenOptions) => Promise<string | null | undefined>;
  onUnauthorized?: (error: IndihubApiError) => void;
};

export const userSessionExpiredMessage = "Your sign-in session expired. Please refresh your session or sign in again.";

export class IndihubApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "IndihubApiError";
    this.status = status;
    this.details = details;
  }
}

export async function buildAuthHeaders(auth?: IndihubAuthHeaders, options: BearerTokenOptions = {}): Promise<Record<string, string>> {
  const bearerToken = await bearerTokenForRequest(auth, options);

  return {
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...(auth?.platformUserId ? { "x-indihub-user-id": auth.platformUserId } : {}),
    ...(auth?.clerkUserId ? { "x-clerk-user-id": auth.clerkUserId } : {})
  };
}

export async function indihubFetch<T>(path: string, init?: RequestInit, auth?: IndihubAuthHeaders): Promise<T> {
  let response = await request(path, init, auth, { skipCache: false });

  if (response.status === 401 && auth?.getBearerToken) {
    response = await request(path, init, auth, { skipCache: true });
  }

  if (!response.ok) {
    const details = await readErrorDetails(response);
    const error = new IndihubApiError(errorMessage(details, response.status), response.status, details);
    if (response.status === 401) {
      auth?.onUnauthorized?.(error);
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function userFacingApiErrorMessage(error: unknown) {
  if (error instanceof IndihubApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return sanitizeApiMessage(error.message);
  }

  if (typeof error === "string") {
    return sanitizeApiMessage(error);
  }

  return "Something went wrong. Please try again.";
}

async function request(path: string, init: RequestInit | undefined, auth: IndihubAuthHeaders | undefined, options: BearerTokenOptions) {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...(await buildAuthHeaders(auth, options))
  });

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });
}

async function bearerTokenForRequest(auth?: IndihubAuthHeaders, options: BearerTokenOptions = {}) {
  if (!auth?.getBearerToken) {
    return auth?.bearerToken;
  }

  try {
    const token = await auth.getBearerToken({ skipCache: Boolean(options.skipCache) });
    return token ?? auth.bearerToken;
  } catch {
    return auth.bearerToken;
  }
}

async function readErrorDetails(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function errorMessage(details: unknown, status: number) {
  let message = "";

  if (typeof details === "string" && details.trim()) {
    message = details;
  }

  if (!message && details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return sanitizeApiMessage(message.join(", "), status);
    }

    if (typeof message === "string" && message.trim()) {
      return sanitizeApiMessage(message, status);
    }
  }

  return sanitizeApiMessage(message || `Request failed with status ${status}`, status);
}

function sanitizeApiMessage(message: string, status?: number) {
  const trimmed = message.trim();
  if (!trimmed) {
    return status ? `Request failed with status ${status}` : "Something went wrong. Please try again.";
  }

  if (isDeveloperAuthMessage(trimmed, status)) {
    return userSessionExpiredMessage;
  }

  return trimmed;
}

function isDeveloperAuthMessage(message: string, status?: number) {
  const lower = message.toLowerCase();
  const mentionsToken = lower.includes("session token") || lower.includes("bearer") || lower.includes("jwt") || lower.includes("token is expired") || lower.includes("token expired");
  const mentionsClerkAuth = lower.includes("clerk") && (lower.includes("session") || lower.includes("token") || lower.includes("unauthorized"));

  return mentionsToken || mentionsClerkAuth || (status === 401 && lower.includes("clerk"));
}
