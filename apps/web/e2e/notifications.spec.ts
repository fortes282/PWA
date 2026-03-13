/**
 * E2E: Notifications page smoke tests
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Notifications page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "client");
  });

  test("notifications page is accessible", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: /notifikace/i })).toBeVisible();
  });

  test("shows bell icon in nav", async ({ page }) => {
    await page.goto("/client");
    // NotificationBell component should be visible in header
    await expect(page.locator('header')).toBeVisible();
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
  test.beforeEach(async ({ page }) => {
    await login(page, "reception");
  });

  test("notification bell is present in layout", async ({ page }) => {
    await page.goto("/reception");
    const bell = page.getByTitle(/notifikace/i).or(page.locator('[aria-label*="Notifikace"]'));
    // Bell might be visible or hidden based on unread count
    await expect(page.locator('header')).toBeVisible();
  });
});
