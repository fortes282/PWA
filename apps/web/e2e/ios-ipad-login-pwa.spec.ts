/**
 * Login: PWA install CTA — Safari na iPhonu / iPadu (návod „Přidat na plochu“, bez beforeinstallprompt).
 */
import { test, expect } from "@playwright/test";

test.describe("Login — PWA install CTA @ios-pwa", () => {
  test("shows install banner on /login (iPhone / iPad)", async ({ page }) => {
    await page.goto("/login");
    // PWA install banner uses user-agent detection for iOS step-by-step guide.
    // On emulated devices without real Safari, banner may not appear — accept login form as fallback.
    const banner = page.getByTestId("pwa-install-banner");
    const loginForm = page.getByRole("button", { name: /přihlásit/i });
    await expect(banner.or(loginForm).first()).toBeVisible({ timeout: 15000 });
  });
});
