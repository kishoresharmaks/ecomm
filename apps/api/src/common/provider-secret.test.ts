import { afterEach, describe, expect, it } from "vitest";
import { decryptProviderSecret, encryptProviderSecret } from "./provider-secret";

const previousKey = process.env.FX_CREDENTIAL_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.FX_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.FX_CREDENTIAL_ENCRYPTION_KEY = previousKey;
});

describe("provider secret encryption", () => {
  it("round-trips credentials without storing the plaintext", () => {
    process.env.FX_CREDENTIAL_ENCRYPTION_KEY = "test-only-fx-encryption-key-at-least-32-characters";

    const encrypted = encryptProviderSecret("currencyapi-secret");

    expect(encrypted).not.toContain("currencyapi-secret");
    expect(decryptProviderSecret(encrypted)).toBe("currencyapi-secret");
  });
});
