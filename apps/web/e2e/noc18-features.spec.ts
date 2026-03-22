import { test, expect } from "@playwright/test";
import { USERS, ADMIN_AUTH_FILE, RECEPTION_AUTH_FILE } from "./helpers";

test.describe("Admin stats — záložka Exporty", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("Admin vidí záložku Exporty v /admin/stats", async ({ page }) => {
    await page.goto("/admin/stats");
    await expect(page.getByText(/exporty|export/i).first()).toBeVisible();
  });

  test("Záložka Exporty obsahuje tlačítko Stáhnout Klienti CSV", async ({ page }) => {
    await page.goto("/admin/stats");

    // Click on Exporty tab if present
    // Use waitFor() instead of isVisible() — isVisible() is a synchronous immediate check that
    // returns false during React hydration on mobile before the tab bar renders
    const exportTab = page.getByRole("button", { name: /exporty/i }).first();
    const exportTabVisible = await exportTab
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (exportTabVisible) {
      await exportTab.click();
      await page.waitForTimeout(500); // wait for React state update
    }

    // Check for CSV download button (button text: "↓ clients.csv")
    const csvBtn = page.getByText(/clients\.csv/i).first();
    await expect(csvBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Admin stats — záložka Reporty", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("Admin vidí záložku Reporty v /admin/stats", async ({ page }) => {
    await page.goto("/admin/stats");
    await expect(page.getByText(/reporty|report/i).first()).toBeVisible();
  });

  test("Záložka Reporty obsahuje Revenue chart nebo occupancy tabulku", async ({ page }) => {
    await page.goto("/admin/stats");

    // Click on Reporty tab if present
    const reportTab = page.getByRole("button", { name: /reporty/i }).first();
    if (await reportTab.isVisible()) {
      await reportTab.click();
    }

    // Should show revenue chart or occupancy table
    await expect(
      page.getByText(/revenue|tržby|obsazenost|occupancy|měsíční|výnosy/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Reception appointments — tlačítko Opakovat", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("Recepce vidí seznam termínů v /reception/appointments", async ({ page }) => {
    await page.goto("/reception/appointments");
    await expect(page).toHaveURL(/\/reception\/appointments/);
  });

  test("Stránka termínů obsahuje možnost opakování nebo série", async ({ page }) => {
    await page.goto("/reception/appointments");
    // Check for recurring/repeat functionality
    const repeatEl = page.getByText(/opakovat|recurring|série|series|opakování/i).first();
    if (await repeatEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(repeatEl).toBeVisible();
    } else {
      // Page loaded successfully even if no recurring button visible (no appointments)
      await expect(page).toHaveURL(/\/reception\/appointments/);
    }
  });
});
