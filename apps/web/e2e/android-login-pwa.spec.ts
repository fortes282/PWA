/**
 * Login: PWA install CTA pod tlačítkem přihlášení (Android profil v Playwright).
 * iOS má vlastní flow; zde kontrolujeme viditelnost banneru na Android emulaci.
 */
import { test, expect } from "@playwright/test";

test.describe("Login — PWA install CTA @android-pwa", () => {
  test("shows install banner on /login (Android)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("pwa-install-banner")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("pwa-install-primary")).toBeVisible();
  });
});
