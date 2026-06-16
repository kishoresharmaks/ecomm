import { StreamableFile } from "@nestjs/common";
import { createReadStream } from "node:fs";
import type { B2BPurchaseOrderDocumentAccess } from "../storage/storage.service";

type B2BDocumentResponse = {
  redirect: (status: number, url: string) => unknown;
  set: (headers: Record<string, string>) => unknown;
};

export function sendB2BPurchaseOrderDocument(
  access: B2BPurchaseOrderDocumentAccess,
  response: B2BDocumentResponse,
) {
  if (access.provider === "s3") {
    response.redirect(302, access.url);
    return undefined;
  }

  response.set({
    "Content-Type": access.contentType,
    "Content-Disposition": `inline; filename="${safeDownloadFileName(access.fileName)}"`,
    "Cache-Control": "private, max-age=0, no-store",
  });

  return new StreamableFile(createReadStream(access.filePath));
}

function safeDownloadFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "").slice(0, 120) || "purchase-order";
}
