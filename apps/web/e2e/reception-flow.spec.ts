/**
 * E2E: Reception user flow — all reception scenarios.
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

test.describe("Reception flow", () => {
  test.setTimeout(180_000);

  test("Dashboard — verify main content and stats", async ({ page }) => {
    await login(page, "reception");
    await expect(page).toHaveURL(/\/reception/);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // Stats cards exist
    const cards = main.locator(".card, [class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Clients page — list, search, seed data", async ({ page }) => {
    await login(page, "reception");
    await navigateTo(page, "/reception/clients");
    await waitForLoaded(page);

    // Heading
    await expect(
      page.getByRole("heading", { name: /klient/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Client list visible
    const list = page.locator(
      "main table, main [class*='card'], main ul, main .grid",
    );
    await expect(list.first()).toBeVisible({ timeout: 15_000 });

    // Search input exists
    const search = page.locator(
      "main input[type='search'], main input[placeholder*='hled'], main input[placeholder*='search'], main input[name*='search']",
    );
    await expect(search.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Appointments page — list visible", async ({ page }) => {
    await login(page, "reception");
    await navigateTo(page, "/reception/appointments");
    await waitForLoaded(page);

    await expectPageLoaded(page);
  });

  // Smoke tests for reception sub-pages
  const receptionPages = [
    { name: "Schedule", path: "/reception/schedule" },
    { name: "Billing", path: "/reception/billing" },
    { name: "Waitlist", path: "/reception/waitlist" },
    { name: "Health records", path: "/reception/health-records" },
    { name: "Working hours", path: "/reception/working-hours" },
    { name: "Credit requests", path: "/reception/credit-requests" },
  ];

  for (const { name, path } of receptionPages) {
    test(`${name} (${path}) loads`, async ({ page }) => {
      await login(page, "reception");
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expectPageLoaded(page);
      await waitForLoaded(page);
    });
  }

  test("Reception API checks", async ({ page }) => {
    await login(page, "reception");

    const dashboard = await apiGet(page, "/dashboard/reception");
    expect(dashboard.status).toBe(200);
    expect(dashboard.data).toBeTruthy();

    const appointments = await apiGet(page, "/appointments");
    expect(appointments.status).toBe(200);

    const today = await apiGet(page, "/appointments/today");
    expect(today.status).toBe(200);

    const clients = await apiGet(page, "/clients");
    expect(clients.status).toBe(200);

    const usersClient = await apiGet(page, "/users?role=CLIENT");
    expect(usersClient.status).toBe(200);

    const services = await apiGet(page, "/services");
    expect(services.status).toBe(200);

    const rooms = await apiGet(page, "/rooms");
    expect(rooms.status).toBe(200);

    const waitlist = await apiGet(page, "/waitlist");
    expect(waitlist.status).toBe(200);

    const stats = await apiGet(page, "/stats");
    expect(stats.status).toBe(200);

    const quickSummary = await apiGet(page, "/stats/quick-summary");
    expect(quickSummary.status).toBe(200);

    const revenueSummary = await apiGet(page, "/stats/revenue-summary");
    expect(revenueSummary.status).toBe(200);

    const workingHours = await apiGet(page, "/working-hours");
    expect(workingHours.status).toBe(200);

    const notifications = await apiGet(page, "/notifications");
    expect(notifications.status).toBe(200);
  });

  test("Logout — verify redirect to /login", async ({ page }) => {
    await login(page, "reception");
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
