/**
 * iPad (WebKit tablet): horizontální overflow smoke — stejná logika jako iPhone/Android.
 * Projekt `ipad` (iPad Pro 11). Nepřidává „další breakpointy“ v CSS; jen hlídá regrese na tabletové šířce.
 *
 * Viz PWA_TEST_MATRIX.md — sekce K3.
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

test.describe("Tablet (iPad) layout — document overflow smoke @tablet-layout", () => {

  test.describe("Client", () => {
    test.use({ storageState: CLIENT_AUTH_FILE });
    const paths = ["/client", "/client/booking", "/client/appointments", "/notifications"];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });

  test.describe("Reception", () => {
    test.use({ storageState: RECEPTION_AUTH_FILE });
    const paths = ["/reception", "/reception/calendar", "/reception/clients"];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });

  test.describe("Employee", () => {
    test.use({ storageState: EMPLOYEE_AUTH_FILE });
    const paths = ["/employee", "/employee/appointments"];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });

  test.describe("Admin", () => {
    test.use({ storageState: ADMIN_AUTH_FILE });
    const paths = ["/admin", "/admin/users"];
    for (const path of paths) {
      test(`no horizontal overflow: ${path}`, async ({ page }) => {
        await page.goto(path);
        await assertNoHorizontalPageOverflow(page);
      });
    }
  });
});
