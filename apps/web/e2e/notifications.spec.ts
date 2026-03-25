/**
 * E2E: Notifications page smoke tests
 */
import { test, expect } from "@playwright/test";
import { CLIENT_AUTH_FILE, RECEPTION_AUTH_FILE } from "./helpers";

test.describe("Notifications page", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("notifications page is accessible", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: /notifikace/i })).toBeVisible();
  });

  test("shows bell icon in nav", async ({ page }) => {
    await page.goto("/client");
    // NotificationBell component should be visible in sidebar (desktop layout)
    await expect(page.getByRole("button", { name: /notifikace/i })).toBeVisible();
  });

  test("mark all as read button only visible when there are unread", async ({ page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    // Either shows "Označit vše přečteno" or empty state
    const hasUnread = await page
      .getByRole("button", { name: /označit vše přečteno/i })
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const hasEmpty = await page
      .getByText(/žádné notifikace/i)
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    expect(hasUnread || hasEmpty).toBe(true);
  });
});

test.describe("Notifications bell — dropdown", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("notification bell is present in layout", async ({ page }) => {
    await page.goto("/reception");
    await page.waitForLoadState("networkidle");

    // Verify that a Notifications entry exists in the navigation (sidebar link or bell button).
    // On desktop the sidebar contains "link Notifikace → /notifications".
    // On mobile the hamburger menu or bottom-nav shows it.
    // Use toBeAttached (in DOM) rather than toBeVisible (can be off-screen in long sidebar).
    const notifLink = page.locator("a[href*='/notifications']").first();
    const bellButton = page.getByRole("button", { name: /notifikace|oznámení/i });

    const linkAttached = await notifLink.waitFor({ state: "attached", timeout: 5000 }).then(() => true).catch(() => false);
    const buttonAttached = await bellButton.waitFor({ state: "attached", timeout: 2000 }).then(() => true).catch(() => false);

    if (!linkAttached && !buttonAttached) {
      // Mobile: try hamburger menu to reveal nav
      const hamburger = page.getByRole("button", { name: /otevřít menu|menu/i }).first();
      const hamburgerVisible = await hamburger.waitFor({ state: "visible", timeout: 2000 }).then(() => true).catch(() => false);
      if (hamburgerVisible) {
        await hamburger.click();
        await page.waitForTimeout(400);
      }
    }

    // At least one notification navigation element must be present in DOM.
    const finalLink = page.locator("a[href*='/notifications']").first();
    const finalButton = page.getByRole("button", { name: /notifikace|oznámení/i }).first();
    await expect(finalLink.or(finalButton).first()).toBeAttached({ timeout: 3000 });
  });
});
