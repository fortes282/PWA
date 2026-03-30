/**
 * Login: PWA install CTA — Safari na iPhonu / iPadu (návod „Přidat na plochu“, bez beforeinstallprompt).
 */
import { test, expect } from "@playwright/test";

test.describe("Login — PWA install CTA @ios-pwa", () => {
  test("shows install banner on /login (iPhone / iPad)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("pwa-install-banner")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("pwa-install-primary")).toBeVisible();
  });
});
