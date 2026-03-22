/**
 * E2E: Client — extra pages (invoices, health-record, credit-request)
 * Covers pages added in noc 8 without prior E2E coverage.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_AUTH_FILE } from "./helpers";

test.describe("Client — invoices page", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("invoices page loads with heading", async ({ page }) => {
    await page.goto("/client/invoices");
    await expect(page.getByRole("heading", { name: /faktur/i })).toBeVisible();
  });

  test("invoices page shows summary section or empty state", async ({ page }) => {
    await page.goto("/client/invoices");
    // Either shows invoices with summary cards or empty state
    const hasSummary = await page.getByText(/zaplaceno celkem/i).isVisible();
    const hasEmpty = await page.getByText(/žádné faktur/i).isVisible();
    const isLoading = await page.getByText(/načítám/i).isVisible();
    expect(hasSummary || hasEmpty || isLoading).toBe(true);
  });
});

test.describe("Client — health record page", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("health record page loads", async ({ page }) => {
    await page.goto("/client/health-record");
    // Either shows the record or a 'not found/not created yet' state
    await page.waitForLoadState("networkidle");
    const body = page.locator("main, [role=main], .card, form, section");
    await expect(body.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Client — credit request page", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("credit-request page loads with heading", async ({ page }) => {
    await page.goto("/client/credit-request");
    await expect(page.getByRole("heading", { name: /kredit/i })).toBeVisible();
  });

  test("credit request form or list is visible", async ({ page }) => {
    await page.goto("/client/credit-request");
    // Either shows past requests list or empty state
    const hasForm = await page.getByRole("button", { name: /požádat|odeslat|přidat/i }).isVisible();
    const hasList = await page.getByText(/čeká|schváleno|zamítnuto|žádné/i).isVisible();
    expect(hasForm || hasList).toBe(true);
  });
});
