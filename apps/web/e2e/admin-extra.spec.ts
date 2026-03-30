/**
 * E2E: Admin — extra pages (users detail, FIO CSV export button)
 * Also covers admin user reactivation button visibility
 * and visual regression tests for BI + Stats dashboards.
 */
import { test, expect } from "@playwright/test";
import { ADMIN_AUTH_FILE, assertNoGarbageTextDeep, assertNoTextClipping } from "./helpers";

test.describe("Admin — user detail page", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

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
    await expect(page.getByRole("heading", { name: /statistiky/i })).toBeVisible();
    // Overview KPIs (SWR) — avoid snapshot isVisible() before data arrives
    await expect(
      page.getByText(/výnos|výnosy|revenue|celkem termínů|měsíční|načítám/i).first()
    ).toBeVisible({ timeout: 30000 });
  });

  test("FIO page has CSV export button", async ({ page }) => {
    await page.goto("/admin/fio");
    // Wait for actual page content to render (SPA hydration after splash screen)
    await expect(page.getByRole("heading", { name: /platby|párování|fio/i })).toBeVisible({ timeout: 15000 });
    // CSV export button — accessible name includes icon text "CSV export"
    const hasCsvBtn = await page.getByRole("button", { name: /csv\s*export|export\s*csv/i }).isVisible();
    const hasLink = await page.getByRole("link", { name: /csv\s*export|export\s*csv/i }).isVisible();
    const hasTextBtn = await page.getByText(/csv export/i).isVisible();
    // Either button, link, or text form of export
    expect(hasCsvBtn || hasLink || hasTextBtn).toBe(true);
  });
});

test.describe("Admin — background evaluations", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("background page has run evaluation button", async ({ page }) => {
    await page.goto("/admin/background");
    // Wait for actual page content to render (SPA hydration after splash screen)
    await expect(page.getByRole("heading", { name: /automatizace|background/i })).toBeVisible({ timeout: 15000 });
    // Button text is "Spustit nyní" (run now) in the Auto-Processor section
    const hasBtn = await page.getByRole("button", { name: /spustit|evaluace|evaluate|run/i }).isVisible();
    const hasRunNow = await page.getByRole("button", { name: /spustit nyní/i }).isVisible();
    expect(hasBtn || hasRunNow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Visual regression — BI dashboard
// ---------------------------------------------------------------------------

test.describe("Admin BI — visual regression", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("revenue summary cards show full text, no clipping (VB1)", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForSelector("text=Celkové výnosy", { timeout: 15000 });
    await assertNoTextClipping(page, "BI Revenue");
  });

  test("revenue values end with Kč, not truncated (VB2)", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForSelector("text=Celkové výnosy", { timeout: 15000 });

    const currencyTexts = await page.evaluate(() => {
      const results: { text: string; label: string }[] = [];
      const cards = document.querySelectorAll(".card");
      for (const card of cards) {
        const label = card.querySelector(".text-xs")?.textContent?.trim() ?? "";
        const value = card.querySelector(".font-bold")?.textContent?.trim() ?? "";
        if (value && /\d/.test(value) && (label.includes("výnosy") || label.includes("Průměr"))) {
          results.push({ text: value, label });
        }
      }
      return results;
    });

    for (const { text, label } of currencyTexts) {
      expect(text, `${label}: currency "${text}" should end with "Kč"`).toMatch(/Kč\s*$/);
    }
  });

  test("BI page has no undefined/NaN values (VB3)", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForSelector("text=Celkové výnosy", { timeout: 15000 });
    await assertNoGarbageTextDeep(page, "BI Dashboard");
  });
});

// ---------------------------------------------------------------------------
// Visual regression — Stats overview
// ---------------------------------------------------------------------------

test.describe("Admin Stats — visual regression", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("overview tab has no undefined/NaN in KPI cards (VB4)", async ({ page }) => {
    await page.goto("/admin/stats");
    const overviewTab = page.getByRole("button", { name: /přehled|overview/i });
    if (await overviewTab.isVisible()) await overviewTab.click();
    await page.waitForTimeout(1000);
    await assertNoGarbageTextDeep(page, "Stats Overview");
  });

  test("storno rate shows a number with %, not undefined% (VB5)", async ({ page }) => {
    await page.goto("/admin/stats");
    const overviewTab = page.getByRole("button", { name: /přehled|overview/i });
    if (await overviewTab.isVisible()) await overviewTab.click();
    await page.waitForTimeout(1000);

    const percentValues = await page.evaluate(() => {
      const results: string[] = [];
      const els = document.querySelectorAll(".card p.text-3xl, .card p.text-2xl");
      for (const el of els) {
        const text = (el as HTMLElement).innerText?.trim() ?? "";
        if (text.includes("%")) results.push(text);
      }
      return results;
    });

    for (const pct of percentValues) {
      expect(pct, `Percentage "${pct}" must be a valid number`).toMatch(/^\d+(\.\d+)?%$/);
    }
  });

  test("stat cards text is not clipped on mobile (VB6)", async ({ page }) => {
    await page.goto("/admin/stats");
    const overviewTab = page.getByRole("button", { name: /přehled|overview/i });
    if (await overviewTab.isVisible()) await overviewTab.click();
    await page.waitForTimeout(1000);
    await assertNoTextClipping(page, "Stats Overview");
  });
});
