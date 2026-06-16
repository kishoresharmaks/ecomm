import {
  apiBaseUrl,
  buildAuthHeaders,
  indihubFetch,
  IndihubApiError,
  type IndihubAuthHeaders,
} from "./api";

const maxPurchaseOrderBytes = 10 * 1024 * 1024;
const allowedPurchaseOrderTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type B2BPurchaseOrderUploadRequest =
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

export type B2BPurchaseOrderUploadResult = {
  provider: "local";
  assetKey: string;
  scanStatus: "NOT_SCANNED";
  orphanCleanupAfterHours: number;
};

export type B2BPurchaseOrderDocumentAccess =
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

export function validateB2BPurchaseOrderFile(file: File) {
  if (!allowedPurchaseOrderTypes.has(file.type)) {
    throw new Error("Upload a PDF, JPG, PNG, or WebP purchase order file.");
  }

  if (file.size <= 0 || file.size > maxPurchaseOrderBytes) {
    throw new Error("Purchase order file must be 10 MB or less.");
  }
}

export async function uploadB2BPurchaseOrderDocument(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  file: File,
) {
  validateB2BPurchaseOrderFile(file);
  const uploadRequest = await indihubFetch<B2BPurchaseOrderUploadRequest>(
    `/api/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order/upload-request`,
    {
      method: "POST",
      body: JSON.stringify({
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
      throw new Error("Purchase order upload failed. Please retry.");
    }

    return uploadRequest.assetKey;
  }

  const form = new FormData();
  form.append("file", file);
  const uploadResponse = await authenticatedRawFetch(uploadRequest.uploadPath, auth, {
    method: "POST",
    body: form,
  });
  const uploadResult = (await uploadResponse.json()) as B2BPurchaseOrderUploadResult;
  return uploadResult.assetKey;
}

export async function openB2BPurchaseOrderDocument(
  auth: IndihubAuthHeaders,
  accessPath: string,
  documentPath: string,
) {
  const popup = window.open("", "_blank");

  try {
    const access = await indihubFetch<B2BPurchaseOrderDocumentAccess>(
      accessPath,
      undefined,
      auth,
    );

    if (access.provider === "s3") {
      openPopupOrNavigate(popup, access.url);
      return;
    }

    const response = await authenticatedRawFetch(documentPath, auth);
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
  init: RequestInit = {},
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
    ? await response.json()
    : await response.text();

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

  return new IndihubApiError(`Request failed with status ${response.status}`, response.status, details);
}

function openPopupOrNavigate(popup: Window | null, url: string) {
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
    return;
  }

  window.location.href = url;
}
