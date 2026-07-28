import { apiBaseUrl, MobileApiError, resolveMobileBearerToken, type MobileAuthHeaders } from "../../lib/api";

const allowedQualityImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxQualityImageBytes = 10 * 1024 * 1024;

export type ReturnQualityImageFile = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type UploadRequest =
  | {
      provider: "s3";
      method: "PUT";
      uploadUrl: string;
      assetKey: string;
      headers?: Record<string, string>;
    }
  | {
      provider: "local";
      method: "POST";
      uploadPath: string;
    };

export async function pickReturnQualityImageFiles(): Promise<ReturnQualityImageFile[]> {
  const DocumentPicker = await import("expo-document-picker");
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: allowedQualityImageTypes,
  });

  if (result.canceled) {
    return [];
  }

  return Promise.all(
    result.assets.slice(0, 2).map(async (asset) => ({
      uri: asset.uri,
      name: asset.name || `return-quality-${Date.now()}.jpg`,
      mimeType: asset.mimeType || mimeTypeFromName(asset.name),
      sizeBytes: asset.size ?? (await fileSizeBytes(asset.uri)),
    })),
  );
}

export async function uploadReturnQualityImage(auth: MobileAuthHeaders, file: ReturnQualityImageFile) {
  validateReturnQualityImage(file);
  const request = await createUploadRequest(auth, file);

  if (request.provider === "s3") {
    await putImage(request.uploadUrl, file, request.headers ?? { "Content-Type": file.mimeType });
    return request.assetKey;
  }

  const form = new FormData();
  form.append("purpose", "RETURN_QUALITY_IMAGE");
  form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  const token = await resolveMobileBearerToken(auth, { skipCache: true });
  const response = await fetch(`${apiBaseUrl()}${request.uploadPath}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (!response.ok) {
    throw new MobileApiError(await uploadErrorMessage(response), response.status);
  }
  const payload = (await response.json()) as { assetKey?: string };
  if (!payload.assetKey) {
    throw new Error("Upload response did not include a proof reference.");
  }
  return payload.assetKey;
}

function validateReturnQualityImage(file: ReturnQualityImageFile) {
  if (!allowedQualityImageTypes.includes(file.mimeType)) {
    throw new Error("Upload JPG, PNG, or WebP images only.");
  }
  if (!file.sizeBytes || file.sizeBytes > maxQualityImageBytes) {
    throw new Error("Each return quality image must be 10 MB or less.");
  }
}

async function createUploadRequest(auth: MobileAuthHeaders, file: ReturnQualityImageFile) {
  const token = await resolveMobileBearerToken(auth, { skipCache: true });
  const response = await fetch(`${apiBaseUrl()}/storage/delivery-proof/upload-request`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      purpose: "RETURN_QUALITY_IMAGE",
      fileName: file.name,
      contentType: file.mimeType,
      sizeBytes: file.sizeBytes,
    }),
  });
  if (!response.ok) {
    throw new MobileApiError(await uploadErrorMessage(response), response.status);
  }
  return (await response.json()) as UploadRequest;
}

async function putImage(url: string, file: ReturnQualityImageFile, headers: Record<string, string>) {
  const blob = await fetch(file.uri).then((response) => response.blob());
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: blob,
  });
  if (!response.ok) {
    throw new MobileApiError("Image upload failed. Please try again.", response.status);
  }
}

async function fileSizeBytes(uri: string) {
  const FileSystem = await import("expo-file-system");
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : 0;
}

function mimeTypeFromName(name?: string | null) {
  const lower = (name ?? "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function uploadErrorMessage(response: Response) {
  const details = await response.json().catch(() => null);
  if (details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return "Image upload failed. Please try again.";
}
