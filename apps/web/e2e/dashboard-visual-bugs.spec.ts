/**
 * E2E: Visual bug regression tests for dashboards.
 *
 * Catches three categories of visual bugs that unit tests miss:
 * 1. "undefined" / "NaN" / "null" rendered in stat cards (data bugs)
 * 2. Text overflowing or clipped by card containers (CSS layout bugs)
 * 3. Chart bars not matching their data values (rendering bugs)
 *
 * These tests run with real rendering so they catch issues that only
 * manifest when CSS, viewport width, and API data combine.
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_AUTH_FILE,
  CLIENT_AUTH_FILE,
} from "./helpers";

// ─── Shared assertions ──────────────────────────────────────────────────────

/**
 * Assert that no visible text on the page contains "undefined", "NaN", or
 * literal "null" (outside of code blocks / JSON).  Catches the entire class
 * of `${someVar}%` bugs where the var is missing from the API response.
 */
async function assertNoGarbageText(page: import("@playwright/test").Page, label: string) {
  // Wait for data to load — most pages show a skeleton / spinner first
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500); // let SWR hydrate

  const garbage = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          // Skip script, style, code, pre, textarea, hidden elements
          const tag = el.tagName;
          if (["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT"].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (el.offsetParent === null && el.tagName !== "BODY") {
            return NodeFilter.FILTER_REJECT; // hidden
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const hits: string[] = [];
    while (walker.nextNode()) {
      const txt = walker.currentNode.textContent?.trim() ?? "";
      if (!txt) continue;
      // Match standalone "undefined", "NaN", or "null" — not inside words
      if (/\bundefined\b/i.test(txt) || /\bNaN\b/.test(txt) || /\bnull\b/i.test(txt)) {
        const ctx = txt.slice(0, 80);
        const el = walker.currentNode.parentElement;
        const selector = el?.tagName + (el?.className ? `.${String(el.className).split(" ")[0]}` : "");
        hits.push(`"${ctx}" in <${selector}>`);
      }
    }
    return hits;
  });

  expect(
    garbage,
    `${label}: found garbage text (undefined/NaN/null) in visible DOM:\n${garbage.join("\n")}`
  ).toEqual([]);
}

/**
 * Assert that no stat card / KPI element has text clipped by overflow.
 * Detects the "36 800,00 K" bug where "Kč" is cut off.
 */
async function assertNoTextClipping(page: import("@playwright/test").Page, label: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const clipped = await page.evaluate(() => {
    const results: string[] = [];

    // Find all elements that look like stat values (large bold text inside cards)
    const candidates = document.querySelectorAll(
      ".card p, .card span, .card h2, .card h3, .card div, [class*='stat'] p, [class*='stat'] span"
    );

    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.offsetParent === null) continue; // hidden
      if (el.children.length > 2) continue; // skip container divs

      const text = el.innerText?.trim();
      if (!text || text.length < 2) continue;

      // Check if text is horizontally clipped
      if (el.scrollWidth > el.clientWidth + 2) {
        results.push(
          `Clipped: "${text.slice(0, 40)}" (scrollW=${el.scrollWidth}, clientW=${el.clientWidth}) in ${el.tagName}.${String(el.className).split(" ")[0]}`
        );
      }
    }
    return results;
  });

  expect(
    clipped,
    `${label}: found text clipping in stat cards:\n${clipped.join("\n")}`
  ).toEqual([]);
}

// ─── Admin BI Dashboard (Revenue tab) ────────────────────────────────────────

