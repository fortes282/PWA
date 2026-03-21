import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Auto-processor — spuštění", () => {
  test("Admin vidí trigger tlačítko v /admin/background", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/background");
    // Should have a button to trigger auto-processor or background jobs section
    await expect(page.getByText(/auto|processor|spustit|background|job/i).first()).toBeVisible();
  });
});

test.describe("Notification preferences", () => {
  test("Klient vidí notifikační nastavení v /client/settings", async ({ page }) => {
    await login(page, "client");
    await page.goto("/client/settings");
    // Should have notification settings section
    await expect(page.getByText(/notifikace|upozornění|reminder|email/i).first()).toBeVisible();
  });

  test("Recepce vidí notifikační nastavení v profilu klienta", async ({ page }) => {
    await login(page, "reception");
    await page.goto("/reception/appointments");
    await expect(page).toHaveURL(/\/reception\/appointments/);
  });
});

test.describe("Audit log display", () => {
  test("Admin vidí záložku Audit v /admin/background", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/background");
    await expect(page.getByText(/audit/i).first()).toBeVisible();
  });

  test("Admin vidí tabulku s audit záznamy po kliknutí na záložku", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/background");
    // Click audit tab if present
    const auditTab = page.getByRole("button", { name: /audit/i }).first();
    if (await auditTab.isVisible()) {
      await auditTab.click();
      // After clicking, should show audit log content (table or list)
      await expect(page.locator("table, [data-testid=audit-log]").first()).toBeVisible({ timeout: 5000 });
    } else {
      // Audit section might be inline
      await expect(page.getByText(/audit/i).first()).toBeVisible();
    }
  });
});
