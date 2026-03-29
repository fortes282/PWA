import { test, expect } from "@playwright/test";
import {
  ADMIN_AUTH_FILE, CLIENT_AUTH_FILE, RECEPTION_AUTH_FILE,
  assertNoGarbageTextDeep, assertNoTextClipping, assertDataQuality,
} from "./helpers";

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
