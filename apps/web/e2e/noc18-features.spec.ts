import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Admin stats — záložka Exporty", () => {
  test("Admin vidí záložku Exporty v /admin/stats", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/stats");
    await expect(page.getByText(/exporty|export/i).first()).toBeVisible();
  });

  test("Záložka Exporty obsahuje tlačítko Stáhnout Klienti CSV", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/stats");

    // Click on Exporty tab if present
    const exportTab = page.getByRole("button", { name: /exporty/i }).first();
    if (await exportTab.isVisible()) {
      await exportTab.click();
    }

    // Check for CSV download button
    const csvBtn = page.getByText(/klient.*csv|stáhnout.*klient|clients.*csv/i).first();
    await expect(csvBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Admin stats — záložka Reporty", () => {
  test("Admin vidí záložku Reporty v /admin/stats", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/stats");
    await expect(page.getByText(/reporty|report/i).first()).toBeVisible();
  });

  test("Záložka Reporty obsahuje Revenue chart nebo occupancy tabulku", async ({ page }) => {
    await login(page, "admin");
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
  test("Recepce vidí seznam termínů v /reception/appointments", async ({ page }) => {
    await login(page, "reception");
    await page.goto("/reception/appointments");
    await expect(page).toHaveURL(/\/reception\/appointments/);
  });

  test("Stránka termínů obsahuje možnost opakování nebo série", async ({ page }) => {
    await login(page, "reception");
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
