/**
 * E2E: Password reset flow
 * Tests: forgot-password page, reset-password page with invalid token
 */
import { test, expect } from "@playwright/test";

test.describe("Password Reset — forgot-password page", () => {
  test("forgot-password page loads correctly", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /reset hesla/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /odeslat/i })).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
  });

  test("forgot-password has back to login link", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    const backLink = page.getByRole("link", { name: /zpět na přihlášení/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page has forgot password link", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const forgotLink = page.getByRole("link", { name: /zapomněli jste heslo/i });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("submitting email shows success message (anti-enumeration)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/e-mail/i).fill("nonexistent@test.cz");
    await page.getByRole("button", { name: /odeslat/i }).click();
    await page.waitForLoadState("networkidle");

    // Should always show success message regardless of user existence
    await expect(page.getByText(/e-mail odeslán|pokud účet/i)).toBeVisible();
  });
});

test.describe("Password Reset — reset-password page", () => {
  test("reset-password page with invalid token shows error", async ({ page }) => {
    await page.goto("/reset-password?token=invalidtoken123");
    await page.waitForLoadState("networkidle");

    // Should show "invalid link" message after validating
    await expect(page.getByText(/není platný|neplatný|vypršel/i)).toBeVisible({ timeout: 5000 });
  });

  test("reset-password page without token shows invalid", async ({ page }) => {
    await page.goto("/reset-password");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/není platný|neplatný/i)).toBeVisible({ timeout: 5000 });
  });

  test("reset-password has link to request new reset", async ({ page }) => {
    await page.goto("/reset-password?token=badtoken");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: /požádat o nový odkaz/i })).toBeVisible({ timeout: 5000 });
  });
});
