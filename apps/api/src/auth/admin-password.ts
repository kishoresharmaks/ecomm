import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashAdminPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = (await scrypt(password, salt, keyLength)) as Buffer;
  return {
    hash: hash.toString("hex"),
    salt
  };
}

export async function verifyAdminPassword(password: string, salt: string, expectedHash: string) {
  const actual = (await scrypt(password, salt, keyLength)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
