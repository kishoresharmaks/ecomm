import { apiBaseUrl, type MobileAuthHeaders } from "../../lib/api";
import type { SellerDocumentType } from "./seller-api";

export type MobileUploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number | null | undefined;
};

type UploadProgress = (progress: number) => void;

type PublicImageUploadRequest =
  | {
      provider: "imagekit";
      uploadUrl?: string;
      token: string;
      signature: string;
      expire: number;
      publicKey: string;
      folder: string;
      fileName: string;
      assetKey: string;
    }
  | {
      provider: "s3";
      method: "PUT";
      uploadUrl: string;
      headers?: Record<string, string>;
      assetKey: string;
    };

type PrivateDocumentUploadRequest =
  | {
      provider: "local";
      method: "POST";
      uploadPath: string;
      assetKey: string;
    }
  | {
      provider: "s3";
      method: "PUT";
      uploadUrl: string;
      headers?: Record<string, string>;
      assetKey: string;
    };

export type MobileUploadResult = {
  assetKey: string;
};

type ImageKitUploadResponse = {
  filePath?: string;
  message?: string;
};

export async function uploadPublicSellerImage(
  auth: MobileAuthHeaders,
  file: MobileUploadFile,
  purpose: "SELLER_PRODUCT_IMAGE" | "SELLER_LOGO" | "SELLER_BANNER",
  onProgress?: UploadProgress,
): Promise<MobileUploadResult> {
  const request = await signedJson<PublicImageUploadRequest>("/storage/public-image/upload-request", auth, {
    purpose,
    fileName: file.name,
    contentType: file.mimeType,
  });

  if (request.provider === "s3") {
    await putFile(request.uploadUrl, file, request.headers, onProgress);
    return { assetKey: request.assetKey };
  }

  return uploadImageKitImage(file, request, onProgress);
}

export async function uploadSellerPrivateDocument(
  auth: MobileAuthHeaders,
  file: MobileUploadFile,
  documentType: SellerDocumentType,
  onProgress?: UploadProgress,
): Promise<MobileUploadResult> {
  const request = await signedJson<PrivateDocumentUploadRequest>("/storage/private-document/upload-request", auth, {
    documentType,
    fileName: file.name,
    contentType: file.mimeType,
    sizeBytes: await fileSizeBytes(file),
  });

  if (request.provider === "s3") {
    await putFile(request.uploadUrl, file, request.headers, onProgress);
    return { assetKey: request.assetKey };
  }

  return uploadLocalDocument(file, documentType, request.uploadPath, auth, onProgress);
}

function uploadImageKitImage(
  file: MobileUploadFile,
  request: Extract<PublicImageUploadRequest, { provider: "imagekit" }>,
  onProgress?: UploadProgress,
): Promise<MobileUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", request.uploadUrl || "https://upload.imagekit.io/api/v1/files/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      const payload = parseImageKitUploadResponse(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.message ?? "Image upload failed. Please retry."));
        return;
      }
      onProgress?.(1);
      resolve({ assetKey: payload.filePath ?? request.assetKey });
    };

    xhr.onerror = () => reject(new Error("Unable to reach the image upload service."));

    const body = new FormData();
    body.append("file", reactNativeFormDataFile(file));
    body.append("fileName", request.fileName);
    body.append("folder", request.folder);
    body.append("publicKey", request.publicKey);
    body.append("signature", request.signature);
    body.append("expire", String(request.expire));
    body.append("token", request.token);
    body.append("useUniqueFileName", "false");

    xhr.send(body);
  });
}

function uploadLocalDocument(
  file: MobileUploadFile,
  documentType: SellerDocumentType,
  uploadPath: string,
  auth: MobileAuthHeaders,
  onProgress?: UploadProgress,
): Promise<MobileUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl()}${uploadPath}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Document upload failed. Please retry."));
        return;
      }
      onProgress?.(1);
      try {
        const response = JSON.parse(xhr.responseText) as { assetKey: string };
        resolve({ assetKey: response.assetKey });
      } catch {
        reject(new Error("Document upload response was invalid."));
      }
    };

    xhr.onerror = () => reject(new Error("Unable to reach the document upload service."));

    // Set auth headers
    bearerHeaders(auth).then((headers) => {
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      const body = new FormData();
      body.append("documentType", documentType);
      body.append("file", reactNativeFormDataFile(file));

      xhr.send(body);
    });
  });
}

async function signedJson<T>(path: string, auth: MobileAuthHeaders, body: unknown) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(await bearerHeaders(auth)),
    },
    body: JSON.stringify(body),
  });
  await assertUploadOk(response);
  return (await response.json()) as T;
}

async function putFile(
  url: string,
  file: MobileUploadFile,
  headers: Record<string, string> | undefined,
  onProgress?: UploadProgress,
) {
  try {
    const FileSystem = await import("expo-file-system/legacy");
    const result = await FileSystem.uploadAsync(url, file.uri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: headers ?? { "Content-Type": file.mimeType },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(uploadFailureMessage(result.status, result.body));
    }

    onProgress?.(1);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Storage upload failed")) {
      throw error;
    }

    throw new Error(
      error instanceof Error && error.message
        ? `Storage upload could not read or send the selected file: ${error.message}`
        : "Storage upload could not read or send the selected file.",
      { cause: error },
    );
  }
}

async function fileSizeBytes(file: MobileUploadFile) {
  if (typeof file.sizeBytes === "number" && Number.isFinite(file.sizeBytes) && file.sizeBytes > 0) {
    return Math.round(file.sizeBytes);
  }

  const FileSystem = await import("expo-file-system/legacy");
  const info = await FileSystem.getInfoAsync(file.uri);
  if (info.exists && typeof info.size === "number" && Number.isFinite(info.size) && info.size > 0) {
    return Math.round(info.size);
  }

  throw new Error("Could not read the selected file size. Please choose the document again.");
}

async function bearerHeaders(auth: MobileAuthHeaders) {
  const token = (await auth.getBearerToken?.()) ?? auth.bearerToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function assertUploadOk(response: Response) {
  if (!response.ok) {
    throw new Error("Upload failed. Please retry.");
  }
}

function parseImageKitUploadResponse(value: string): ImageKitUploadResponse {
  try {
    return JSON.parse(value) as ImageKitUploadResponse;
  } catch {
    return {};
  }
}

function reactNativeFormDataFile(file: MobileUploadFile) {
  return {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob;
}

function uploadFailureMessage(status: number, responseText: string) {
  const storageMessage = storageErrorMessage(responseText);
  if (storageMessage) {
    return `Storage upload failed (HTTP ${status}): ${storageMessage}`;
  }

  if (status === 403) {
    return "Storage upload was rejected by S3. Check the signed URL expiry, bucket policy, and CORS PUT configuration.";
  }

  return `Storage upload failed with HTTP ${status}. Please retry or ask admin to check storage settings.`;
}

function storageErrorMessage(responseText: string) {
  const message = responseText.match(/<Message>([^<]+)<\/Message>/i)?.[1]?.trim();
  if (message) {
    return message;
  }

  const code = responseText.match(/<Code>([^<]+)<\/Code>/i)?.[1]?.trim();
  return code ?? "";
}
