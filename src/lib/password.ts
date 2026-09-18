import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedKey] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !encodedKey) return false;

  const expectedKey = Buffer.from(encodedKey, "hex");
  if (expectedKey.length !== KEY_LENGTH) return false;

  const actualKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(expectedKey, actualKey);
}
