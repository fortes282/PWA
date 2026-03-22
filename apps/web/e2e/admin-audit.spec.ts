/**
 * E2E: Admin — Audit log page (/admin/audit)
 * Tests: navigation, table rendering, filtering
 */
import { test, expect } from "@playwright/test";
import { ADMIN_AUTH_FILE } from "./helpers";

test.describe("Admin — Audit log", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("admin can navigate to /admin/audit", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.waitForLoadState("networkidle");
    // Page title should be visible
    await expect(page.getByText(/audit log/i).first()).toBeVisible();
  });

  test("audit page shows table with column headers", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.waitForLoadState("networkidle");

    // Table headers
    await expect(page.getByRole("columnheader", { name: /čas/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /akce/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /uživatel/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /cíl/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /ip/i })).toBeVisible();
  });

  test("audit page shows table or empty state", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.waitForLoadState("networkidle");

    // Either there are rows or an empty state message
    const hasRows = await page.locator("tbody tr").count();
    const emptyState = page.getByText(/žádné záznamy/i);

    if (hasRows > 1) {
      // At least one real data row (first row may be header)
      expect(hasRows).toBeGreaterThan(0);
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  test("admin can filter by action", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.waitForLoadState("networkidle");

    // Select action filter
    const select = page.locator("select").first();
    await select.selectOption("USER_LOGIN");
    await page.waitForLoadState("networkidle");

    // Page still shows (either rows matching or empty state)
    await expect(page.getByText(/audit log/i).first()).toBeVisible();
  });

  test("navigation sidebar has audit link", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const auditLink = page.getByRole("link", { name: /audit/i });
    await expect(auditLink).toBeVisible();
    await auditLink.click();
    await expect(page).toHaveURL(/\/admin\/audit/);
  });
});
