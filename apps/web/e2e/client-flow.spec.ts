/**
 * Client flow E2E tests — all client user scenarios.
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

test.describe("Client flow", () => {
  test.setTimeout(180_000);

  test("1 — Dashboard", async ({ page }) => {
    await login(page, "client");

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // Credit balance card or some dashboard card
    const cards = main.locator(".card, [class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });

    // Navigation links work (sidebar or tab bar)
    const navLink = page
      .getByRole("link", { name: /finance|kredit|rezervac|nastavení|termín|přehled/i })
      .first();
    await expect(navLink).toBeVisible({ timeout: 10_000 });
  });

  test("2 — Credits page", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/credits");
    await waitForLoaded(page);

    // Heading
    await expect(
      page.getByRole("heading", { name: /kredit/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Balance card with numeric value
    const card = page
      .locator("main .card, main [class*='card']")
      .filter({ hasText: /zůstatek|balance|kredit/i })
      .first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText(/\d/, { timeout: 25_000 });

    // API check
    const res = await page.request.get("/api/credits/balance");
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const data = (await res.json()) as { balance?: unknown };
    expect(typeof data.balance).toBe("number");
  });

  test("3 — Appointments page", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/appointments");
    await waitForLoaded(page);

    // Heading — actual text is "Moje rezervace"
    await expect(
      page.getByRole("heading", { name: /rezervac|termín|appointment/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Some content (appointments list or empty state)
    const content = page.locator("main").first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test("4 — Booking flow", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/booking");
    await waitForLoaded(page);

    // Service selection visible
    const serviceStep = page
      .locator("main")
      .locator("text=/služb|service|vyberte|neurorehabilitace|fyzioterapie/i")
      .first();
    await expect(serviceStep).toBeVisible({ timeout: 20_000 });

    // At least one service card
    const serviceCard = page
      .locator("main")
      .locator(".card, [class*='card'], button, [role='button']")
      .filter({ hasText: /neurorehabilitace|konzultace|fyzioterapie|psychoterapie|ergoterapie|logopedie|skupinové/i })
      .first();
    await expect(serviceCard).toBeVisible({ timeout: 15_000 });

    // Click service -> date step
    await serviceCard.click();
    const dateStep = page
      .locator("main")
      .locator("text=/datum|date|termín|calendar|kalendář|čas|time|slot|den/i")
      .first();
    await expect(dateStep).toBeVisible({ timeout: 15_000 });
  });

  test("5 — Settings", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/settings");
    await waitForLoaded(page);

    // Heading "Nastavení"
    await expect(
      page.getByRole("heading", { name: /nastavení|settings|profil/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Main content loaded
    await expectPageLoaded(page);
  });

  // Smoke tests for client sub-pages
  const clientPages = [
    { name: "Health record", path: "/client/health-record" },
    { name: "Waitlist", path: "/client/waitlist" },
    { name: "Invoices", path: "/client/invoices" },
    { name: "Progress", path: "/client/progress" },
  ];

  for (const { name, path } of clientPages) {
    test(`${name} (${path}) loads`, async ({ page }) => {
      await login(page, "client");
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expectPageLoaded(page);
      await waitForLoaded(page);
    });
  }

  test("Client API checks", async ({ page }) => {
    await login(page, "client");

    const upcoming = await apiGet(page, "/appointments/upcoming");
    expect(upcoming.status).toBe(200);

    const stats = await apiGet(page, "/appointments/stats");
    expect(stats.status).toBe(200);

    const dashboard = await apiGet(page, "/dashboard/client");
    expect(dashboard.status).toBe(200);

    const services = await apiGet(page, "/services");
    expect(services.status).toBe(200);
    expect(Array.isArray(services.data)).toBe(true);
    expect((services.data as unknown[]).length).toBeGreaterThan(0);

    const notifications = await apiGet(page, "/notifications");
    expect(notifications.status).toBe(200);

    const unread = await apiGet(page, "/notifications/unread-count");
    expect(unread.status).toBe(200);
    expect(typeof (unread.data as { count?: unknown })?.count).toBe("number");
  });

  test("Logout", async ({ page }) => {
    await login(page, "client");
    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
