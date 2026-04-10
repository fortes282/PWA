/**
 * Employee E2E flow — all employee user scenarios.
 */
import { test, expect } from "@playwright/test";
import {
  login,
  logout,
  navigateTo,
  apiGet,
  waitForLoaded,
  expectPageLoaded,
} from "./helpers";

test.describe("Employee flow", () => {
  test.setTimeout(180_000);

  test("Dashboard (Timeline) — login & verify main content", async ({ page }) => {
    await login(page, "employee");
    await expect(page).toHaveURL(/\/employee/);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // Timeline or schedule content visible (hours, cards, or time indicators)
    const content = main.locator("text=/\\d{1,2}:\\d{2}|termín|klient|dnes|today/i").first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test("Clients page", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/clients");
    await waitForLoaded(page);
    await expectPageLoaded(page);
  });

  test("Appointments", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/appointments");
    await waitForLoaded(page);
    await expectPageLoaded(page);
  });

  // Smoke tests for employee sub-pages
  const employeePages = [
    { name: "Schedule", path: "/employee/schedule" },
    { name: "Reports", path: "/employee/reports" },
    { name: "Colleagues", path: "/employee/colleagues" },
    { name: "Therapy reports", path: "/employee/therapy-reports" },
    { name: "Exercise library", path: "/employee/exercise-library" },
    { name: "Homework", path: "/employee/homework" },
    { name: "Session templates", path: "/employee/session-templates" },
    { name: "Wellbeing", path: "/employee/wellbeing" },
  ];

  for (const { name, path } of employeePages) {
    test(`${name} (${path}) loads`, async ({ page }) => {
      await login(page, "employee");
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expectPageLoaded(page);
      await waitForLoaded(page);
    });
  }

  test("Employee API checks", async ({ page }) => {
    await login(page, "employee");

    const dashboard = await apiGet(page, "/dashboard/employee");
    expect(dashboard.status).toBe(200);

    const today = await apiGet(page, "/appointments/today");
    expect(today.status).toBe(200);

    const appointments = await apiGet(page, "/appointments");
    expect(appointments.status).toBe(200);

    const services = await apiGet(page, "/services");
    expect(services.status).toBe(200);

    const notifications = await apiGet(page, "/notifications");
    expect(notifications.status).toBe(200);

    const unread = await apiGet(page, "/notifications/unread-count");
    expect(unread.status).toBe(200);

    const me = await apiGet(page, "/auth/me");
    expect(me.status).toBe(200);
    expect(me.data?.role).toBe("EMPLOYEE");
  });

  test("Logout", async ({ page }) => {
    await login(page, "employee");
    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
