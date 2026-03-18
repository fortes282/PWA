import { createHash, scryptSync, randomBytes, timingSafeEqual } from "crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELISM = 1; // p

/**
 * Hash a password using scrypt (Node.js native, no external deps).
 * Format: scrypt:<salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
  }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 * Supports both legacy sha256 (salt:hash) and new scrypt (scrypt:salt:hash) formats.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    return verifyScrypt(password, stored);
  }
  // Legacy SHA-256 format: salt:hash
  return verifyLegacySha256(password, stored);
}

function verifyScrypt(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash) return false;
  try {
    const candidate = scryptSync(password, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELISM,
    }).toString("hex");
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
  } catch {
    return false;
  }
}

function verifyLegacySha256(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = createHash("sha256").update(password + salt).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
  } catch {
    return false;
  }
}

/**
 * Check if a stored hash uses the legacy SHA-256 format.
 * Used to detect hashes that should be re-hashed on next login.
 */
export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith("scrypt:");
}

/**
 * Validate password strength.
 * Returns null if valid, or error message string.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Heslo musí mít alespoň 8 znaků";
  if (!/[A-Z]/.test(password)) return "Heslo musí obsahovat alespoň jedno velké písmeno";
  if (!/[a-z]/.test(password)) return "Heslo musí obsahovat alespoň jedno malé písmeno";
  if (!/[0-9]/.test(password)) return "Heslo musí obsahovat alespoň jednu číslici";
  return null;
}