test.describe("Admin BI — visual regression", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("revenue summary cards show full text, no clipping (VB1)", async ({ page }) => {
    await page.goto("/admin/bi");
    // Revenue tab is the default — wait for the cards to render
    await page.waitForSelector("text=Celkové výnosy", { timeout: 15000 });
    await assertNoTextClipping(page, "BI Revenue");
  });

  test("revenue values end with Kč, not truncated (VB2)", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForSelector("text=Celkové výnosy", { timeout: 15000 });

    // Find all currency values in stat cards and verify they end with "Kč"
    const currencyTexts = await page.evaluate(() => {
      const results: { text: string; label: string }[] = [];
      const cards = document.querySelectorAll(".card");
      for (const card of cards) {
        const label = card.querySelector(".text-xs")?.textContent?.trim() ?? "";
        const value = card.querySelector(".font-bold")?.textContent?.trim() ?? "";
        // Only check cards that should show currency (Kč)
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
    await assertNoGarbageText(page, "BI Dashboard");
  });
});

// ─── Admin Stats — Overview tab ──────────────────────────────────────────────

test.describe("Admin Stats — visual regression", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("overview tab has no undefined/NaN in KPI cards (VB4)", async ({ page }) => {
    await page.goto("/admin/stats");

    // Click Overview tab
    const overviewTab = page.getByRole("button", { name: /přehled|overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }

    await page.waitForTimeout(1000); // wait for SWR to load stats
    await assertNoGarbageText(page, "Stats Overview");
  });

  test("storno rate shows a number with %, not undefined% (VB5)", async ({ page }) => {
    await page.goto("/admin/stats");

    const overviewTab = page.getByRole("button", { name: /přehled|overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }

    await page.waitForTimeout(1000);

    // Find all elements showing a percentage
    const percentValues = await page.evaluate(() => {
      const results: string[] = [];
      const els = document.querySelectorAll(".card p.text-3xl, .card p.text-2xl");
      for (const el of els) {
        const text = (el as HTMLElement).innerText?.trim() ?? "";
        if (text.includes("%")) {
          results.push(text);
        }
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
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }
    await page.waitForTimeout(1000);
    await assertNoTextClipping(page, "Stats Overview");
  });
});

// ─── Client Progress — Attendance chart ──────────────────────────────────────

test.describe("Client Progress — visual regression", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("attendance chart bars with 0 value are minimal, not full height (VB7)", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForSelector("text=Docházka", { timeout: 15000 });

    // Check bar heights: bars for 0-value months should be much shorter than non-zero ones
    const barInfo = await page.evaluate(() => {
      const results: { value: number; containerHeight: number; barHeight: number }[] = [];

      // Find the attendance chart section
      const heading = Array.from(document.querySelectorAll("h2")).find(
        (h) => h.textContent?.includes("Docházka")
      );
      if (!heading) return results;

      const chartContainer = heading.closest(".card") ?? heading.parentElement;
      if (!chartContainer) return results;

      // Find individual bar columns (flex-1 items with bar data)
      const columns = chartContainer.querySelectorAll(".flex-1.flex.flex-col");
      for (const col of columns) {
        const valueText = col.querySelector(".text-xs")?.textContent?.trim() ?? "0";
        const value = parseInt(valueText) || 0;

        // The bar container is the div with relative positioning
        const barContainer = col.querySelector("[style*='height']") as HTMLElement;
        const containerHeight = barContainer?.offsetHeight ?? 0;

        // The colored bar or placeholder inside
        const coloredBar = barContainer?.querySelector("[style*='background']") as HTMLElement;
        const barHeight = coloredBar?.offsetHeight ?? 0;

        results.push({ value, containerHeight, barHeight });
      }
      return results;
    });

    // There should be at least some bar data
    expect(barInfo.length).toBeGreaterThan(0);

    // Find max bar height among non-zero values
    const nonZero = barInfo.filter((b) => b.value > 0);
    const zeroBars = barInfo.filter((b) => b.value === 0);

    if (nonZero.length > 0 && zeroBars.length > 0) {
      const maxBarHeight = Math.max(...nonZero.map((b) => b.barHeight));

      for (const bar of zeroBars) {
        // Zero-value bars must be ≤ 10% of the tallest bar (or ≤ 4px)
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
    await assertNoGarbageText(page, "Client Progress");
  });
});

// ─── Global: scan ALL dashboard pages for undefined/NaN ──────────────────────

test.describe("Global — no undefined/NaN on any dashboard", () => {
  const dashboardPages = [
    { role: "admin", path: "/admin", storage: ADMIN_AUTH_FILE },
    { role: "admin", path: "/admin/stats", storage: ADMIN_AUTH_FILE },
    { role: "admin", path: "/admin/bi", storage: ADMIN_AUTH_FILE },
    { role: "client", path: "/client", storage: CLIENT_AUTH_FILE },
    { role: "client", path: "/client/progress", storage: CLIENT_AUTH_FILE },
  ];

  for (const { role, path, storage } of dashboardPages) {
    test(`no garbage text on ${path} [${role}] (VB-global)`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: storage });
      const page = await ctx.newPage();
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      await assertNoGarbageText(page, `${role}:${path}`);
      await ctx.close();
    });
  }
});
