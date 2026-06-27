import {
  apiBaseUrl,
  buildAuthHeaders,
  IndihubApiError,
  indihubFetch,
  type IndihubAuthHeaders,
} from "./api";

export type SellerDocumentType =
  | "ID_PROOF"
  | "SIGNATURE_PROOF"
  | "GST_CERTIFICATE"
  | "FSSAI_CERTIFICATE"
  | "PAN_CARD"
  | "ADDRESS_PROOF"
  | "BANK_PROOF"
  | "BUSINESS_REGISTRATION"
  | "OTHER";

export type SellerDocumentUploadResult = {
  documentType: SellerDocumentType;
  fileUrl: string;
  fileName: string;
};

type PrivateDocumentUploadRequest =
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

type LocalPrivateDocumentUploadResult = {
  provider: "local";
  assetKey: string;
  maxBytes: number;
  allowedContentTypes: string[];
};

type SellerDocumentAccess =
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

type UploadOptions = {
  onProgress?: (progress: number) => void;
};

const maxDocumentBytes = 10 * 1024 * 1024;
const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function validateSellerDocument(file: File) {
  if (!allowedDocumentTypes.has(file.type)) {
    throw new Error("Upload a PDF, JPG, PNG, or WebP document.");
  }

  if (file.size > maxDocumentBytes) {
    throw new Error("Document must be 10 MB or smaller.");
  }
}

export async function uploadSellerDocument(
  auth: IndihubAuthHeaders,
  file: File,
  documentType: SellerDocumentType,
  options: UploadOptions = {},
) {
  validateSellerDocument(file);

  const uploadRequest = await indihubFetch<PrivateDocumentUploadRequest>(
    "/api/storage/private-document/upload-request",
    {
      method: "POST",
      body: JSON.stringify({
        documentType,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    },
    auth,
  );

  if (uploadRequest.provider === "s3") {
    await uploadSignedDocument(file, uploadRequest, options.onProgress);

    return {
      documentType,
      fileUrl: uploadRequest.assetKey,
      fileName: file.name,
    };
  }

  const localUpload = await uploadLocalDocument(
    auth,
    file,
    documentType,
    uploadRequest,
    options.onProgress,
  );

  return {
    documentType,
    fileUrl: localUpload.assetKey,
    fileName: file.name,
  };
}

export async function openSellerDocument(auth: IndihubAuthHeaders, assetKey: string) {
  const popup = window.open("", "_blank");

  try {
    const access = await indihubFetch<SellerDocumentAccess>(
      `/api/storage/private-document/access?key=${encodeURIComponent(assetKey)}`,
      undefined,
      auth,
    );

    if (access.provider === "s3") {
      openPopupOrNavigate(popup, access.url);
      return;
    }

    const response = await authenticatedDocumentFetch(auth, assetKey, false);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    openPopupOrNavigate(popup, url);

    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

function openPopupOrNavigate(popup: Window | null, url: string) {
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
    return;
  }

  window.location.href = url;
}

function uploadSignedDocument(
  file: File,
  uploadRequest: Extract<PrivateDocumentUploadRequest, { provider: "s3" }>,
  onProgress?: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(uploadRequest.method, uploadRequest.uploadUrl);

    Object.entries(uploadRequest.headers ?? {}).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("Document upload failed."));
        return;
      }

      resolve();
    };

    request.onerror = () => reject(new Error("Unable to reach the document upload service."));
    request.send(file);
  });
}

async function uploadLocalDocument(
  auth: IndihubAuthHeaders,
  file: File,
  documentType: SellerDocumentType,
  uploadRequest: Extract<PrivateDocumentUploadRequest, { provider: "local" }>,
  onProgress?: (progress: number) => void,
) {
  try {
    return await uploadLocalDocumentAttempt(auth, file, documentType, uploadRequest, onProgress, false);
  } catch (error) {
    if (error instanceof IndihubApiError && error.status === 401 && auth.getBearerToken) {
      try {
        return await uploadLocalDocumentAttempt(auth, file, documentType, uploadRequest, onProgress, true);
      } catch (retryError) {
        if (retryError instanceof IndihubApiError && retryError.status === 401) {
          auth.onUnauthorized?.(retryError);
        }
        throw retryError;
      }
    }

    if (error instanceof IndihubApiError && error.status === 401) {
      auth.onUnauthorized?.(error);
    }

    throw error;
  }
}

async function uploadLocalDocumentAttempt(
  auth: IndihubAuthHeaders,
  file: File,
  documentType: SellerDocumentType,
  uploadRequest: Extract<PrivateDocumentUploadRequest, { provider: "local" }>,
  onProgress: ((progress: number) => void) | undefined,
  skipCache: boolean,
) {
  const authHeaders = await buildAuthHeaders(auth, { skipCache });

  return new Promise<LocalPrivateDocumentUploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(uploadRequest.method, `${apiBaseUrl}${uploadRequest.uploadPath}`);

    Object.entries(authHeaders).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(xhrApiError(request));
        return;
      }

      try {
        resolve(JSON.parse(request.responseText) as LocalPrivateDocumentUploadResult);
      } catch {
        reject(new Error("Document upload response was invalid."));
      }
    };

    request.onerror = () => reject(new Error("Unable to reach the document upload service."));

    const form = new FormData();
    form.append("documentType", documentType);
    form.append("file", file);
    request.send(form);
  });
}

async function authenticatedDocumentFetch(
  auth: IndihubAuthHeaders,
  assetKey: string,
  skipCache: boolean,
): Promise<Response> {
  const headers = await buildAuthHeaders(auth, { skipCache });
  const response = await fetch(
    `${apiBaseUrl}/api/storage/private-document?key=${encodeURIComponent(assetKey)}`,
    { headers },
  );

  if (response.status === 401 && auth.getBearerToken && !skipCache) {
    return authenticatedDocumentFetch(auth, assetKey, true);
  }

  if (!response.ok) {
    throw await documentFetchError(response);
  }

  return response;
}

async function documentFetchError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const details = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const message = errorMessageFromDetails(details) || `Request failed with status ${response.status}`;
  return new IndihubApiError(message, response.status, details);
}

function xhrApiError(request: XMLHttpRequest) {
  const details = parseXhrDetails(request.responseText);
  const message = errorMessageFromDetails(details) || `Request failed with status ${request.status}`;
  return new IndihubApiError(message, request.status, details);
}

function parseXhrDetails(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function errorMessageFromDetails(details: unknown) {
  if (typeof details === "string" && details.trim()) {
    return details;
  }

  if (details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(", ");
    }
  }

  return "";
}
