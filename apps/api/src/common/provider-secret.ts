import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";

const version = "v1";

function encryptionKey() {
  const source = process.env.FX_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!source || source.length < 32) {
    throw new ServiceUnavailableException(
      "FX credential encryption is not configured. Set FX_CREDENTIAL_ENCRYPTION_KEY.",
    );
  }
  return createHash("sha256").update(source).digest();
}

export function encryptProviderSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [version, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptProviderSecret(value: string) {
  const [storedVersion, ivValue, authTagValue, encryptedValue] = value.split(".");
  if (storedVersion !== version || !ivValue || !authTagValue || !encryptedValue) {
    throw new ServiceUnavailableException("Stored FX provider credential is invalid.");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ServiceUnavailableException("Stored FX provider credential could not be decrypted.");
  }
}
