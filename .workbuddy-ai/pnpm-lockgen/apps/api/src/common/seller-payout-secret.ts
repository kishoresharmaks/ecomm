import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";

const version = "v1";

function encryptionKey() {
  const source = process.env.SELLER_PAYOUT_DATA_ENCRYPTION_KEY?.trim();
  if (!source || source.length < 32) {
    throw new ServiceUnavailableException(
      "Seller payout encryption is not configured. Set SELLER_PAYOUT_DATA_ENCRYPTION_KEY.",
    );
  }
  return createHash("sha256").update(source).digest();
}

export function encryptSellerPayoutValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    version,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSellerPayoutValue(encrypted: string | null | undefined) {
  if (!encrypted) {
    return null;
  }
  const [storedVersion, ivValue, authTagValue, encryptedValue] = encrypted.split(".");
  if (storedVersion !== version || !ivValue || !authTagValue || !encryptedValue) {
    throw new ServiceUnavailableException("Stored seller payout data is invalid.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ServiceUnavailableException("Stored seller payout data could not be decrypted.");
  }
}

export function sellerPayoutValue(
  encrypted: string | null | undefined,
  legacyPlaintext: string | null | undefined,
) {
  return decryptSellerPayoutValue(encrypted) ?? legacyPlaintext?.trim() ?? null;
}

export function sellerPayoutLast4(value: string | null) {
  return value ? value.slice(-4) : null;
}

export function sellerPayoutUpiHint(value: string | null) {
  if (!value) {
    return null;
  }
  const [handle, provider] = value.split("@");
  const maskedHandle = handle ? `${handle.slice(0, 2)}***` : "***";
  return provider ? `${maskedHandle}@${provider}` : maskedHandle;
}
