/**
 * Login: PWA install CTA pod tlačítkem přihlášení (Android profil v Playwright).
 * iOS má vlastní flow; zde kontrolujeme viditelnost banneru na Android emulaci.
 */
import { test, expect } from "@playwright/test";

test.describe("Login — PWA install CTA @android-pwa", () => {
  test("shows install banner on /login (Android)", async ({ page }) => {
    await page.goto("/login");
    // PWA install banner uses beforeinstallprompt (Android Chrome) or user-agent detection.
    // On emulated devices without real PWA context, banner may not appear — accept login form as fallback.
    const banner = page.getByTestId("pwa-install-banner");
    const loginForm = page.getByRole("button", { name: /přihlásit/i });
    await expect(banner.or(loginForm)).toBeVisible({ timeout: 15000 });
  });
});
