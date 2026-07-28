import * as ImagePicker from "expo-image-picker";
import { apiBaseUrl, MobileApiError, type MobileAuthHeaders } from "../../lib/api";

export type ProofUploadResult = {
  provider: "local" | "s3";
  assetKey: string;
};

export type DeliveryProofUploadPurpose =
  | "DELIVERY_PROOF"
  | "RETURN_PICKUP_PROOF"
  | "RETURN_RECEIPT_PROOF"
  | "RETURN_QUALITY_IMAGE";

type ProofUploadRequest =
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

export async function pickDeliveryProofImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission is required to upload proof.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

export async function uploadDeliveryProofImage(
  auth: MobileAuthHeaders,
  uri: string,
  fileName?: string | null,
  purpose: DeliveryProofUploadPurpose = "DELIVERY_PROOF",
) {
  const token = await bearerTokenForUpload(auth);
  const name = fileName?.trim() || `delivery-proof-${Date.now()}.jpg`;
  const contentType = contentTypeFromName(name);
  const uploadRequest = await createProofUploadRequest(auth, {
    purpose,
    fileName: name,
    contentType,
    sizeBytes: await fileSizeBytes(uri),
  });

  if (uploadRequest.provider === "s3") {
    await putProofFile(uploadRequest.uploadUrl, uri, uploadRequest.headers ?? { "Content-Type": contentType });
    return { provider: "s3" as const, assetKey: uploadRequest.assetKey };
  }

  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", {
    uri,
    name,
    type: contentType,
  } as unknown as Blob);

  const response = await fetch(`${apiBaseUrl()}${uploadRequest.uploadPath}`, {
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

  return (await response.json()) as ProofUploadResult;
}

async function createProofUploadRequest(
  auth: MobileAuthHeaders,
  payload: { purpose: DeliveryProofUploadPurpose; fileName: string; contentType: string; sizeBytes: number },
) {
  const token = await bearerTokenForUpload(auth);
  const response = await fetch(`${apiBaseUrl()}/storage/delivery-proof/upload-request`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new MobileApiError(await uploadErrorMessage(response), response.status);
  }

  return (await response.json()) as ProofUploadRequest;
}

async function putProofFile(url: string, uri: string, headers: Record<string, string>) {
  const FileSystem = await import("expo-file-system/legacy");
  const result = await FileSystem.uploadAsync(url, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new MobileApiError("Proof upload failed. Please try again.", result.status);
  }
}

async function fileSizeBytes(uri: string) {
  const FileSystem = await import("expo-file-system/legacy");
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && typeof info.size === "number" && Number.isFinite(info.size) && info.size > 0) {
    return Math.round(info.size);
  }
  throw new Error("Could not read selected proof image size.");
}

async function bearerTokenForUpload(auth: MobileAuthHeaders) {
  if (auth.getBearerToken) {
    return (await auth.getBearerToken({ skipCache: true })) ?? auth.bearerToken ?? null;
  }
  return auth.bearerToken ?? null;
}

function contentTypeFromName(fileName: string) {
  const lower = fileName.toLowerCase();
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
  return "Proof upload failed. Please try again.";
}
