/**
 * PO upload orchestration — pure logic, no React.
 *
 * Allowed file types: PDF, JPEG, PNG, WebP.
 * Maximum file size: 10 MB.
 * Source: apps/api/src/b2b/b2b-buyer.controller.ts — FileInterceptor limit 10 MB,
 *         ApiBody description lists application/pdf, image/jpeg, image/png, image/webp.
 *
 * Stale presigned URL rule:
 *   A presigned URL is valid for a single upload attempt. If a network error or
 *   abort occurs mid-PUT, the URL is invalidated. Callers must call uploadPO()
 *   again from scratch — uploadPO() does not cache the URL internally.
 *
 * Submit-after-upload separation:
 *   uploadPO() returns an assetKey. The submit step (submitPurchaseOrder) is the
 *   caller's responsibility. If submit fails, the caller retries submit only —
 *   uploadPO() must not be called again.
 */

import { MobileApiError } from "../../lib/api";
import { createPOUploadRequest, uploadPOMultipart } from "../../lib/mobile-b2b-api";
import type { MobileAuthHeaders } from "../../lib/api";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Allowed MIME types — must match API allowlist exactly. */
export const PO_ALLOWED_TYPES: string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Allowed file extensions shown in error messages. */
export const PO_ALLOWED_EXTENSIONS = "PDF, JPEG, PNG, WebP";

/** Maximum PO file size in bytes: 10 MB. Source: API controller FileInterceptor limit. */
export const PO_MAX_BYTES = 10 * 1024 * 1024;

// ─── Validation ───────────────────────────────────────────────────────────────

export type POFileCandidate = {
  uri: string;
  mimeType: string;
  name: string;
  size: number;
};

export type POValidationError = {
  type: "invalid-type" | "oversize";
  message: string;
};

/**
 * Validate a PO file candidate before any network call.
 * Returns null on success, or a POValidationError to display inline.
 */
export function validatePOFile(file: POFileCandidate): POValidationError | null {
  if (!PO_ALLOWED_TYPES.includes(file.mimeType)) {
    return {
      type: "invalid-type",
      message: `Only ${PO_ALLOWED_EXTENSIONS} files are allowed. Selected file type is not supported.`,
    };
  }
  if (file.size > PO_MAX_BYTES) {
    return {
      type: "oversize",
      message: `File must be smaller than 10 MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }
  return null;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export type POUploadResult = {
  assetKey: string;
};

/**
 * Orchestrate a full PO upload:
 * 1. Call createPOUploadRequest to get upload instructions.
 * 2. If presignedUrl is present, PUT the file directly (signed path, preferred).
 *    - On PUT failure, retry once.
 *    - On second failure, fall back to multipart with a FRESH upload request.
 * 3. If no presignedUrl, use multipart upload directly.
 *
 * Returns assetKey on success. The caller must pass this to submitPurchaseOrder.
 * On any network loss the caller must call uploadPO() from scratch — never reuse
 * a previous invocation's presigned URL.
 *
 * @param onProgress Optional progress callback (0–1). Only reported for multipart.
 */
export async function uploadPO(
  auth: MobileAuthHeaders,
  orderNumber: string,
  file: POFileCandidate,
  _onProgress?: (ratio: number) => void,
): Promise<POUploadResult> {
  // Step 1: request upload instructions.
  const instructions = await createPOUploadRequest(auth, orderNumber, {
    mimeType: file.mimeType,
    fileName: file.name,
  });

  // Step 2: signed upload path (preferred).
  if (instructions.presignedUrl) {
    const assetKey = instructions.assetKey;
    const trySignedUpload = async (): Promise<void> => {
      const res = await fetch(instructions.presignedUrl!, {
        method: "PUT",
        headers: { "Content-Type": file.mimeType },
        body: await fileUriToBlob(file.uri, file.mimeType),
      });
      if (!res.ok) {
        throw new MobileApiError(`Signed upload failed with status ${res.status}.`, res.status);
      }
    };

    try {
      await trySignedUpload();
      return { assetKey };
    } catch {
      // First PUT failed — retry once.
      try {
        await trySignedUpload();
        return { assetKey };
      } catch {
        // Both signed attempts failed. Fall through to multipart with a fresh request.
      }
    }

    // Multipart fallback with a fresh upload request (stale presigned URL is not reused).
    const fallbackInstructions = await createPOUploadRequest(auth, orderNumber, {
      mimeType: file.mimeType,
      fileName: file.name,
    });
    const result = await uploadPOMultipart(
      auth,
      orderNumber,
      file.uri,
      file.mimeType,
      file.name,
    );
    return { assetKey: result.assetKey || fallbackInstructions.assetKey };
  }

  // Step 3: multipart path (no presigned URL).
  const result = await uploadPOMultipart(auth, orderNumber, file.uri, file.mimeType, file.name);
  return { assetKey: result.assetKey || instructions.assetKey };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fileUriToBlob(uri: string, mimeType: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob().then((blob) => new Blob([blob], { type: mimeType }));
}
