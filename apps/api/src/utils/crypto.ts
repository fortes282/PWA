/**
 * AES-256-GCM encryption/decryption for sensitive health record fields.
 * Key is loaded from HEALTH_DATA_ENCRYPTION_KEY env var (hex-encoded 32 bytes).
 * Falls back to a deterministic dev key if not set (dev/test only).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const envKey = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, "hex");
    if (buf.length !== 32) {
      throw new Error("HEALTH_DATA_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)");
    }
    return buf;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("HEALTH_DATA_ENCRYPTION_KEY is required in production");
  }
  // Dev/test fallback — deterministic, NOT for production
  return Buffer.from("4a8e6f2d1b9c3a7e5f4d2c1b8a7e6f3d4a8e6f2d1b9c3a7e5f4d2c1b8a7e6f3d", "hex");
}

const PREFIX = "enc:v1:";

/**
 * Encrypt a plaintext string. Returns a prefixed base64 string.
 * Returns null if input is null/undefined.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  try {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv(12) + tag(16) + ciphertext, base64-encoded
    const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
    return PREFIX + payload;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    // Dev/test graceful degradation only
    return plaintext;
  }
}

/**
 * Decrypt a previously encrypted string. If input doesn't start with prefix, returns as-is.
 * Returns null if input is null/undefined.
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // not encrypted (legacy data)
  try {
    const key = getKey();
    const payload = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    return ciphertext; // graceful fallback — return raw if decryption fails
  }
}
