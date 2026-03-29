/**
 * E2E: Client — extra pages (invoices, health-record, credit-request)
 * Covers pages added in noc 8 without prior E2E coverage.
 * Also covers visual regression tests for progress/attendance chart.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_AUTH_FILE, assertNoGarbageTextDeep } from "./helpers";

test.describe("Client — invoices page", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("invoices page loads with heading", async ({ page }) => {
    await page.goto("/client/invoices");
    await expect(page.getByRole("heading", { name: /faktur/i })).toBeVisible();
  });

  test("invoices page shows summary section or empty state", async ({ page }) => {
    await page.goto("/client/invoices");
    // Wait for actual page content to render (SPA hydration after splash screen)
    await expect(page.getByRole("heading", { name: /faktur/i })).toBeVisible({ timeout: 15000 });
    // Now check for summary, empty state, or loading indicator
    const hasSummary = await page.getByText(/zaplaceno celkem/i).isVisible();
    const hasEmpty = await page.getByText(/žádné faktur/i).isVisible();
    const hasInvoiceCard = await page.getByText(/k úhradě/i).isVisible();
    const isLoading = await page.getByText(/načítám/i).isVisible();
    expect(hasSummary || hasEmpty || hasInvoiceCard || isLoading).toBe(true);
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
    await page.waitForLoadState("networkidle");
    // Either shows past requests list or empty state
    const hasForm = await page
      .getByRole("button", { name: /požádat|odeslat|přidat/i })
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const hasList = await page
      .getByText(/čeká|schváleno|zamítnuto|žádné/i)
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    expect(hasForm || hasList).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Visual regression — Progress / Attendance chart
// ---------------------------------------------------------------------------

test.describe("Client Progress — visual regression", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("attendance chart bars with 0 value are minimal, not full height (VB7)", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForSelector("text=Docházka", { timeout: 15000 });

    const barInfo = await page.evaluate(() => {
      const results: { value: number; barHeight: number }[] = [];
      const heading = Array.from(document.querySelectorAll("h2")).find(
        (h) => h.textContent?.includes("Docházka")
      );
      if (!heading) return results;

      const chartContainer = heading.closest(".card") ?? heading.parentElement;
      if (!chartContainer) return results;

      const columns = chartContainer.querySelectorAll(".flex-1.flex.flex-col");
      for (const col of columns) {
        const valueText = col.querySelector(".text-xs")?.textContent?.trim() ?? "0";
        const value = parseInt(valueText) || 0;
        const barContainer = col.querySelector("[style*='height']") as HTMLElement;
        const coloredBar = barContainer?.querySelector("[style*='background']") as HTMLElement;
        const barHeight = coloredBar?.offsetHeight ?? 0;
        results.push({ value, barHeight });
      }
      return results;
    });

    expect(barInfo.length).toBeGreaterThan(0);

    const nonZero = barInfo.filter((b) => b.value > 0);
    const zeroBars = barInfo.filter((b) => b.value === 0);

    if (nonZero.length > 0 && zeroBars.length > 0) {
      const maxBarHeight = Math.max(...nonZero.map((b) => b.barHeight));
      for (const bar of zeroBars) {
        expect(
          bar.barHeight,
          `Bar with value 0 should not have visible height (got ${bar.barHeight}px, max is ${maxBarHeight}px)`
        ).toBeLessThanOrEqual(Math.max(4, maxBarHeight * 0.1));
      }
    }
  });

  test("progress page has no undefined/NaN values (VB8)", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForLoadState("networkidle");
    await assertNoGarbageTextDeep(page, "Client Progress");
  });
});
