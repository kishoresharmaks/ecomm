import { describe, expect, it } from "vitest";
import { validateSellerContactPhone } from "./profile-validation";

describe("validateSellerContactPhone", () => {
  it("allows empty optional phone values", () => {
    expect(validateSellerContactPhone("")).toBeUndefined();
  });

  it("accepts Indian and international phone formats allowed by the backend", () => {
    expect(validateSellerContactPhone("9876543210")).toBeUndefined();
    expect(validateSellerContactPhone("+91 98765 43210")).toBeUndefined();
    expect(validateSellerContactPhone("+1 (415) 555-0198")).toBeUndefined();
  });

  it("rejects too-short or non-phone values", () => {
    expect(validateSellerContactPhone("12345")).toBeTruthy();
    expect(validateSellerContactPhone("support@example.com")).toBeTruthy();
  });
});
