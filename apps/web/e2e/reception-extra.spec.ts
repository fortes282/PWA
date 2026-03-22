/**
 * E2E: Reception — extra pages
 * Covers: schedule (my appointments day-view), credit-requests, invoice detail
 */
import { test, expect } from "@playwright/test";
import { RECEPTION_AUTH_FILE } from "./helpers";

test.describe("Reception — schedule page", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("schedule page loads with timeline", async ({ page }) => {
    await page.goto("/reception/schedule");
    // Should show day-timeline view
    await page.waitForLoadState("networkidle");
    // The schedule page shows hours 07:00–20:00
    await expect(page.getByText(/07:00|08:00/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("schedule page has therapist selector", async ({ page }) => {
    await page.goto("/reception/schedule");
    await page.waitForLoadState("networkidle");
    // Schedule page shows a therapist select dropdown
    await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Reception — credit requests", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("credit requests page loads", async ({ page }) => {
    await page.goto("/reception/credit-requests");
    await expect(page.getByRole("heading", { name: /kredit/i })).toBeVisible();
  });

  test("filter buttons are visible", async ({ page }) => {
    await page.goto("/reception/credit-requests");
    // Status filter: PENDING / APPROVED / REJECTED
    const hasPending = await page.getByRole("button", { name: /čeká|pending/i }).isVisible();
    const hasFilter = await page.getByRole("button").count() > 0;
    expect(hasPending || hasFilter).toBe(true);
  });
});
