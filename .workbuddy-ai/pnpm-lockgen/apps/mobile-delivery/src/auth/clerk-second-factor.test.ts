import { describe, expect, it } from "vitest";
import {
  canResendSecondFactor,
  preferredSecondFactor,
  secondFactorAttemptParams,
  secondFactorOptions,
  secondFactorPrepareParams,
} from "./clerk-second-factor";

describe("delivery Clerk second-factor helpers", () => {
  it("maps supported factors and prefers an in-app email code", () => {
    const options = secondFactorOptions([
      { strategy: "backup_code" },
      { strategy: "phone_code", phoneNumberId: "phone_1", safeIdentifier: "+91 ****** 3210" },
      { strategy: "email_code", emailAddressId: "email_1", safeIdentifier: "d***@example.com" },
    ]);

    expect(preferredSecondFactor(options)?.strategy).toBe("email_code");
    expect(secondFactorPrepareParams(options[1]!)).toEqual({
      strategy: "phone_code",
      phoneNumberId: "phone_1",
    });
    expect(secondFactorAttemptParams(options[0]!, " backup-123 ")).toEqual({
      strategy: "backup_code",
      code: "backup-123",
    });
    expect(canResendSecondFactor(options[1]!)).toBe(true);
    expect(canResendSecondFactor(options[0]!)).toBe(false);
  });
});
