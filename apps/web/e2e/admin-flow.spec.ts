/**
 * Admin flow E2E — all admin-specific scenarios for the Pristav Radosti neurotherapy app.
 * Covers dashboard, management pages, admin-only API endpoints, and logout.
 */
import { test, expect } from "@playwright/test";
import {
  USERS,
  login,
  logout,
  navigateTo,
  apiGet,
  collectConsoleErrors,
  waitForLoaded,
  expectHeading,
} from "./helpers";

test.describe("Admin flow", () => {
  test.setTimeout(180_000);

  test("1 — Dashboard", async ({ page }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(/\/admin/);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // System health badge
    await expect(
      page.locator('[data-testid="system-health"], .badge, [class*="badge"]')
        .filter({ hasText: /health|stav|system|provoz/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // Stats cards — appointments, revenue, patients, staff
    for (const label of [/objedn|appointment|rezervac/i, /příj|revenue|tržb/i, /pacient|klient|patient/i, /personál|staff|zaměst/i]) {
      await expect(
        main.locator(".card, [class*='card'], [data-testid*='stat']").filter({ hasText: label }).first(),
      ).toBeVisible({ timeout: 15_000 });
    }

    // Administrative hub links
    await expect(
      main.getByRole("link").filter({ hasText: /správa|admin|manage|nastavení/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("2 — Users management", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/users");
    await waitForLoaded(page);

    await expectHeading(page, /uživatel|users/i);

    // Search input
    const search = page.getByPlaceholder(/hled|search|filtr/i).first();
    await expect(search).toBeVisible({ timeout: 10_000 });

    // At least 8 users visible (seed data)
    const userRows = page.locator("tr, [data-testid*='user'], .card").filter({ hasText: /@/ });
    await expect(userRows.first()).toBeVisible({ timeout: 15_000 });
    const count = await userRows.count();
    expect(count).toBeGreaterThanOrEqual(8);

    // Role filter
    await expect(
      page.locator("select, [data-testid*='role'], [role='combobox'], button")
        .filter({ hasText: /role|role|filtr/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("3 — Services management", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    await expectHeading(page, /služb|services/i);

    // At least 7 services listed
    const serviceItems = page.locator(".card, tr, [data-testid*='service']").filter({
      hasText: /neurorehabilitace|konzultace|fyzioterapie|psychoterapie|ergoterapie|logopedie|skupinov/i,
    });
    await expect(serviceItems.first()).toBeVisible({ timeout: 15_000 });
    const svcCount = await serviceItems.count();
    expect(svcCount).toBeGreaterThanOrEqual(7);

    // Service cards with name, price, duration
    const firstCard = serviceItems.first();
    await expect(firstCard).toContainText(/\d+\s*(Kč|min|CZK)/i);
  });

  test("4 — Rooms management", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/rooms");
    await waitForLoaded(page);

    await expectHeading(page, /místnost|rooms/i);

    const roomItems = page.locator(".card, tr, [data-testid*='room'], li").filter({
      hasText: /sál|místnost|room/i,
    });
    await expect(roomItems.first()).toBeVisible({ timeout: 15_000 });
    const roomCount = await roomItems.count();
    expect(roomCount).toBeGreaterThanOrEqual(4);
  });

  test("5 — Statistics", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/stats");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible();

    // Stats or chart visible
    await expect(
      main.locator("canvas, svg, .chart, [data-testid*='stat'], .card, [class*='chart']").first(),
    ).toBeVisible({ timeout: 20_000 });

    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("6 — Settings", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/settings");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("7 — FIO", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/fio");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("8 — Audit log", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/audit");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("9 — GDPR", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/gdpr");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("10 — Invoices", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/invoices");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("11 — Insurance", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/insurance");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("12 — Monitoring", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/monitoring");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("13 — API keys", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/api-keys");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("14 — Notifications", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/notifications");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("15 — Questionnaires", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/questionnaires");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("16 — Intensive blocks", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/intensive-blocks");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("17 — Slot recovery", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/slot-recovery");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("18 — Heatmap", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "admin");
    await navigateTo(page, "/admin/heatmap");
    await waitForLoaded(page);
    await expect(page.locator("main").first()).toBeVisible();
    const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
    expect(fatal.length, `Console errors: ${fatal.join("; ")}`).toBe(0);
  });

  test("19 — Admin API checks", async ({ page }) => {
    await login(page, "admin");

    // GET /api/health → 200
    const health = await apiGet(page, "/health");
    expect(health.status).toBe(200);

    // GET /api/health/detailed → 200 with uptime
    const healthDetailed = await apiGet(page, "/health/detailed");
    expect(healthDetailed.status).toBe(200);
    expect(healthDetailed.data).toHaveProperty("uptime");

    // GET /api/stats → 200 with totalClients, revenue
    const stats = await apiGet(page, "/stats");
    expect(stats.status).toBe(200);
    expect(stats.data).toHaveProperty("totalClients");
    expect(stats.data).toHaveProperty("revenue");

    // GET /api/stats/quick-summary → 200
    const quickSummary = await apiGet(page, "/stats/quick-summary");
    expect(quickSummary.status).toBe(200);

    // GET /api/stats/revenue-summary → 200
    const revenueSummary = await apiGet(page, "/stats/revenue-summary");
    expect(revenueSummary.status).toBe(200);

    // GET /api/stats/activity-feed → 200 with items array
    const activityFeed = await apiGet(page, "/stats/activity-feed");
    expect(activityFeed.status).toBe(200);
    expect(Array.isArray(activityFeed.data?.items ?? activityFeed.data)).toBe(true);

    // GET /api/stats/top-clients → 200
    const topClients = await apiGet(page, "/stats/top-clients");
    expect(topClients.status).toBe(200);

    // GET /api/stats/employees-performance → 200
    const employeesPerf = await apiGet(page, "/stats/employees-performance");
    expect(employeesPerf.status).toBe(200);

    // GET /api/dashboard/admin/pending → 200
    const pending = await apiGet(page, "/dashboard/admin/pending");
    expect(pending.status).toBe(200);

    // GET /api/dashboard/reception → 200 (admin can access)
    const reception = await apiGet(page, "/dashboard/reception");
    expect(reception.status).toBe(200);

    // GET /api/users → 200 with array of 8+ users
    const users = await apiGet(page, "/users");
    expect(users.status).toBe(200);
    expect(Array.isArray(users.data)).toBe(true);
    expect((users.data as unknown[]).length).toBeGreaterThanOrEqual(8);

    // GET /api/services?includeInactive=true → 200
    const services = await apiGet(page, "/services?includeInactive=true");
    expect(services.status).toBe(200);

    // GET /api/rooms → 200
    const rooms = await apiGet(page, "/rooms");
    expect(rooms.status).toBe(200);

    // GET /api/waitlist → 200
    const waitlist = await apiGet(page, "/waitlist");
    expect(waitlist.status).toBe(200);

    // GET /api/waitlist/stats → 200
    const waitlistStats = await apiGet(page, "/waitlist/stats");
    expect(waitlistStats.status).toBe(200);

    // GET /api/working-hours → 200
    const workingHours = await apiGet(page, "/working-hours");
    expect(workingHours.status).toBe(200);

    // GET /api/auth/me → 200 with role ADMIN
    const me = await apiGet(page, "/auth/me");
    expect(me.status).toBe(200);
    expect(me.data?.role).toBe("ADMIN");
  });

  test("20 — Logout", async ({ page }) => {
    await login(page, "admin");
    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
