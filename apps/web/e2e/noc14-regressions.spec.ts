/**
 * E2E regressions for nocturnal work (noc 14).
 * Focus: Global search auth flow + monthly reports tab.
 */
import { test, expect } from "@playwright/test";
import { ADMIN_AUTH_FILE } from "./helpers";

test.describe("Noc 14 regressions — admin", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("global search returns results and can navigate to user detail", async ({ page }) => {
    await page.goto("/admin");

    // Scope to header/main — sidebar GlobalSearch appears first in DOM on mobile (sidebar hidden)
    const searchInput = page.locator("header, main").getByPlaceholder(/hledat/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("admin");

    const result = page.getByRole("button").filter({ hasText: /uživatel/i }).first();
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();

    await expect(page).toHaveURL(/\/admin\/users\/\d+/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("monthly reports tab renders report widgets and can switch month", async ({ page }) => {
    await page.goto("/admin/stats");
    await expect(page.getByRole("heading", { name: /statistiky/i })).toBeVisible();

    const monthlyTab = page.locator("button", { hasText: "Měsíční zprávy" }).first();
    await expect(monthlyTab).toBeVisible({ timeout: 10000 });
    await monthlyTab.click();

    await expect(page.getByText(/celkové výnosy/i)).toBeVisible();
    await expect(page.getByText(/průměrná hodnota sezení/i)).toBeVisible();

    const monthSelect = page.locator("select").first();
    await monthSelect.selectOption("1");
    await expect(page.getByText(/přehled termínů/i)).toBeVisible();
  });
});
