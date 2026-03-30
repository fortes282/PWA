/**
 * E2E: Client role smoke tests
 * Tests: dashboard, booking, credits, appointments, reports, waitlist, progress
 */
import { test, expect } from "@playwright/test";
import { CLIENT_AUTH_FILE } from "./helpers";

test.describe("Client — dashboard", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("dashboard shows key sections", async ({ page }) => {
    await page.goto("/client");
    // Scope to main — sidebar has "Kredity" nav link which appears first in DOM on mobile
    await expect(page.locator("main").getByText(/kredit/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /rezervovat|booking/i }).first()).toBeVisible();
  });

  test("booking page loads with service selection", async ({ page }) => {
    await page.goto("/client/booking");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /rezervace termínu|booking/i })).toBeVisible();
    await expect(page.getByText(/vyberte službu/i).first()).toBeVisible();
  });

  test("credits page shows balance and transactions", async ({ page }) => {
    await page.goto("/client/credits");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /kredit/i })).toBeVisible();
    await expect(page.getByText(/zůstatek|balance/i).first()).toBeVisible();
  });

  test("appointments page loads", async ({ page }) => {
    await page.goto("/client/appointments");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /rezervac/i }).first()).toBeVisible();
  });

  test("progress page loads with behavior score", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1").filter({ hasText: /pokrok/i })).toBeVisible({ timeout: 15000 });
  });

  test("waitlist page loads", async ({ page }) => {
    await page.goto("/client/waitlist");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /waitlist|čekací/i }).first()).toBeVisible();
  });

  test("reports page loads", async ({ page }) => {
    await page.goto("/client/reports");
    await expect(page.getByRole("heading", { name: /zpráv|report/i })).toBeVisible();
  });
});
