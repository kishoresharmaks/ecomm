import { describe, expect, it } from "vitest";
import {
  base32ToBuffer,
  bufferToBase32,
  decryptMfaSecret,
  encryptMfaSecret,
  generateBase32Secret,
  generateMfaTicket,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpUri,
  hashRecoveryCode,
  verifyMfaTicket,
  verifyRecoveryCode,
  verifyTotpCode,
} from "./admin-mfa";

describe("Admin MFA Cryptography & TOTP Engine", () => {
  it("encodes and decodes Base32 correctly", () => {
    const raw = Buffer.from("Hello 1HandIndia Security!", "utf8");
    const base32 = bufferToBase32(raw);
    expect(typeof base32).toBe("string");
    expect(base32.length).toBeGreaterThan(0);

    const decoded = base32ToBuffer(base32);
    expect(decoded.toString("utf8")).toBe("Hello 1HandIndia Security!");
  });

  it("generates standard Base32 secret of 32 characters", () => {
    const secret = generateBase32Secret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("generates correct otpauth URI for QR codes", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const uri = generateTotpUri("admin@1handindia.com", secret, "1HandIndia");
    expect(uri).toContain("otpauth://totp/1HandIndia:admin%401handindia.com");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=1HandIndia");
    expect(uri).toContain("digits=6");
  });

  it("generates 6-digit numeric TOTP token", () => {
    const secret = generateBase32Secret();
    const token = generateTotpCode(secret);
    expect(token).toMatch(/^\d{6}$/);
  });

  it("verifies TOTP token within current and adjacent time window", () => {
    const secret = generateBase32Secret();
    const now = Date.now();
    const currentToken = generateTotpCode(secret, now);

    // Current token is valid
    expect(verifyTotpCode(currentToken, secret, 1, now)).toBe(true);

    // Token from 25 seconds ago is valid within window
    const pastToken = generateTotpCode(secret, now - 25_000);
    expect(verifyTotpCode(pastToken, secret, 1, now)).toBe(true);

    // Invalid token is rejected
    expect(verifyTotpCode("000000", secret, 1, now)).toBe(false);
    expect(verifyTotpCode("12345", secret, 1, now)).toBe(false);
  });

  it("encrypts and decrypts MFA secret using AES-256-GCM", () => {
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).toContain(":");
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptMfaSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("generates 10 formatted emergency recovery codes and verifies hashes", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);

    for (const code of codes) {
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      const hash = hashRecoveryCode(code);
      expect(verifyRecoveryCode(code, hash)).toBe(true);
      expect(verifyRecoveryCode(code.toLowerCase(), hash)).toBe(true);
      expect(verifyRecoveryCode(code.replace(/-/g, ""), hash)).toBe(true);
      expect(verifyRecoveryCode("WRONG-CODE-0000", hash)).toBe(false);
    }
  });

  it("generates and verifies signed ephemeral MFA challenge tickets", () => {
    const userId = "user-123";
    const credentialId = "cred-456";

    const ticket = generateMfaTicket(userId, credentialId, 300);
    expect(ticket.startsWith("ih_mfa_")).toBe(true);

    const verified = verifyMfaTicket(ticket);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(userId);
    expect(verified?.credentialId).toBe(credentialId);

    // Tampered ticket is rejected
    expect(verifyMfaTicket(ticket + "tamper")).toBeNull();
    expect(verifyMfaTicket("invalid_ticket")).toBeNull();

    // Expired ticket is rejected
    const expiredTicket = generateMfaTicket(userId, credentialId, -10);
    expect(verifyMfaTicket(expiredTicket)).toBeNull();
  });
});

