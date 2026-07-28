import { describe, expect, it } from "vitest";
import {
  missingOnboardingDocumentTypes,
  normalizeGstin,
  requiredOnboardingDocumentTypes,
  validateGstin,
} from "./seller-tax";

describe("seller tax identity", () => {
  it("normalizes and validates registered GSTIN values", () => {
    expect(normalizeGstin(" 33abcde1234f1z5 ")).toBe("33ABCDE1234F1Z5");
    expect(validateGstin("GST_REGISTERED", "33abcde1234f1z5")).toBeUndefined();
    expect(validateGstin("COMPOSITION", "invalid")).toBe("Enter a valid 15-character GSTIN.");
    expect(validateGstin("NOT_REGISTERED", "")).toBeUndefined();
  });

  it("requires base documents and adds GST certificate for registered sellers", () => {
    expect(requiredOnboardingDocumentTypes("NOT_REGISTERED")).toEqual([
      "ID_PROOF",
      "SIGNATURE_PROOF",
      "ADDRESS_PROOF",
      "BANK_PROOF",
    ]);
    expect(requiredOnboardingDocumentTypes("GST_REGISTERED")).toContain("GST_CERTIFICATE");
    expect(
      missingOnboardingDocumentTypes("GST_REGISTERED", [
        { documentType: "ID_PROOF", fileUrl: "id.pdf" },
        { documentType: "SIGNATURE_PROOF", fileUrl: "signature.pdf" },
        { documentType: "ADDRESS_PROOF", fileUrl: "address.pdf" },
        { documentType: "BANK_PROOF", fileUrl: "bank.pdf" },
      ]),
    ).toEqual(["GST_CERTIFICATE"]);
  });
});
