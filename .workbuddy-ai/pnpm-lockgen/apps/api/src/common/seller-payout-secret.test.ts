import { afterEach, describe, expect, it } from "vitest";
import {
  decryptSellerPayoutValue,
  encryptSellerPayoutValue,
  sellerPayoutLast4,
  sellerPayoutUpiHint,
  sellerPayoutValue,
} from "./seller-payout-secret";

describe("seller payout encryption", () => {
  afterEach(() => {
    delete process.env.SELLER_PAYOUT_DATA_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts payout data without storing plaintext", () => {
    process.env.SELLER_PAYOUT_DATA_ENCRYPTION_KEY =
      "test-only-seller-payout-key-at-least-32-characters";

    const encrypted = encryptSellerPayoutValue("1234567890");

    expect(encrypted).not.toContain("1234567890");
    expect(decryptSellerPayoutValue(encrypted)).toBe("1234567890");
  });

  it("supports legacy readback and non-sensitive display hints", () => {
    expect(sellerPayoutValue(null, " 1234567890 ")).toBe("1234567890");
    expect(sellerPayoutLast4("1234567890")).toBe("7890");
    expect(sellerPayoutUpiHint("seller@upi")).toBe("se***@upi");
  });

  it("requires a configured encryption key for new encrypted writes", () => {
    expect(() => encryptSellerPayoutValue("1234567890")).toThrow(
      "SELLER_PAYOUT_DATA_ENCRYPTION_KEY",
    );
  });
});
