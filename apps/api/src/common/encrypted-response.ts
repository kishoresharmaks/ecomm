import { createCipheriv, createHash, randomBytes } from "crypto";

const responseEncryptionAlgorithm = "A256GCM" as const;
const responseEncryptionContext = "indihub-response-v1";

export type EncryptedResponseEnvelope = {
  encrypted: true;
  alg: typeof responseEncryptionAlgorithm;
  iv: string;
  tag: string;
  data: string;
};

export function encryptForBearerSession<T>(
  authorizationHeader: string | undefined,
  payload: T,
  acceptedEncryptionHeader?: string | string[],
): T | EncryptedResponseEnvelope {
  if (!acceptsEncryptedResponse(acceptedEncryptionHeader)) {
    return payload;
  }

  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearerToken) {
    return payload;
  }

  const key = createHash("sha256").update(`${responseEncryptionContext}:${bearerToken}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return {
    encrypted: true,
    alg: responseEncryptionAlgorithm,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function acceptsEncryptedResponse(header?: string | string[]) {
  const value = Array.isArray(header) ? header.join(",") : header;
  return Boolean(
    value
      ?.split(",")
      .map((item) => item.trim().toUpperCase())
      .some((item) => item === responseEncryptionAlgorithm || item === "TRUE" || item === "1"),
  );
}
