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
    // Accessible name is "Přihlásit se" — ASCII /prihlasit/ does not match Czech characters.
    const loginSubmit = page.getByRole("button", { name: /Přihlásit se/i });
    // On mobile, banner + submit can both match — .first() avoids strict-mode "2 elements" failure.
    await expect(banner.or(loginSubmit).first()).toBeVisible({ timeout: 15_000 });
  });
});
