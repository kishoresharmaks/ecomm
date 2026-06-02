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
    ...(auth?.clerkUserId && !bearerToken ? { "x-clerk-user-id": auth.clerkUserId } : {})
  };
}

export async function indihubFetch<T>(path: string, init?: RequestInit, auth?: IndihubAuthHeaders): Promise<T> {
  let result = await request(path, init, auth, { skipCache: false });
  let response = result.response;

  if (response.status === 401 && auth?.getBearerToken) {
    result = await request(path, init, auth, { skipCache: true });
    response = result.response;
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

  const body = await response.json();
  return decryptResponseBody<T>(body, result.bearerToken);
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
  const bearerToken = await bearerTokenForRequest(auth, options);
  const headers = new Headers({
    "Content-Type": "application/json",
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...(auth?.platformUserId ? { "x-indihub-user-id": auth.platformUserId } : {}),
    ...(auth?.clerkUserId && !bearerToken ? { "x-clerk-user-id": auth.clerkUserId } : {})
  });

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });

  return { response, bearerToken };
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

type EncryptedResponseEnvelope = {
  encrypted: true;
  alg: "A256GCM";
  iv: string;
  tag: string;
  data: string;
};

async function decryptResponseBody<T>(body: unknown, bearerToken?: string | null) {
  if (!isEncryptedResponseEnvelope(body)) {
    return body as T;
  }

  if (!bearerToken) {
    throw new IndihubApiError("Encrypted response cannot be opened without the active session.", 0);
  }

  const context = new TextEncoder().encode(`indihub-response-v1:${bearerToken}`);
  const keyBytes = await globalThis.crypto.subtle.digest("SHA-256", context);
  const key = await globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const encrypted = concatBytes(base64ToBytes(body.data), base64ToBytes(body.tag));
  const decrypted = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(body.iv),
    },
    key,
    encrypted,
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

function isEncryptedResponseEnvelope(value: unknown): value is EncryptedResponseEnvelope {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { encrypted?: unknown }).encrypted === true &&
      (value as { alg?: unknown }).alg === "A256GCM" &&
      typeof (value as { iv?: unknown }).iv === "string" &&
      typeof (value as { tag?: unknown }).tag === "string" &&
      typeof (value as { data?: unknown }).data === "string",
  );
}

function base64ToBytes(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(first: Uint8Array, second: Uint8Array) {
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first);
  combined.set(second, first.length);
  return combined;
}
