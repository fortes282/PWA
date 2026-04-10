/**
 * Admin flow E2E — all admin-specific scenarios.
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

test.describe("Admin flow", () => {
  test.setTimeout(180_000);

  test("1 — Dashboard", async ({ page }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(/\/admin/);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // Dnesni prehled section
    await expect(
      main.locator("text=/dnešní|přehled|today|dashboard/i").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Stats cards exist (at least some cards with numbers)
    const cards = main.locator(".card, [class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(3);
  });

  test("2 — Users management", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/users");
    await waitForLoaded(page);

    // Heading
    await expect(
      page.getByRole("heading", { name: /uživatel|users/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // User rows with email addresses
    const userRows = page.locator("tr, [data-testid*='user'], .card").filter({ hasText: /@/ });
    await expect(userRows.first()).toBeVisible({ timeout: 15_000 });
    const count = await userRows.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test("3 — Services management", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    await expect(
      page.getByRole("heading", { name: /služb|services/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // At least some services listed
    const serviceItems = page.locator(".card, tr, li").filter({
      hasText: /neurorehabilitace|konzultace|fyzioterapie|psychoterapie|ergoterapie|logopedie|skupinov/i,
    });
    await expect(serviceItems.first()).toBeVisible({ timeout: 15_000 });
    const svcCount = await serviceItems.count();
    expect(svcCount).toBeGreaterThanOrEqual(5);
  });

  test("4 — Rooms management", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/rooms");
    await waitForLoaded(page);

    await expect(
      page.getByRole("heading", { name: /místnost|rooms|sál/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // "Přidat místnost" button should exist
    await expect(
      page.getByRole("button", { name: /přidat|add|nová/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // Smoke tests for admin sub-pages — just verify they load
  const adminPages = [
    { name: "Statistics", path: "/admin/stats" },
    { name: "Settings", path: "/admin/settings" },
    { name: "FIO", path: "/admin/fio" },
    { name: "Audit log", path: "/admin/audit" },
    { name: "GDPR", path: "/admin/gdpr" },
    { name: "Invoices", path: "/admin/invoices" },
    { name: "Insurance", path: "/admin/insurance" },
    { name: "Monitoring", path: "/admin/monitoring" },
    { name: "API keys", path: "/admin/api-keys" },
    { name: "Notifications", path: "/admin/notifications" },
    { name: "Questionnaires", path: "/admin/questionnaires" },
    { name: "Intensive blocks", path: "/admin/intensive-blocks" },
    { name: "Slot recovery", path: "/admin/slot-recovery" },
    { name: "Heatmap", path: "/admin/heatmap" },
  ];

  for (const { name, path } of adminPages) {
    test(`${name} (${path}) loads`, async ({ page }) => {
      await login(page, "admin");
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expectPageLoaded(page);
      await waitForLoaded(page);
    });
  }

  test("Admin API checks", async ({ page }) => {
    await login(page, "admin");

    const health = await apiGet(page, "/health");
    expect(health.status).toBe(200);

    const healthDetailed = await apiGet(page, "/health/detailed");
    expect(healthDetailed.status).toBe(200);

    const stats = await apiGet(page, "/stats");
    expect(stats.status).toBe(200);

    const quickSummary = await apiGet(page, "/stats/quick-summary");
    expect(quickSummary.status).toBe(200);

    const revenueSummary = await apiGet(page, "/stats/revenue-summary");
    expect(revenueSummary.status).toBe(200);

    const activityFeed = await apiGet(page, "/stats/activity-feed");
    expect(activityFeed.status).toBe(200);

    const topClients = await apiGet(page, "/stats/top-clients");
    expect(topClients.status).toBe(200);

    const employeesPerf = await apiGet(page, "/stats/employees-performance");
    expect(employeesPerf.status).toBe(200);

    const pending = await apiGet(page, "/dashboard/admin/pending");
    expect(pending.status).toBe(200);

    const reception = await apiGet(page, "/dashboard/reception");
    expect(reception.status).toBe(200);

    const users = await apiGet(page, "/users");
    expect(users.status).toBe(200);
    expect(Array.isArray(users.data)).toBe(true);
    expect((users.data as unknown[]).length).toBeGreaterThanOrEqual(8);

    const services = await apiGet(page, "/services?includeInactive=true");
    expect(services.status).toBe(200);

    const rooms = await apiGet(page, "/rooms");
    expect(rooms.status).toBe(200);

    const waitlist = await apiGet(page, "/waitlist");
    expect(waitlist.status).toBe(200);

    const waitlistStats = await apiGet(page, "/waitlist/stats");
    expect(waitlistStats.status).toBe(200);

    const workingHours = await apiGet(page, "/working-hours");
    expect(workingHours.status).toBe(200);

    const me = await apiGet(page, "/auth/me");
    expect(me.status).toBe(200);
    expect(me.data?.role).toBe("ADMIN");
  });

  test("Logout", async ({ page }) => {
    await login(page, "admin");
    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
