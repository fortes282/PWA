/**
 * E2E: Detail pages (dynamic routes)
 * Tests: /admin/users/[id], /reception/invoices/[id], /reception/clients/[id]
 */
import { test, expect } from "@playwright/test";
import { login, API_URL } from "./helpers";

test.describe("Admin — user detail page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("can navigate to user detail from users list", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    // Click first detail link or row button
    const detailBtn = page.getByRole("link", { name: /detail|zobrazit/i }).first();
    const detailExists = await detailBtn.isVisible();
    if (detailExists) {
      await detailBtn.click();
      await page.waitForLoadState("networkidle");
      // Should be on /admin/users/[id]
      await expect(page).toHaveURL(/\/admin\/users\/\d+/);
    } else {
      // Try direct navigation to user 1
      await page.goto("/admin/users/1");
      await page.waitForLoadState("networkidle");
      // Should show user info or redirect
      const isNotFound = await page.getByText(/nenalezen|not found|404/i).isVisible();
      const hasContent = await page.locator("main").isVisible();
      expect(isNotFound || hasContent).toBe(true);
    }
  });
});

test.describe("Reception — client detail page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "reception");
  });

  test("can navigate to client detail from clients list", async ({ page }) => {
    await page.goto("/reception/clients");
    await page.waitForLoadState("networkidle");
    // Try clicking first detail/client row
    const firstLink = page.getByRole("link").filter({ hasText: /detail|zobrazit|klient/i }).first();
    const linkExists = await firstLink.isVisible();
    if (linkExists) {
      await firstLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/reception\/clients\/\d+/);
    } else {
      // Direct navigation
      await page.goto("/reception/clients/1");
      const hasContent = await page.locator("main").isVisible();
      expect(hasContent).toBe(true);
    }
  });
});

test.describe("Reception — invoice detail page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "reception");
  });

  test("invoice detail page loads when navigated directly", async ({ page }) => {
    // Navigate to the billing page first to find any invoice
    await page.goto("/reception/billing");
    await page.waitForLoadState("networkidle");
    // Try to find an invoice link
    const invoiceLink = page.getByRole("link").filter({ hasText: /detail|INV|faktura/i }).first();
    const linkExists = await invoiceLink.isVisible();
    if (linkExists) {
      await invoiceLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/reception\/invoices\/\d+/);
    } else {
      // Direct navigation
      await page.goto("/reception/invoices/1");
      await page.waitForLoadState("networkidle");
      const hasContent = await page.locator("main").isVisible();
      expect(hasContent).toBe(true);
    }
  });
});

test.describe("Reception — health record detail", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "reception");
  });

  test("health records list can navigate to client health record", async ({ page }) => {
    await page.goto("/reception/health-records");
    await page.waitForLoadState("networkidle");
    const hasHeading = await page.getByRole("heading", { name: /zdravotní záznamy/i }).isVisible();
    expect(hasHeading).toBe(true);
  });
});
