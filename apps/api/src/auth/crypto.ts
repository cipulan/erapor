import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";

/** bcrypt cost factor; configurable via BCRYPT_ROUNDS. */
export async function hashPassword(password: string, rounds: number): Promise<string> {
  return hash(password, rounds);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash) return false;
  return compare(password, passwordHash);
}

/** Generates a cryptographically random opaque session token (never stored raw). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest of the token — this is what the sessions table stores. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Generates a random alphanumeric password. Ambiguous characters
 * (0/O, 1/l/I) are excluded so it stays readable when shared.
 * Minimum length 8 to satisfy the password policy.
 */
export function generatePassword(length = 12): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const len = Math.max(8, Math.floor(length) || 12);
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
