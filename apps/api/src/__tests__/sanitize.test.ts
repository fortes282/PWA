import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  sanitizeText,
  sanitizeMultiline,
  clampPagination,
  normalizeEmail,
  sanitizePhone,
} from "../utils/sanitize.js";

describe("sanitize utilities", () => {
  describe("escapeHtml", () => {
    it("escapes HTML special characters", () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
      );
    });

    it("escapes ampersands and quotes", () => {
      expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#x27;s");
    });

    it("returns safe strings unchanged", () => {
      expect(escapeHtml("Hello world")).toBe("Hello world");
    });
  });

  describe("sanitizeText", () => {
    it("trims and collapses whitespace", () => {
      expect(sanitizeText("  hello   world  ")).toBe("hello world");
    });

    it("escapes HTML and trims", () => {
      expect(sanitizeText("  <b>bold</b>  ")).toBe("&lt;b&gt;bold&lt;/b&gt;");
    });
  });

  describe("sanitizeMultiline", () => {
    it("preserves newlines but limits consecutive", () => {
      expect(sanitizeMultiline("line1\n\n\n\nline2")).toBe("line1\n\nline2");
    });

    it("collapses horizontal whitespace", () => {
      expect(sanitizeMultiline("hello   world\nnext   line")).toBe(
        "hello world\nnext line"
      );
    });
  });

  describe("clampPagination", () => {
    it("returns default for undefined", () => {
      expect(clampPagination(undefined, 20, 100)).toBe(20);
    });

    it("clamps to max", () => {
      expect(clampPagination(500, 20, 100)).toBe(100);
    });

    it("clamps to minimum of 1", () => {
      expect(clampPagination(-5, 20, 100)).toBe(1);
    });

    it("floors decimals", () => {
      expect(clampPagination(50.7, 20, 100)).toBe(50);
    });
  });

  describe("normalizeEmail", () => {
    it("lowercases and trims valid email", () => {
      expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    });

    it("returns null for invalid email", () => {
      expect(normalizeEmail("not-an-email")).toBeNull();
      expect(normalizeEmail("@missing.local")).toBeNull();
      expect(normalizeEmail("")).toBeNull();
    });
  });

  describe("sanitizePhone", () => {
    it("keeps digits, +, and formatting characters", () => {
      expect(sanitizePhone("+420 123 456 789")).toBe("+420 123 456 789");
    });

    it("strips non-phone characters", () => {
      expect(sanitizePhone("+420abc123")).toBe("+420123");
    });
  });
});
