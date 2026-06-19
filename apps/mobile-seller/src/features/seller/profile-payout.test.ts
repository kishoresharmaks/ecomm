import { describe, expect, it } from "vitest";
import { buildSellerPayoutProfilePayload } from "./profile-payout";

const baseFields = {
  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  upiId: "",
};

describe("seller profile payout payload", () => {
  it("omits blank sensitive payout fields", () => {
    expect(
      buildSellerPayoutProfilePayload({
        ...baseFields,
        accountHolderName: "Krish",
        bankName: "IndiHub Bank",
        accountNumber: "   ",
        ifscCode: "INHB0001",
        upiId: "",
      }),
    ).toEqual({
      accountHolderName: "Krish",
      bankName: "IndiHub Bank",
      ifscCode: "INHB0001",
    });
  });

  it("includes sensitive payout fields only when re-entered", () => {
    expect(
      buildSellerPayoutProfilePayload({
        ...baseFields,
        accountNumber: " 1234567890 ",
        upiId: " seller@upi ",
      }),
    ).toEqual({
      accountNumber: "1234567890",
      upiId: "seller@upi",
    });
  });

  it("returns undefined when no payout field has a value", () => {
    expect(buildSellerPayoutProfilePayload(baseFields)).toBeUndefined();
  });
});
