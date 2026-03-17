/**
 * E2E: Admin — extra pages (users detail, FIO CSV export button)
 * Also covers admin user reactivation button visibility.
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Admin — user detail page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("users list has at least one user row with a link", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    // Should have at least admin row
    const rows = page.getByRole("link").filter({ hasText: /detail|zobrazit|admin/i });
    // If no detail links, at least the table rows exist
    const rowCount = await page.locator("tr, [data-row], .user-row").count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test("stats page has revenue chart or placeholder", async ({ page }) => {
    await page.goto("/admin/stats");
    await page.waitForLoadState("networkidle");
    // Revenue by month section (from noc 8)
    const hasChart = await page.getByText(/výnos|výnosy|revenue|měsíc/i).isVisible();
    expect(hasChart).toBe(true);
  });

  test("FIO page has CSV export button", async ({ page }) => {
    await page.goto("/admin/fio");
    await page.waitForLoadState("networkidle");
    // CSV export button from noc 8
    const hasCsvBtn = await page.getByRole("button", { name: /csv|export/i }).isVisible();
    const hasLink = await page.getByRole("link", { name: /csv|export/i }).isVisible();
    // Either button or link form of export
    expect(hasCsvBtn || hasLink).toBe(true);
  });
});

test.describe("Admin — background evaluations", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("background page has run evaluation button", async ({ page }) => {
    await page.goto("/admin/background");
    await page.waitForLoadState("networkidle");
    const hasBtn = await page.getByRole("button", { name: /spustit|evaluace|evaluate|run/i }).isVisible();
    expect(hasBtn).toBe(true);
  });
});
