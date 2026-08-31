import { describe, expect, it } from "vitest";
import type { AdminLoginResult } from "./admin-auth-context";

describe("Admin MFA Web UI Logic", () => {
  it("determines if login response requires MFA challenge step", () => {
    const directLogin: AdminLoginResult = {
      mfaRequired: false,
      expiresAt: "2026-09-01T00:00:00.000Z",
      user: {
        id: "admin-1",
        email: "admin@1handindia.com",
        roles: ["ADMIN"],
      },
    };

    const mfaLogin: AdminLoginResult = {
      mfaRequired: true,
      mfaTicket: "ih_mfa_eyJhbGciOi...",
      mfaType: "TOTP",
    };

    expect(directLogin.mfaRequired).toBe(false);
    expect(mfaLogin.mfaRequired).toBe(true);
    if (mfaLogin.mfaRequired) {
      expect(mfaLogin.mfaTicket).toMatch(/^ih_mfa_/);
      expect(mfaLogin.mfaType).toBe("TOTP");
    }
  });

  it("normalizes TOTP code input for verification", () => {
    function sanitizeTotpInput(input: string): string {
      return input.replace(/\D/g, "").slice(0, 6);
    }

    expect(sanitizeTotpInput("123 456")).toBe("123456");
    expect(sanitizeTotpInput("  987654  ")).toBe("987654");
    expect(sanitizeTotpInput("12a3b4c5d6e")).toBe("123456");
    expect(sanitizeTotpInput("1234567890")).toBe("123456");
  });

  it("formats emergency recovery codes with copy payload", () => {
    const rawCodes = [
      "4F8K-9L2P-7Q1M",
      "8H3X-5N9T-2W4Y",
      "6J1V-8C4R-9K2D",
    ];

    function buildRecoveryCodeClipboardText(codes: string[]): string {
      return `1HandIndia Emergency Recovery Codes:\n${codes.join("\n")}\n\nKeep these codes in a secure, private location.`;
    }

    const clipboardText = buildRecoveryCodeClipboardText(rawCodes);
    expect(clipboardText).toContain("1HandIndia Emergency Recovery Codes:");
    expect(clipboardText).toContain("4F8K-9L2P-7Q1M");
    expect(clipboardText).toContain("8H3X-5N9T-2W4Y");
    expect(clipboardText).toContain("6J1V-8C4R-9K2D");
  });

  it("normalizes recovery code inputs before verification", () => {
    function normalizeRecoveryCode(code: string): string {
      return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    expect(normalizeRecoveryCode("4f8k-9l2p-7q1m")).toBe("4F8K9L2P7Q1M");
    expect(normalizeRecoveryCode("4F8K 9L2P 7Q1M")).toBe("4F8K9L2P7Q1M");
    expect(normalizeRecoveryCode("  4f8k9l2p7q1m  ")).toBe("4F8K9L2P7Q1M");
  });
});
