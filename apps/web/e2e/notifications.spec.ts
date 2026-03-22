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
    // Either shows "Označit vše přečteno" or empty state
    const hasUnread = await page.getByRole("button", { name: /označit vše přečteno/i }).isVisible();
    const hasEmpty = await page.getByText(/žádné notifikace/i).isVisible();
    expect(hasUnread || hasEmpty).toBe(true);
  });
});

test.describe("Notifications bell — dropdown", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("notification bell is present in layout", async ({ page }) => {
    await page.goto("/reception");
    // NotificationBell has aria-label="Notifikace" on the button
    await expect(page.getByRole("button", { name: /notifikace/i })).toBeVisible();
  });
});
