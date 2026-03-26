/**
 * iPhone WebKit: rychlá kontrola, že document/body nemají horizontální přetečení
 * oproti šířce viewportu. Běží jen na Playwright projektu `iphone`.
 *
 * Viz PWA_TEST_MATRIX.md — sekce K (IOS-VIS-*).
 * Opt-in screenshoty: ENABLE_IPHONE_VISUAL_SNAPSHOTS=1
 */
import { test, expect, type Page } from "@playwright/test";
import {
  CLIENT_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
  ADMIN_AUTH_FILE,
} from "./helpers";

const TOLERANCE_PX = 3;

async function assertNoHorizontalPageOverflow(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(400);

  const dims = await page.evaluate(() => {
    const de = document.documentElement;
    const body = document.body;
    return {
      docScrollW: de.scrollWidth,
      docClientW: de.clientWidth,
      bodyScrollW: body?.scrollWidth ?? de.scrollWidth,
      bodyClientW: body?.clientWidth ?? de.clientWidth,
    };
  });

  expect
    .soft(dims.docScrollW, `document scrollWidth ${dims.docScrollW} vs clientWidth ${dims.docClientW}`)
    .toBeLessThanOrEqual(dims.docClientW + TOLERANCE_PX);
  expect
    .soft(dims.bodyScrollW, `body scrollWidth ${dims.bodyScrollW} vs clientWidth ${dims.bodyClientW}`)
    .toBeLessThanOrEqual(dims.bodyClientW + TOLERANCE_PX);
}

function skipUnlessIphone(testInfo: { project: { name: string } }) {
  test.skip(
    testInfo.project.name !== "iphone",
    "Runs only on Playwright project `iphone` (iPhone 15 WebKit)"
  );
}

test.describe("iPhone layout — document overflow smoke @iphone-layout", () => {
  test.beforeEach(({}, testInfo) => {
    skipUnlessIphone(testInfo);
  });

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

  test.describe("narrow viewport 320×568 (SE-class)", () => {
    test.use({
      storageState: CLIENT_AUTH_FILE,
      viewport: { width: 320, height: 568 },
    });

    test("client booking still fits horizontally", async ({ page }) => {
      await page.goto("/client/booking");
      await assertNoHorizontalPageOverflow(page);
    });
  });

  test.describe("narrow viewport 320×568 — reception calendar", () => {
    test.use({
      storageState: RECEPTION_AUTH_FILE,
      viewport: { width: 320, height: 568 },
    });

    test("no horizontal overflow", async ({ page }) => {
      await page.goto("/reception/calendar");
      await assertNoHorizontalPageOverflow(page);
    });
  });

  test.describe("narrow viewport 320×568 — admin stats", () => {
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

test.describe("iPhone opt-in visual snapshots @iphone-visual", () => {
  test.beforeEach(({}, testInfo) => {
    skipUnlessIphone(testInfo);
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
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot("iphone-client-home.png", {
        maxDiffPixels: 1200,
        animations: "disabled",
      });
    });
  });
});
