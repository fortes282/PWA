import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isLegacyHash, validatePasswordStrength } from "../utils/hash.js";
import { createHash, randomBytes } from "crypto";

describe("scrypt password hashing", () => {
  it("hashes and verifies password correctly", () => {
    const hash = hashPassword("TestPass123!");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword("TestPass123!", hash)).toBe(true);
    expect(verifyPassword("WrongPass", hash)).toBe(false);
  });

  it("generates unique hashes for same password", () => {
    const h1 = hashPassword("SamePass1");
    const h2 = hashPassword("SamePass1");
    expect(h1).not.toBe(h2); // Different salts
    expect(verifyPassword("SamePass1", h1)).toBe(true);
    expect(verifyPassword("SamePass1", h2)).toBe(true);
  });

  it("supports legacy SHA-256 hashes", () => {
    const password = "Legacy123!";
    const salt = randomBytes(16).toString("hex");
    const hash = createHash("sha256").update(password + salt).digest("hex");
    const stored = `${salt}:${hash}`;

    expect(isLegacyHash(stored)).toBe(true);
    expect(verifyPassword(password, stored)).toBe(true);
    expect(verifyPassword("WrongPass", stored)).toBe(false);
  });

  it("identifies scrypt vs legacy hashes", () => {
    const scryptHash = hashPassword("Test123!");
    expect(isLegacyHash(scryptHash)).toBe(false);
    expect(isLegacyHash("abc123:def456")).toBe(true);
  });
});

describe("password strength validation", () => {
  it("rejects short passwords", () => {
    expect(validatePasswordStrength("Ab1")).not.toBeNull();
    expect(validatePasswordStrength("Short1")).not.toBeNull();
  });

  it("rejects passwords without uppercase", () => {
    expect(validatePasswordStrength("lowercase123")).not.toBeNull();
  });

  it("rejects passwords without lowercase", () => {
    expect(validatePasswordStrength("UPPERCASE123")).not.toBeNull();
  });

  it("rejects passwords without digit", () => {
    expect(validatePasswordStrength("NoDigitsHere")).not.toBeNull();
  });

  it("accepts valid passwords", () => {
    expect(validatePasswordStrength("ValidPass1")).toBeNull();
    expect(validatePasswordStrength("Admin123!")).toBeNull();
    expect(validatePasswordStrength("Klient123!")).toBeNull();
  });
});
