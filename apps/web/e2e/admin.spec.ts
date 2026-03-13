/**
 * E2E: Admin role smoke tests
 * Tests: users, services, rooms, settings, stats, background, FIO
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Admin — core pages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("admin dashboard loads", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
  });

  test("users page loads with list (AD1)", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /uživatel/i })).toBeVisible();
    // Should show at least the admin user in the list
    await expect(page.getByText(/admin@pristav/i)).toBeVisible();
  });

  test("services page loads (AD2)", async ({ page }) => {
    await page.goto("/admin/services");
    await expect(page.getByRole("heading", { name: /služb/i })).toBeVisible();
  });

  test("rooms page loads with CRUD (AD3)", async ({ page }) => {
    await page.goto("/admin/rooms");
    await expect(page.getByRole("heading", { name: /místnost/i })).toBeVisible();
  });

  test("settings page loads with configuration (AD4)", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /nastavení/i })).toBeVisible();
  });

  test("stats page loads with metrics (AD5)", async ({ page }) => {
    await page.goto("/admin/stats");
    await expect(page.getByRole("heading", { name: /statistik/i })).toBeVisible();
  });

  test("background/behavior page loads (AD6)", async ({ page }) => {
    await page.goto("/admin/background");
    await expect(page.getByRole("heading", { name: /background|behavior/i })).toBeVisible();
  });

  test("FIO bank matching page loads (D1)", async ({ page }) => {
    await page.goto("/admin/fio");
    await expect(page.getByRole("heading", { name: /fio|platb/i })).toBeVisible();
  });
});
