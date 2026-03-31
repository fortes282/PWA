/**
 * Layout overflow smoke tests -- merged from android-layout-smoke, iphone-layout-smoke,
 * and tablet-layout-smoke. Runs on webkit, iphone, android, and ipad projects.
 *
 * Uses the shared assertNoHorizontalPageOverflow helper from helpers.ts.
 */
import { test, expect } from "@playwright/test";
import {
  CLIENT_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
  ADMIN_AUTH_FILE,
  assertNoHorizontalPageOverflow,
} from "./helpers";

// ---------------------------------------------------------------------------
// Core layout checks (all device projects)
// ---------------------------------------------------------------------------

test.describe("Layout -- document overflow smoke", () => {

  test.describe("Client", () => {
    test.use({ storageState: CLIENT_AUTH_FILE });
    const paths = [
      "/client",
      "/client/booking",
      "/client/appointments",
      "/client/credits",
      "/client/invoices",
      "/client/progress",
      "/notifications",
    ];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });

  test.describe("Reception", () => {
    test.use({ storageState: RECEPTION_AUTH_FILE });
    const paths = [
      "/reception",
      "/reception/calendar",
      "/reception/appointments",
      "/reception/clients",
      "/reception/health-records",
      "/reception/waitlist",
      "/reception/billing",
    ];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });

  test.describe("Employee", () => {
    test.use({ storageState: EMPLOYEE_AUTH_FILE });
    const paths = [
      "/employee",
      "/employee/appointments",
      "/employee/reports",
      "/employee/homework",
      "/employee/clients",
    ];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });

  test.describe("Admin", () => {
    test.use({ storageState: ADMIN_AUTH_FILE });
    const paths = [
      "/admin",
      "/admin/users",
      "/admin/stats",
      "/admin/bi",
      "/admin/notifications",
    ];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Narrow viewport tests (iPhone SE class -- 320x568)
// ---------------------------------------------------------------------------

test.describe("Narrow viewport 320x568", () => {

  test.describe("client booking", () => {
    test.use({
      storageState: CLIENT_AUTH_FILE,
      viewport: { width: 320, height: 568 },
    });

    test("client booking still fits horizontally", async ({ page }) => {
      await page.goto("/client/booking");
      await assertNoHorizontalPageOverflow(page);
    });
  });

  test.describe("reception calendar", () => {
    test.use({
      storageState: RECEPTION_AUTH_FILE,
      viewport: { width: 320, height: 568 },
    });

    test("no horizontal overflow", async ({ page }) => {
      await page.goto("/reception/calendar");
      await assertNoHorizontalPageOverflow(page);
    });
  });

  test.describe("admin stats", () => {
    test.use({
      storageState: ADMIN_AUTH_FILE,
      viewport: { width: 320, height: 568 },
    });

    test("no horizontal overflow", async ({ page }) => {
      await page.goto("/admin/stats");
      await assertNoHorizontalPageOverflow(page);
    });
  });
});

// ---------------------------------------------------------------------------
// Opt-in visual snapshots (iPhone only -- gated by env var)
// ---------------------------------------------------------------------------

test.describe("iPhone opt-in visual snapshots", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !process.env.ENABLE_IPHONE_VISUAL_SNAPSHOTS,
      "Set ENABLE_IPHONE_VISUAL_SNAPSHOTS=1 to record/compare screenshots"
    );
  });

  test("login page baseline", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("iphone-login.png", {
      maxDiffPixels: 800,
      animations: "disabled",
    });
  });

  test.describe("Client dashboard baseline", () => {
    test.use({ storageState: CLIENT_AUTH_FILE });

    test("client home", async ({ page }) => {
      await page.goto("/client");
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveScreenshot("iphone-client-home.png", {
        maxDiffPixels: 1200,
        animations: "disabled",
      });
    });
  });
});
