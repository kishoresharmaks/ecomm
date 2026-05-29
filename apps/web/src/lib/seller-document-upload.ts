import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type SellerDocumentType =
  | "GST_CERTIFICATE"
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

type PrivateDocumentUploadRequest = {
  provider: "s3";
  method: "PUT";
  uploadUrl: string;
  assetKey: string;
  headers?: Record<string, string>;
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
      }),
    },
    auth,
  );

  await uploadSignedDocument(file, uploadRequest, options.onProgress);

  return {
    documentType,
    fileUrl: uploadRequest.assetKey,
    fileName: file.name,
  };
}

function uploadSignedDocument(
  file: File,
  uploadRequest: PrivateDocumentUploadRequest,
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
