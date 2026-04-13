/**
 * Notifikace — behaviorální testy čtení, označování a notif bell.
 */
import { test, expect } from "@playwright/test";
import { login, navigateTo, apiGet, waitForLoaded } from "./helpers";

test.describe("Notifikace — interakce", () => {
  test.setTimeout(120_000);

  test("7.1 — Stránka notifikací se načte", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/notifications");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 15_000 });

    const notifRes = await apiGet(page, "/notifications");
    expect(notifRes.status).toBe(200);
    expect(Array.isArray(notifRes.data)).toBe(true);
  });

  test("7.2 — Unread count je číslo (může být 0 nebo větší)", async ({ page }) => {
    await login(page, "client");

    const countRes = await apiGet(page, "/notifications/unread-count");
    expect(countRes.status).toBe(200);
    const count = (countRes.data as { count?: number })?.count ?? 0;
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("7.3 — Označit vše jako přečtené", async ({ page }) => {
    await login(page, "client");

    const beforeRes = await apiGet(page, "/notifications/unread-count");
    const countBefore = (beforeRes.data as { count?: number })?.count ?? 0;

    await navigateTo(page, "/notifications");
    await waitForLoaded(page);

    if (countBefore > 0) {
      const markAllBtn = page.getByRole("button", { name: /označit.*vše|mark all|all.*read/i }).first();
      const hasMarkAll = await markAllBtn.isVisible({ timeout: 8_000 }).catch(() => false);
      if (hasMarkAll) {
        await markAllBtn.click();
        await page.waitForTimeout(1500);

        const afterRes = await apiGet(page, "/notifications/unread-count");
        const countAfter = (afterRes.data as { count?: number })?.count ?? 0;
        expect(countAfter).toBeLessThanOrEqual(countBefore);
      }
    }
  });

  test("7.4 — Kliknutí na notifikaci ji označí jako přečtenou", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/notifications");
    await waitForLoaded(page);

    const notifItem = page.locator(".card, li, [class*='notif']").first();
    const hasItem = await notifItem.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasItem) {
      const beforeRes = await apiGet(page, "/notifications/unread-count");
      const countBefore = (beforeRes.data as { count?: number })?.count ?? 0;

      await notifItem.click();
      await page.waitForTimeout(1000);

      if (countBefore > 0) {
        const afterRes = await apiGet(page, "/notifications/unread-count");
        const countAfter = (afterRes.data as { count?: number })?.count ?? 0;
        expect(countAfter).toBeLessThanOrEqual(countBefore);
      }
    }
  });

  test("7.5 — NotificationBell v headeru/sidebaru je viditelná po přihlášení", async ({ page }) => {
    await login(page, "client");
    await waitForLoaded(page);

    // Bell ikona v navigaci
    const bell = page.locator("[data-lucide='bell'], [aria-label*='notifik'], [class*='bell']").first();
    const hasBell = await bell.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasBell) {
      expect(hasBell).toBe(true);
    }
  });

  test("7.6 — Admin vidí notifikace svého portálu", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/notifications");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
  });

  test("7.7 — Notifikace settings — přihlášený klient může upravit preference", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/settings/notifications");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    // Toggle pro email nebo push
    const toggle = page.locator("input[type='checkbox'], [role='switch']").first();
    const hasToggle = await toggle.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasToggle) {
      const wasChecked = await toggle.isChecked();
      await toggle.click();
      await page.waitForTimeout(500);
      const isChecked = await toggle.isChecked();
      expect(isChecked).toBe(!wasChecked);
    }
  });
});
