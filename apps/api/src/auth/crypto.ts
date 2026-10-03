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
