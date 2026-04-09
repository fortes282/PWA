/**
 * E2E: Reception user flow — all reception scenarios for Pristav Radosti neurotherapy app.
 *
 * Covers: dashboard, clients, appointments, schedule, billing, waitlist,
 * health records, working hours, credit requests, invoices, API checks, logout.
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

test.describe("Reception flow", () => {
  test.setTimeout(180_000);

  test("Dashboard — login as reception, verify main content and stats", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await test.step("Login as reception", async () => {
      await login(page, "reception");
      await expect(page).toHaveURL(/\/reception/);
    });

    await test.step("Main content visible", async () => {
      const main = page.locator("main#main-content, main").first();
      await expect(main).toBeVisible({ timeout: 20_000 });
      await waitForLoaded(page);
    });

    await test.step("Stats cards exist", async () => {
      // Look for stat/summary cards on the dashboard
      const cards = page.locator("main .card, main [class*='card'], main [data-testid*='stat']");
      await expect(cards.first()).toBeVisible({ timeout: 15_000 });
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    await test.step("Today's schedule section visible", async () => {
      const schedule = page
        .locator("main")
        .first()
        .locator("text=/dnešní|dnes|today|schedule|rozvrh|plán/i")
        .first();
      await expect(schedule).toBeVisible({ timeout: 15_000 });
    });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No unexpected console errors on dashboard",
    ).toEqual([]);
  });

  test("Clients page — list, search, seed data", async ({ page }) => {
    await login(page, "reception");

    await test.step("Navigate to /reception/clients", async () => {
      await navigateTo(page, "/reception/clients");
    });

    await test.step("Heading visible", async () => {
      await expectHeading(page, /klient/i);
    });

    await test.step("Client list visible (cards or table)", async () => {
      const list = page.locator(
        "main table, main [class*='card'], main [data-testid*='client'], main ul, main .grid",
      );
      await expect(list.first()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Search input exists", async () => {
      const search = page.locator(
        "main input[type='search'], main input[placeholder*='hled'], main input[placeholder*='search'], main input[name*='search'], main input[name*='query']",
      );
      await expect(search.first()).toBeVisible({ timeout: 10_000 });
    });

    await test.step("At least one client visible (seed has 4)", async () => {
      const clientItems = page.locator(
        "main tr, main [class*='card'], main [data-testid*='client-item'], main li",
      );
      await expect(clientItems.first()).toBeVisible({ timeout: 15_000 });
      const count = await clientItems.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test("Appointments page — list, status filter", async ({ page }) => {
    await login(page, "reception");

    await test.step("Navigate to /reception/appointments", async () => {
      await navigateTo(page, "/reception/appointments");
    });

    await test.step("Heading visible", async () => {
      await expectHeading(page, /objednávk|termín|appointment/i);
    });

    await test.step("Appointment list or calendar visible", async () => {
      const content = page.locator(
        "main table, main [class*='calendar'], main [class*='card'], main [data-testid*='appointment'], main ul, main .grid",
      );
      await expect(content.first()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Status filter exists", async () => {
      const filter = page.locator(
        "main select, main [role='combobox'], main [data-testid*='filter'], main button:has-text('stav'), main button:has-text('status'), main [class*='filter']",
      );
      await expect(filter.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test("Schedule page — loads without error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await test.step("Navigate to /reception/schedule", async () => {
      await navigateTo(page, "/reception/schedule");
    });

    await test.step("Calendar or schedule view visible", async () => {
      const view = page.locator(
        "main table, main [class*='calendar'], main [class*='schedule'], main [class*='grid'], main [data-testid*='schedule']",
      );
      await expect(view.first()).toBeVisible({ timeout: 15_000 });
    });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on schedule page",
    ).toEqual([]);
  });

  test("Billing page — loads without error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await navigateTo(page, "/reception/billing");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on billing page",
    ).toEqual([]);
  });

  test("Waitlist page — loads without error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await navigateTo(page, "/reception/waitlist");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on waitlist page",
    ).toEqual([]);
  });

  test("Health records — loads, list or empty state", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await navigateTo(page, "/reception/health-records");
    await waitForLoaded(page);

    await test.step("Page loads without error", async () => {
      const main = page.locator("main").first();
      await expect(main).toBeVisible({ timeout: 15_000 });
    });

    await test.step("List of records or empty state", async () => {
      const content = page.locator(
        "main table, main [class*='card'], main [data-testid*='record'], main ul, main [data-testid*='empty'], main :text-matches('žádné|prázdný|empty|nenalezen', 'i')",
      );
      await expect(content.first()).toBeVisible({ timeout: 15_000 });
    });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on health-records page",
    ).toEqual([]);
  });

  test("Working hours — loads without error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await navigateTo(page, "/reception/working-hours");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on working-hours page",
    ).toEqual([]);
  });

  test("Credit requests — loads without error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await navigateTo(page, "/reception/credit-requests");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on credit-requests page",
    ).toEqual([]);
  });

  test("Invoices — loads without error", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "reception");

    await navigateTo(page, "/reception/invoices");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    expect(
      errors.filter((e) => !e.includes("favicon")),
      "No console errors on invoices page",
    ).toEqual([]);
  });

  test("Reception API checks — all endpoints return expected data", async ({ page }) => {
    await login(page, "reception");

    await test.step("GET /api/dashboard/reception → 200 with counts", async () => {
      const { status, data } = await apiGet(page, "/dashboard/reception");
      expect(status).toBe(200);
      expect(data).toBeTruthy();
      expect(typeof data).toBe("object");
    });

    await test.step("GET /api/appointments → 200", async () => {
      const { status } = await apiGet(page, "/appointments");
      expect(status).toBe(200);
    });

    await test.step("GET /api/appointments/today → 200", async () => {
      const { status } = await apiGet(page, "/appointments/today");
      expect(status).toBe(200);
    });

    await test.step("GET /api/clients → 200 with array", async () => {
      const { status, data } = await apiGet(page, "/clients");
      expect(status).toBe(200);
      expect(Array.isArray(data) || (data && Array.isArray(data.clients))).toBeTruthy();
    });

    await test.step("GET /api/users?role=CLIENT → 200", async () => {
      const { status } = await apiGet(page, "/users?role=CLIENT");
      expect(status).toBe(200);
    });

    await test.step("GET /api/services → 200", async () => {
      const { status } = await apiGet(page, "/services");
      expect(status).toBe(200);
    });

    await test.step("GET /api/rooms → 200", async () => {
      const { status } = await apiGet(page, "/rooms");
      expect(status).toBe(200);
    });

    await test.step("GET /api/waitlist → 200", async () => {
      const { status } = await apiGet(page, "/waitlist");
      expect(status).toBe(200);
    });

    await test.step("GET /api/stats → 200 with revenue data", async () => {
      const { status, data } = await apiGet(page, "/stats");
      expect(status).toBe(200);
      expect(data).toBeTruthy();
      expect(typeof data).toBe("object");
    });

    await test.step("GET /api/stats/quick-summary → 200", async () => {
      const { status } = await apiGet(page, "/stats/quick-summary");
      expect(status).toBe(200);
    });

    await test.step("GET /api/stats/revenue-summary → 200", async () => {
      const { status } = await apiGet(page, "/stats/revenue-summary");
      expect(status).toBe(200);
    });

    await test.step("GET /api/working-hours → 200", async () => {
      const { status } = await apiGet(page, "/working-hours");
      expect(status).toBe(200);
    });

    await test.step("GET /api/notifications → 200", async () => {
      const { status } = await apiGet(page, "/notifications");
      expect(status).toBe(200);
    });
  });

  test("Logout — verify redirect to /login", async ({ page }) => {
    await login(page, "reception");
    await expect(page).toHaveURL(/\/reception/);

    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
