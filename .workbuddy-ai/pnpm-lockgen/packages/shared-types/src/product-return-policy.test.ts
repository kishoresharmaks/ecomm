import { describe, expect, it } from "vitest";
import {
  normalizeProductReturnPolicy,
  productPolicyAllowsResolution,
} from "./product-return-policy";

describe("product return policy", () => {
  it("normalizes separate return and replacement rules", () => {
    const policy = normalizeProductReturnPolicy({
      returnEligibility: "Return only",
      returnWindowDays: 14,
      replacementWindowDays: 30,
      returnReasons: ["Damaged on arrival", "Wrong item received"],
    });

    expect(policy).toEqual({
      returnAllowed: true,
      replacementAllowed: false,
      returnWindowDays: 14,
      replacementWindowDays: 0,
      returnReasons: ["Damaged on arrival", "Wrong item received"],
    });
    expect(productPolicyAllowsResolution(policy, "REFUND")).toBe(true);
    expect(productPolicyAllowsResolution(policy, "REPLACEMENT")).toBe(false);
  });

  it("keeps legacy returnable products compatible and filters unsupported reasons", () => {
    expect(
      normalizeProductReturnPolicy({
        returnEligibility: "Returnable",
        returnReasons: ["Damaged on arrival", "Unsupported reason"],
      }),
    ).toMatchObject({
      returnAllowed: true,
      replacementAllowed: true,
      returnWindowDays: 7,
      replacementWindowDays: 7,
      returnReasons: ["Damaged on arrival"],
    });
  });
});
