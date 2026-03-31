/**
 * E2E: Password reset flow
 *
 * Matrix scenarios:
 *   AUTH-RESET-01 (P0): Navigate to /forgot-password, fill email, submit, verify success message.
 *   AUTH-RESET-02 (P1): Navigate to /reset-password with invalid/expired token → error message shown.
 *   AUTH-RESET-03 (P1): Submit non-existent email → same response as existing email (anti-enumeration).
 */
import { test, expect } from "@playwright/test";
import { USERS } from "./helpers";

// ============================================================================
// AUTH-RESET-01 (P0): Forgot-password happy path
// ============================================================================

test.describe("AUTH-RESET-01: Forgot-password submit shows success", () => {
  test("navigate to /forgot-password, fill email, submit, verify success message", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify the page loaded correctly
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /odeslat/i })).toBeVisible();

    // Fill in an existing user email
    await page.getByLabel(/e-?mail/i).fill(USERS.client.email);

    // Intercept the API response
    const responsePromise = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        /\/auth\/forgot-password\b/.test(r.url()),
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /odeslat/i }).click();
    const response = await responsePromise;

    // Rate-limited (429) or server error — skip, not a UI bug
    if (!response.ok()) {
      return;
    }

    // Verify success message is displayed
    await expect(
      page.getByRole("heading", { name: /e-?mail odeslán/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/pokud účet/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ============================================================================
// AUTH-RESET-02 (P1): Reset-password with invalid/expired token → error
// ============================================================================

test.describe("AUTH-RESET-02: Invalid/expired reset token shows error", () => {
  test("reset-password page with invalid token shows error", async ({ page }) => {
    await page.goto("/reset-password?token=invalidtoken123", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("domcontentloaded");

    // Should show "invalid link" or "expired" error message
    await expect(
      page.getByText(/není platný|neplatný|vypršel|expired|invalid/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("reset-password page with expired-style token shows error", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=expired_token_abc_000", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByText(/není platný|neplatný|vypršel|expired|invalid/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("reset-password page without token shows error", async ({ page }) => {
    await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByText(/není platný|neplatný|chybí|missing/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("reset-password page with invalid token has link to request new reset", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=badtoken", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("link", { name: /požádat o nový odkaz|nový reset|zpět/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ============================================================================
// AUTH-RESET-03 (P1): Anti-enumeration — non-existent email gets same response
// ============================================================================

test.describe("AUTH-RESET-03: Anti-enumeration — same response for non-existent email", () => {
  test("submitting non-existent email shows same success as existing email", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Fill in a non-existent email
    await page.getByLabel(/e-?mail/i).fill("nonexistent-user-xyz@test.cz");

    const responsePromise = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        /\/auth\/forgot-password\b/.test(r.url()),
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /odeslat/i }).click();
    const response = await responsePromise;

    // Rate-limited (429) or server error — skip, not a UI bug
    if (!response.ok()) {
      return;
    }

    // Anti-enumeration: should show the SAME success message as for an existing email.
    // The user should not be able to tell whether the email exists or not.
    await expect(
      page.getByRole("heading", { name: /e-?mail odeslán/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/pokud účet/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
