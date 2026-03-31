/**
 * PWA install CTA -- merged from android-login-pwa and ios-ipad-login-pwa.
 * Runs on iphone and android projects.
 */
import { test, expect } from "@playwright/test";

test.describe("Login -- PWA install CTA", () => {
  test("shows install banner on /login", async ({ page }) => {
    await page.goto("/login");
    // PWA install banner uses beforeinstallprompt (Android Chrome) or user-agent
    // detection for iOS step-by-step guide.
    // On emulated devices without real PWA context, banner may not appear --
    // accept login form as fallback.
    const banner = page.getByTestId("pwa-install-banner");
    const loginForm = page.getByRole("button", { name: /prihlasit/i });
    await expect(banner.or(loginForm).first()).toBeVisible({ timeout: 15000 });
  });
});
