import { describe, expect, it } from "vitest";
import {
  canResendSecondFactor,
  preferredSecondFactor,
  secondFactorAttemptParams,
  secondFactorOptions,
  secondFactorPrepareParams,
} from "./clerk-second-factor";

describe("seller Clerk second-factor helpers", () => {
  it("maps supported factors and prefers an in-app email code", () => {
    const options = secondFactorOptions([
      { strategy: "totp" },
      { strategy: "email_code", emailAddressId: "email_1", safeIdentifier: "s***@example.com" },
      { strategy: "phone_code", phoneNumberId: "phone_1", safeIdentifier: "+91 ****** 3210" },
      { strategy: "password" },
    ]);

    expect(preferredSecondFactor(options)).toEqual({
      strategy: "email_code",
      label: "Email code",
      destination: "s***@example.com",
      emailAddressId: "email_1",
    });
    expect(secondFactorPrepareParams(options[1]!)).toEqual({
      strategy: "email_code",
      emailAddressId: "email_1",
    });
    expect(secondFactorAttemptParams(options[0]!, " 123456 ")).toEqual({
      strategy: "totp",
      code: "123456",
    });
    expect(canResendSecondFactor(options[1]!)).toBe(true);
    expect(canResendSecondFactor(options[0]!)).toBe(false);
  });
});
