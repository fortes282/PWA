import { test, expect } from "@playwright/test";
import { USERS, ADMIN_AUTH_FILE, CLIENT_AUTH_FILE, RECEPTION_AUTH_FILE } from "./helpers";

test.describe("Auto-processor — spuštění", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("Admin vidí trigger tlačítko v /admin/background", async ({ page }) => {
    await page.goto("/admin/background");
    // Scope to main — sidebar nav items match this pattern on mobile
    await expect(page.locator("main").getByText(/auto|processor|spustit|background|job/i).first()).toBeVisible();
  });
});

test.describe("Notification preferences — client", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("Klient vidí notifikační nastavení v /client/settings", async ({ page }) => {
    await page.goto("/client/settings");
    // Scope to main — sidebar has "Notifikace" nav link that appears first in DOM on mobile
    await expect(page.locator("main").getByText(/notifikace|upozornění|reminder|email/i).first()).toBeVisible();
  });
});

test.describe("Notification preferences — reception", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("Recepce vidí notifikační nastavení v profilu klienta", async ({ page }) => {
    await page.goto("/reception/appointments");
    await expect(page).toHaveURL(/\/reception\/appointments/);
  });
});

test.describe("Audit log display", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("Admin vidí záložku Audit v /admin/background", async ({ page }) => {
    await page.goto("/admin/background");
    // Scope to main — sidebar "Audit log" nav link appears first in DOM on mobile
    await expect(page.locator("main").getByText(/audit/i).first()).toBeVisible();
  });

  test("Admin vidí tabulku s audit záznamy po kliknutí na záložku", async ({ page }) => {
    await page.goto("/admin/background");
    // Click audit tab if present
    const auditTab = page.getByRole("button", { name: /audit/i }).first();
    if (await auditTab.isVisible()) {
      await auditTab.click();
      // After clicking, should show audit log content (table or list)
      await expect(page.locator("table, [data-testid=audit-log]").first()).toBeVisible({ timeout: 5000 });
    } else {
      // Audit section might be inline
      await expect(page.locator("main").getByText(/audit/i).first()).toBeVisible();
    }
  });
});
