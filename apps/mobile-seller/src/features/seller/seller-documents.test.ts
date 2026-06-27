import { describe, expect, it } from "vitest";
import type { SellerDocumentType } from "./seller-api";

const sellerDocumentTypes = [
  "ID_PROOF",
  "SIGNATURE_PROOF",
  "GST_CERTIFICATE",
  "FSSAI_CERTIFICATE",
  "PAN_CARD",
  "ADDRESS_PROOF",
  "BANK_PROOF",
  "BUSINESS_REGISTRATION",
  "OTHER",
] satisfies SellerDocumentType[];

describe("seller mobile document types", () => {
  it("uses backend-accepted verification document types", () => {
    expect(sellerDocumentTypes).toContain("BUSINESS_REGISTRATION");
    expect(sellerDocumentTypes).toContain("FSSAI_CERTIFICATE");
    expect(sellerDocumentTypes).not.toContain("BUSINESS_PROOF");
  });
});
