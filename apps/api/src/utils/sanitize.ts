/**
 * Input sanitization utilities for user-supplied text.
 * Prevents XSS and cleans up whitespace.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] || ch);
}

/**
 * Sanitize a free-text string: trim whitespace, collapse consecutive whitespace,
 * and escape HTML entities.
 */
export function sanitizeText(input: string): string {
  return escapeHtml(input.trim().replace(/\s+/g, " "));
}

/**
 * Sanitize text but allow newlines (for multiline fields like notes, descriptions).
 */
export function sanitizeMultiline(input: string): string {
  return escapeHtml(
    input
      .trim()
      .replace(/[^\S\n]+/g, " ") // collapse horizontal whitespace
      .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
  );
}

/**
 * Clamp a numeric pagination parameter to safe bounds.
 */
export function clampPagination(value: number | undefined, defaultVal: number, max: number): number {
  if (value === undefined || value === null || isNaN(value)) return defaultVal;
  return Math.max(1, Math.min(Math.floor(value), max));
}

/**
 * Validate and normalize an email address (lowercase, trimmed).
 * Returns null if invalid.
 */
export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  // Basic RFC 5322 pattern — not exhaustive but catches most issues
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

/**
 * Sanitize a phone number: keep only digits, +, and leading spaces.
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+\s()-]/g, "").trim();
}
