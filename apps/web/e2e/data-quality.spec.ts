import { test, expect, Page } from "@playwright/test";
import { ADMIN_AUTH_FILE, CLIENT_AUTH_FILE, RECEPTION_AUTH_FILE } from "./helpers";

// ---------------------------------------------------------------------------
// Helpers: detect broken data bindings (undefined / NaN / [object Object])
// ---------------------------------------------------------------------------

/** Check that NO visible text on the page contains "undefined" as a standalone word. */
async function assertNoUndefined(page: Page) {
  const body = await page.locator("main").textContent();
  const undefinedMatches = (body || "").match(/\bundefined\b/gi);
  expect(
    undefinedMatches,
    `Found "undefined" in page content: ${undefinedMatches}`,
  ).toBeNull();
}

/** Check that NO visible text contains "NaN". */
async function assertNoNaN(page: Page) {
  const body = await page.locator("main").textContent();
  const nanMatches = (body || "").match(/\bNaN\b/g);
  expect(nanMatches, `Found "NaN" in page content`).toBeNull();
}

/** Check no "[object Object]" displayed. */
async function assertNoObjectObject(page: Page) {
  const body = await page.locator("main").textContent();
  expect(body).not.toContain("[object Object]");
}

/** Run all three data-quality assertions on the current page. */
async function assertDataQuality(page: Page) {
  await assertNoUndefined(page);
  await assertNoNaN(page);
  await assertNoObjectObject(page);
}

// ---------------------------------------------------------------------------
// ADMIN pages
// ---------------------------------------------------------------------------

test.describe("Data quality - Admin", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("admin dashboard shows no undefined/NaN", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });

  test("admin stats page shows no undefined/NaN", async ({ page }) => {
    await page.goto("/admin/stats");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });

  test("admin BI page shows no undefined/NaN", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });
});

// ---------------------------------------------------------------------------
// RECEPTION pages
// ---------------------------------------------------------------------------

test.describe("Data quality - Reception", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("reception dashboard shows no undefined/NaN", async ({ page }) => {
    await page.goto("/reception");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });
});

// ---------------------------------------------------------------------------
// CLIENT pages
// ---------------------------------------------------------------------------

test.describe("Data quality - Client", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("client dashboard shows no undefined/NaN", async ({ page }) => {
    await page.goto("/client");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });

  test("client credits page shows no undefined/NaN", async ({ page }) => {
    await page.goto("/client/credits");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });

  test("client progress page shows no undefined/NaN", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForLoadState("networkidle");
    await assertDataQuality(page);
  });
});
