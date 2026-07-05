import {
  apiBaseUrl,
  buildAuthHeaders,
  indihubFetch,
  IndihubApiError,
  type IndihubAuthHeaders,
} from "./api";

const maxDeliveryProofBytes = 10 * 1024 * 1024;
const allowedDeliveryProofTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const allowedReturnQualityImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type DeliveryProofUploadPurpose =
  | "DELIVERY_PROOF"
  | "RETURN_PICKUP_PROOF"
  | "RETURN_RECEIPT_PROOF"
  | "RETURN_QUALITY_IMAGE";

export type DeliveryProofUploadRequest =
  | {
      provider: "s3";
      method: "PUT";
      uploadUrl: string;
      assetKey: string;
      headers?: Record<string, string>;
      maxBytes: number;
      allowedContentTypes: string[];
      expiresAt: string;
    }
  | {
      provider: "local";
      method: "POST";
      uploadPath: string;
      maxBytes: number;
      allowedContentTypes: string[];
    };

export type DeliveryProofUploadResult = {
  provider: "local" | "s3";
  assetKey: string;
  maxBytes: number;
  allowedContentTypes: string[];
  orphanCleanupAfterHours: number;
};

type PrivateProofAccess =
  | {
      provider: "s3";
      url: string;
      expiresAt: string;
      fileName: string;
      contentType: string;
    }
  | {
      provider: "local";
      fileName: string;
      contentType: string;
    };

export function validateDeliveryProofFile(file: File, purpose: DeliveryProofUploadPurpose = "DELIVERY_PROOF") {
  const allowedTypes = purpose === "RETURN_QUALITY_IMAGE" ? allowedReturnQualityImageTypes : allowedDeliveryProofTypes;
  if (!allowedTypes.has(file.type)) {
    if (purpose === "RETURN_QUALITY_IMAGE") {
      throw new Error("Upload a JPG, PNG, or WebP image for return quality check.");
    }
    throw new Error("Upload a PDF, JPG, PNG, or WebP proof file.");
  }

  if (file.size <= 0 || file.size > maxDeliveryProofBytes) {
    throw new Error("Proof file must be 10 MB or less.");
  }
}

export async function uploadDeliveryProof(
  auth: IndihubAuthHeaders,
  file: File,
  purpose: DeliveryProofUploadPurpose = "DELIVERY_PROOF",
) {
  validateDeliveryProofFile(file, purpose);
  const uploadRequest = await indihubFetch<DeliveryProofUploadRequest>(
    "/api/storage/delivery-proof/upload-request",
    {
      method: "POST",
      body: JSON.stringify({
        purpose,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    },
    auth,
  );

  if (uploadRequest.provider === "s3") {
    const response = await fetch(uploadRequest.uploadUrl, {
      method: "PUT",
      headers: uploadRequest.headers ?? { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error("Proof upload failed. Please retry.");
    }
    return {
      provider: "s3" as const,
      assetKey: uploadRequest.assetKey,
      maxBytes: uploadRequest.maxBytes,
      allowedContentTypes: uploadRequest.allowedContentTypes,
      orphanCleanupAfterHours: 24,
    };
  }

  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file);

  const response = await authenticatedRawFetch(uploadRequest.uploadPath, auth, {
    method: "POST",
    body: form,
  });
  return (await response.json()) as DeliveryProofUploadResult;
}

export async function openPrivateProofReference(auth: IndihubAuthHeaders, assetKey: string) {
  const popup = window.open("", "_blank");

  try {
    const access = await indihubFetch<PrivateProofAccess>(
      `/api/storage/private-document/access?key=${encodeURIComponent(assetKey)}`,
      undefined,
      auth,
    );

    if (access.provider === "s3") {
      openPopupOrNavigate(popup, access.url);
      return;
    }

    const response = await authenticatedRawFetch(
      `/api/storage/private-document?key=${encodeURIComponent(assetKey)}`,
      auth,
      {},
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    openPopupOrNavigate(popup, url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

async function authenticatedRawFetch(
  path: string,
  auth: IndihubAuthHeaders,
  init: RequestInit,
) {
  let response = await authenticatedRawRequest(path, auth, init, false);

  if (response.status === 401 && auth.getBearerToken) {
    response = await authenticatedRawRequest(path, auth, init, true);
  }

  if (!response.ok) {
    throw await rawApiError(response);
  }

  return response;
}

async function authenticatedRawRequest(
  path: string,
  auth: IndihubAuthHeaders,
  init: RequestInit,
  skipCache: boolean,
) {
  const headers = new Headers(await buildAuthHeaders(auth, { skipCache }));
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
}

async function rawApiError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const details = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string") {
      return new IndihubApiError(message, response.status, details);
    }
    if (Array.isArray(message)) {
      return new IndihubApiError(message.join(", "), response.status, details);
    }
  }

  if (typeof details === "string" && details.trim()) {
    return new IndihubApiError(details, response.status, details);
  }

  return new IndihubApiError(`Proof upload failed with status ${response.status}`, response.status, details);
}

function openPopupOrNavigate(popup: Window | null, url: string) {
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
    return;
  }

  window.location.href = url;
}
