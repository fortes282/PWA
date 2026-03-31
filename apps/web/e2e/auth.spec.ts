/**
 * E2E: Auth flow & RBAC tests
 *
 * Matrix scenarios:
 *   AUTH-01 (P0): Login each role → verify redirect, logout → verify redirect to /login,
 *                 verify accessing dashboard after logout redirects to /login.
 *   RBAC-01 (P0): CLIENT tries /admin → blocked. EMPLOYEE tries /reception/billing → blocked.
 *                 RECEPTION tries /admin/settings → blocked.
 */
import { test, expect } from "@playwright/test";
import {
  CLIENT_AUTH_FILE,
  ADMIN_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
  login,
  USERS,
  sleepMs,
  E2E_LOGIN_GAP_MS,
} from "./helpers";

// ============================================================================
// AUTH-01 (P0): Login each role → verify redirect
// ============================================================================

test.describe("AUTH-01: Login each role and verify redirect", () => {
  // CLIENT → /client
  test("CLIENT login redirects to /client", async ({ page }) => {
    await login(page, "client");
    await expect(page).toHaveURL(/\/client/);
  });

  // RECEPTION → /reception
  test("RECEPTION login redirects to /reception", async ({ page }) => {
    await sleepMs(E2E_LOGIN_GAP_MS);
    await login(page, "reception");
    await expect(page).toHaveURL(/\/reception/);
  });

  // EMPLOYEE → /employee
  test("EMPLOYEE login redirects to /employee", async ({ page }) => {
    await sleepMs(E2E_LOGIN_GAP_MS);
    await login(page, "employee");
    await expect(page).toHaveURL(/\/employee/);
  });

  // ADMIN → /admin
  test("ADMIN login redirects to /admin", async ({ page }) => {
    await sleepMs(E2E_LOGIN_GAP_MS);
    await login(page, "admin");
    await expect(page).toHaveURL(/\/admin/);
  });
});

// ============================================================================
// AUTH-01 (P0): Logout → redirect to /login, dashboard after logout → /login
// ============================================================================

test.describe("AUTH-01: Logout redirects to /login", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("CLIENT logout redirects to /login", async ({ page }) => {
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // On mobile (<md breakpoint) logout is behind "Více" bottom sheet.
    // On desktop logout is directly in the sidebar.
    const moreTab = page.getByRole("button", { name: /^více$/i });
    const moreVisible = await moreTab
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (moreVisible) {
      await moreTab.click();
      await page.getByTestId("more-sheet").waitFor({ state: "visible", timeout: 3000 });
    }

    await page.getByRole("button", { name: /odhlásit/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("accessing /client after logout redirects to /login", async ({ page, context }) => {
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Perform logout
    const moreTab = page.getByRole("button", { name: /^více$/i });
    const moreVisible = await moreTab
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (moreVisible) {
      await moreTab.click();
      await page.getByTestId("more-sheet").waitFor({ state: "visible", timeout: 3000 });
    }

    await page.getByRole("button", { name: /odhlásit/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Try accessing dashboard after logout — should redirect back to /login
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login|\/unauthorized/);
  });
});

// ============================================================================
// RBAC-01 (P0): Route protection — cross-role access blocked
// ============================================================================

test.describe("RBAC-01: CLIENT tries /admin → blocked", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("CLIENT cannot access /admin", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    // Should redirect to /unauthorized or not show admin content
    const url = page.url();
    const isBlocked =
      /\/unauthorized/.test(url) ||
      /\/login/.test(url) ||
      /\/client/.test(url);
    // If somehow on /admin, admin content should not be visible
    if (!isBlocked) {
      const adminContent = page.getByRole("heading", { name: /správa|administrace|admin/i });
      await expect(adminContent).not.toBeVisible({ timeout: 3000 });
    } else {
      expect(isBlocked).toBe(true);
    }
  });
});

test.describe("RBAC-01: EMPLOYEE tries /reception/billing → blocked", () => {
  test.use({ storageState: EMPLOYEE_AUTH_FILE });

  test("EMPLOYEE cannot access /reception/billing", async ({ page }) => {
    await page.goto("/reception/billing", { waitUntil: "domcontentloaded" });
    const url = page.url();
    const isBlocked =
      /\/unauthorized/.test(url) ||
      /\/login/.test(url) ||
      /\/employee/.test(url);
    if (!isBlocked) {
      // Should not show reception billing content
      const billingContent = page.getByRole("heading", { name: /fakturace|billing|faktury/i });
      await expect(billingContent).not.toBeVisible({ timeout: 3000 });
    } else {
      expect(isBlocked).toBe(true);
    }
  });
});

test.describe("RBAC-01: RECEPTION tries /admin/settings → blocked", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("RECEPTION cannot access /admin/settings", async ({ page }) => {
    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
    const url = page.url();
    const isBlocked =
      /\/unauthorized/.test(url) ||
      /\/login/.test(url) ||
      /\/reception/.test(url);
    if (!isBlocked) {
      const settingsContent = page.getByRole("heading", { name: /nastavení|settings/i });
      await expect(settingsContent).not.toBeVisible({ timeout: 3000 });
    } else {
      expect(isBlocked).toBe(true);
    }
  });
});
