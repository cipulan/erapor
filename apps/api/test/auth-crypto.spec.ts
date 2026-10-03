/** Unit tests for auth crypto helpers (password hashing, session tokens). */
import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../src/auth/crypto";

describe("password hashing (bcrypt)", () => {
  it("hashes and verifies a correct password", async () => {
    const hashed = await hashPassword("guru12345", 4);
    expect(hashed).not.toBe("guru12345");
    expect(await verifyPassword("guru12345", hashed)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hashed = await hashPassword("guru12345", 4);
    expect(await verifyPassword("salah123", hashed)).toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const a = await hashPassword("sama1234", 4);
    const b = await hashPassword("sama1234", 4);
    expect(a).not.toBe(b);
    expect(await verifyPassword("sama1234", a)).toBe(true);
    expect(await verifyPassword("sama1234", b)).toBe(true);
  });
});

describe("session tokens", () => {
  it("generates unique opaque tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));
    expect(tokens.size).toBe(100);
  });

  it("hashes deterministically with SHA-256 hex", () => {
    const token = "fixed-token";
    const expected = createHash("sha256").update(token, "utf8").digest("hex");
    expect(hashSessionToken(token)).toBe(expected);
    expect(hashSessionToken(token)).toHaveLength(64);
  });
});
