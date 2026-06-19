import { describe, expect, it } from "vitest";
import type { SellerDocumentType } from "./seller-api";

const sellerDocumentTypes = [
  "ID_PROOF",
  "SIGNATURE_PROOF",
  "GST_CERTIFICATE",
  "PAN_CARD",
  "ADDRESS_PROOF",
  "BANK_PROOF",
  "BUSINESS_REGISTRATION",
  "OTHER",
] satisfies SellerDocumentType[];

describe("seller mobile document types", () => {
  it("uses backend-accepted verification document types", () => {
    expect(sellerDocumentTypes).toContain("BUSINESS_REGISTRATION");
    expect(sellerDocumentTypes).not.toContain("BUSINESS_PROOF");
  });
});
