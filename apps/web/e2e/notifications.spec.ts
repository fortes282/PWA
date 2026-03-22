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
    // On desktop: NotificationBell button is in the sidebar
    // On mobile: NotificationBell is ONLY in the desktop sidebar (hidden). Fall back to checking
    // the hamburger menu navigation which contains a "Notifikace" link for non-CLIENT roles.
    const bell = page.getByRole("button", { name: /notifikace/i });
    const bellVisible = await bell
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!bellVisible) {
      // Mobile: open hamburger menu and check for Notifikace link
      const hamburger = page.getByRole("button", { name: /otevřít menu/i });
      const hamburgerVisible = await hamburger
        .waitFor({ state: "visible", timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (hamburgerVisible) {
        await hamburger.click();
      }
    }
    await expect(
      page.getByRole("button", { name: /notifikace/i }).or(page.getByRole("link", { name: /notifikace/i }))
    ).toBeVisible({ timeout: 5000 });
  });
});
