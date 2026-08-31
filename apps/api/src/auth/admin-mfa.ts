import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const RFC4648_BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // excludes 0, 1, I, O for readability
const MFA_TICKET_PREFIX = "ih_mfa_";

function getMasterMfaKey(customKey?: string): Buffer {
  const rawKey =
    customKey ||
    process.env.ADMIN_MFA_SECRET_KEY ||
    process.env.SESSION_SECRET ||
    process.env.DATABASE_URL ||
    "indihub-default-admin-mfa-encryption-key-2026";

  return createHash("sha256").update(rawKey).digest();
}

/**
 * Base32 encoding for byte buffers (RFC 4648)
 */
export function bufferToBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;

    while (bits >= 5) {
      output += RFC4648_BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += RFC4648_BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 decoding into Buffer (RFC 4648)
 */
export function base32ToBuffer(base32: string): Buffer {
  const sanitized = base32.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i]!;
    const charIndex = RFC4648_BASE32_ALPHABET.indexOf(char);
    if (charIndex === -1) {
      continue;
    }

    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a random Base32 secret for TOTP enrollment
 */
export function generateBase32Secret(byteLength = 20): string {
  const randomBuf = randomBytes(byteLength);
  return bufferToBase32(randomBuf);
}

/**
 * Formats standard otpauth:// URI for authenticator QR codes
 */
export function generateTotpUri(accountEmail: string, secret: string, issuer = "1HandIndia"): string {
  const cleanIssuer = encodeURIComponent(issuer);
  const cleanEmail = encodeURIComponent(accountEmail.trim().toLowerCase());
  const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();

  return `otpauth://totp/${cleanIssuer}:${cleanEmail}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Computes the 6-digit TOTP code for a given timestamp according to RFC 6238
 */
export function generateTotpCode(secret: string, timestampMs = Date.now(), stepSeconds = 30, digits = 6): string {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);

  const secretBuffer = base32ToBuffer(secret);
  const hmac = createHmac("sha1", secretBuffer).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binaryCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const token = (binaryCode % 10 ** digits).toString().padStart(digits, "0");
  return token;
}

/**
 * Verifies a TOTP code with time-step drift tolerance (default ±1 step = ±30 seconds)
 */
export function verifyTotpCode(
  inputCode: string,
  secret: string,
  windowSteps = 1,
  timestampMs = Date.now(),
  stepSeconds = 30,
): boolean {
  const sanitizedInput = inputCode.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(sanitizedInput)) {
    return false;
  }

  const inputBuffer = Buffer.from(sanitizedInput, "utf8");

  for (let step = -windowSteps; step <= windowSteps; step++) {
    const checkTime = timestampMs + step * stepSeconds * 1000;
    const expectedCode = generateTotpCode(secret, checkTime, stepSeconds, 6);
    const expectedBuffer = Buffer.from(expectedCode, "utf8");

    if (inputBuffer.length === expectedBuffer.length && timingSafeEqual(inputBuffer, expectedBuffer)) {
      return true;
    }
  }

  return false;
}

/**
 * Encrypts a TOTP secret before storing in database using AES-256-GCM
 */
export function encryptMfaSecret(secret: string, customKey?: string): string {
  const masterKey = getMasterMfaKey(customKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret from database
 */
export function decryptMfaSecret(encryptedPayload: string, customKey?: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted MFA secret format.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
  const masterKey = getMasterMfaKey(customKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Generates N emergency single-use backup recovery codes (e.g. XXXX-XXXX-XXXX)
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(12);
    let raw = "";
    for (let b = 0; b < bytes.length; b++) {
      raw += RECOVERY_CODE_CHARS[bytes[b]! % RECOVERY_CODE_CHARS.length];
    }
    // Format as XXXX-XXXX-XXXX
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    codes.push(formatted);
  }

  return codes;
}

/**
 * Normalizes and hashes a recovery code for database storage
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Verifies an input recovery code against a stored SHA-256 hash
 */
export function verifyRecoveryCode(inputCode: string, storedHash: string): boolean {
  const computedHash = hashRecoveryCode(inputCode);
  const inputBuffer = Buffer.from(computedHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, storedBuffer);
}

type MfaTicketPayload = {
  userId: string;
  credentialId: string;
  exp: number;
  nonce: string;
};

/**
 * Generates an ephemeral HMAC-signed challenge ticket for the 2-step login flow (5-minute TTL)
 */
export function generateMfaTicket(userId: string, credentialId: string, ttlSeconds = 300, customKey?: string): string {
  const masterKey = getMasterMfaKey(customKey);
  const payload: MfaTicketPayload = {
    userId,
    credentialId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: randomBytes(8).toString("hex"),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", masterKey).update(payloadB64).digest("base64url");

  return `${MFA_TICKET_PREFIX}${payloadB64}.${signature}`;
}

/**
 * Verifies an ephemeral MFA challenge ticket
 */
export function verifyMfaTicket(
  ticket: string,
  customKey?: string,
): { userId: string; credentialId: string } | null {
  if (!ticket || typeof ticket !== "string" || !ticket.startsWith(MFA_TICKET_PREFIX)) {
    return null;
  }

  const raw = ticket.slice(MFA_TICKET_PREFIX.length);
  const dotIndex = raw.indexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const payloadB64 = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);

  const masterKey = getMasterMfaKey(customKey);
  const expectedSignature = createHmac("sha256", masterKey).update(payloadB64).digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as MfaTicketPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      return null;
    }

    return {
      userId: payload.userId,
      credentialId: payload.credentialId,
    };
  } catch {
    return null;
  }
}
