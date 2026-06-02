import { describe, expect, it } from "vitest";
import {
  buildIndiaPostalLookupPath,
  indiaLocationImportGuideCards,
  validateIndiaPostalLookupForm
} from "./admin-location-import-utils";

describe("admin location import helpers", () => {
  it("keeps official bulk import and PostalPin verification guidance visible", () => {
    expect(indiaLocationImportGuideCards.map((card) => card.title)).toEqual([
      "Official bulk import",
      "CSV fallback",
      "PostalPin verification"
    ]);
    expect(indiaLocationImportGuideCards[0]?.command).toContain("pnpm locations:import:india");
    expect(indiaLocationImportGuideCards[0]?.command).toContain("--dry-run");
    expect(indiaLocationImportGuideCards[0]?.description).toContain("postal metadata");
    expect(indiaLocationImportGuideCards[2]?.source).toBe("api.postalpincode.in");
    expect(indiaLocationImportGuideCards[2]?.description).toContain("without writing");
  });

  it("validates India pincode and post-office lookup input", () => {
    expect(validateIndiaPostalLookupForm("pincode", "110001")).toBe("");
    expect(validateIndiaPostalLookupForm("pincode", "000000")).toBe("Enter a valid 6-digit India pincode.");
    expect(validateIndiaPostalLookupForm("postOffice", "C")).toBe("Post office search must contain at least 2 characters.");
    expect(validateIndiaPostalLookupForm("postOffice", "Connaught Place")).toBe("");
  });

  it("builds the backend lookup path without calling PostalPin directly from the browser", () => {
    expect(buildIndiaPostalLookupPath("pincode", " 110001 ")).toBe("/api/admin/locations/india-postal-lookup?pincode=110001");
    expect(buildIndiaPostalLookupPath("postOffice", " Connaught   Place ")).toBe(
      "/api/admin/locations/india-postal-lookup?postOffice=Connaught+Place"
    );
  });
});
