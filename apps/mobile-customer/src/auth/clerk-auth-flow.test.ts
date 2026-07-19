import { describe, expect, it } from "vitest";
import {
  normalizePhoneIdentifier,
  resetPasswordStrategy,
  secondFactorAttemptParams,
  secondFactorOptions,
  secondFactorPrepareParams,
  validateIdentifier,
} from "./clerk-auth-flow";

describe("mobile Clerk auth flow helpers", () => {
  it("normalizes Indian phone numbers to Clerk E.164 identifiers", () => {
    expect(normalizePhoneIdentifier("98765 43210")).toBe("+919876543210");
    expect(normalizePhoneIdentifier("+91 98765-43210")).toBe("+919876543210");
  });

  it("validates email and phone identifiers", () => {
    expect(validateIdentifier("email", "buyer@1handindia.com")).toBeNull();
    expect(validateIdentifier("phone", "+919876543210")).toBeNull();
    expect(validateIdentifier("phone", "98765")).toBe("Enter a valid phone number with country code.");
  });

  it("uses the matching reset strategy", () => {
    expect(resetPasswordStrategy("email")).toBe("reset_password_email_code");
    expect(resetPasswordStrategy("phone")).toBe("reset_password_phone_code");
  });

  it("maps Clerk second factors into selectable verification options", () => {
    const options = secondFactorOptions([
      { strategy: "phone_code", phoneNumberId: "phone_1", safeIdentifier: "+91 ****** 3210" },
      { strategy: "totp" },
      { strategy: "password" },
    ]);

    expect(options).toEqual([
      {
        strategy: "phone_code",
        label: "Text message",
        destination: "+91 ****** 3210",
        phoneNumberId: "phone_1",
      },
      { strategy: "totp", label: "Authenticator app" },
    ]);
    expect(secondFactorPrepareParams(options[0]!)).toEqual({ strategy: "phone_code", phoneNumberId: "phone_1" });
    expect(secondFactorAttemptParams(options[1]!, " 123456 ")).toEqual({ strategy: "totp", code: "123456" });
  });
});
