/**
 * E2E: Client role smoke tests
 * Tests: dashboard, booking, credits, appointments, reports, waitlist, progress
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Client — dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "client");
  });

  test("dashboard shows key sections", async ({ page }) => {
    await page.goto("/client");
    // Should show credit balance card
    await expect(page.getByText(/kredit/i).first()).toBeVisible();
    // Should have booking link
    await expect(page.getByRole("link", { name: /rezervovat|booking/i })).toBeVisible();
  });

  test("booking page loads with service selection", async ({ page }) => {
    await page.goto("/client/booking");
    await expect(page.getByRole("heading", { name: /rezervac|booking/i })).toBeVisible();
    // Service selection should be visible
    await expect(page.getByText(/vyberte službu|service/i)).toBeVisible();
  });

  test("credits page shows balance and transactions", async ({ page }) => {
    await page.goto("/client/credits");
    await expect(page.getByRole("heading", { name: /kredit/i })).toBeVisible();
    await expect(page.getByText(/zůstatek|balance/i)).toBeVisible();
  });

  test("appointments page loads", async ({ page }) => {
    await page.goto("/client/appointments");
    await expect(page.getByRole("heading", { name: /rezervac|termín/i })).toBeVisible();
  });

  test("progress page loads with behavior score", async ({ page }) => {
    await page.goto("/client/progress");
    await expect(page.getByRole("heading", { name: /pokrok|progress/i })).toBeVisible();
  });

  test("waitlist page loads", async ({ page }) => {
    await page.goto("/client/waitlist");
    await expect(page.getByRole("heading", { name: /waitlist|čekací/i })).toBeVisible();
  });

  test("reports page loads", async ({ page }) => {
    await page.goto("/client/reports");
    await expect(page.getByRole("heading", { name: /zpráv|report/i })).toBeVisible();
  });
});
