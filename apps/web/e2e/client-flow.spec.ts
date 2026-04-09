/**
 * Client flow E2E tests — all client user scenarios for Pristav Radosti.
 * Covers dashboard, credits, appointments, booking wizard, settings,
 * health record, waitlist, invoices, progress, API checks, and logout.
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

test.describe("Client flow", () => {
  test.setTimeout(180_000);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, "client");
    await page.close();
  });

  test("1 — Dashboard", async ({ page }) => {
    await login(page, "client");

    // Main content visible
    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // Credit balance card
    const balanceCard = page
      .locator("main")
      .locator(".card, [class*='card'], [data-testid*='card']")
      .filter({ hasText: /zůstatek|balance|kredit/i })
      .first();
    await expect(balanceCard).toBeVisible({ timeout: 20_000 });

    // Appointments or empty state
    const appointments = page
      .locator("main")
      .locator(
        ":text-matches('termín|appointment|žádné|no appointment|naplánov', 'i')",
      )
      .first();
    await expect(appointments).toBeVisible({ timeout: 15_000 });

    // Navigation links work (sidebar or tab bar)
    const navLink = page
      .getByRole("link", { name: /finance|kredit|termín|nastavení/i })
      .first();
    await expect(navLink).toBeVisible({ timeout: 10_000 });
  });

  test("2 — Credits page", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/credits");
    await waitForLoaded(page);

    // Heading
    await expectHeading(page, /kredity/i);

    // Balance card with numeric value
    const card = page
      .locator("main")
      .locator(".card, [class*='card']")
      .filter({ hasText: /zůstatek|balance/i })
      .first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText(/\d/, { timeout: 25_000 });

    // API check
    const res = await page.request.get("/api/credits/balance");
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const data = (await res.json()) as { balance?: unknown };
    expect(typeof data.balance).toBe("number");
    expect(Number.isFinite(data.balance as number)).toBe(true);

    // Transaction history section
    const history = page
      .locator("main")
      .locator(
        ":text-matches('historie|transakce|transaction|history|pohyb', 'i')",
      )
      .first();
    await expect(history).toBeVisible({ timeout: 15_000 });
  });

  test("3 — Appointments page", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/appointments");
    await waitForLoaded(page);

    // Heading
    const heading = page
      .getByRole("heading", { name: /termín|appointment/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Appointments listed or empty state
    const content = page
      .locator("main")
      .locator(
        ":text-matches('termín|appointment|žádné|no appointment|nadchází|minul|upcoming|past|naplánov', 'i')",
      )
      .first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test("4 — Booking flow", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/booking");
    await waitForLoaded(page);

    // Service selection step visible
    const serviceStep = page
      .locator("main")
      .locator(
        ":text-matches('služb|service|vyberte|vyber|typ|neurorehabilitace', 'i')",
      )
      .first();
    await expect(serviceStep).toBeVisible({ timeout: 20_000 });

    // At least one service card visible
    const serviceCard = page
      .locator("main")
      .locator(".card, [class*='card'], button, [role='button']")
      .filter({ hasText: /neurorehabilitace|konzultace|fyzioterapie|psychoterapie|ergoterapie|logopedie|skupinové/i })
      .first();
    await expect(serviceCard).toBeVisible({ timeout: 15_000 });

    // Click on a service -> date selection step
    await serviceCard.click();

    const dateStep = page
      .locator("main")
      .locator(
        ":text-matches('datum|date|termín|calendar|kalendář|čas|time|slot|den', 'i')",
      )
      .first();
    await expect(dateStep).toBeVisible({ timeout: 15_000 });
    // Don't complete booking to avoid side effects
  });

  test("5 — Settings", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/settings");
    await waitForLoaded(page);

    // Profile section
    const profile = page
      .locator("main")
      .locator(":text-matches('profil|profile|účet|account', 'i')")
      .first();
    await expect(profile).toBeVisible({ timeout: 15_000 });

    // Name field
    const nameField = page
      .locator("main")
      .locator(
        'input[name*="name"], input[name*="jmeno"], input[placeholder*="jmén"], input[placeholder*="name"]',
      )
      .first();
    await expect(nameField).toBeVisible({ timeout: 15_000 });

    // Theme toggle
    const themeToggle = page
      .locator("main")
      .locator(
        'button:has-text("tmavý"), button:has-text("světlý"), button:has-text("theme"), button:has-text("dark"), button:has-text("light"), [data-testid*="theme"], [aria-label*="theme"], [aria-label*="motiv"], input[type="checkbox"]',
      )
      .first();
    await expect(themeToggle).toBeVisible({ timeout: 15_000 });
  });

  test("6 — Health record", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "client");
    await navigateTo(page, "/client/health-record");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(criticalErrors).toEqual([]);
  });

  test("7 — Waitlist", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "client");
    await navigateTo(page, "/client/waitlist");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(criticalErrors).toEqual([]);
  });

  test("8 — Invoices", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "client");
    await navigateTo(page, "/client/invoices");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(criticalErrors).toEqual([]);
  });

  test("9 — Progress", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await login(page, "client");
    await navigateTo(page, "/client/progress");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404"),
    );
    expect(criticalErrors).toEqual([]);
  });

  test("10 — Client API checks", async ({ page }) => {
    await login(page, "client");

    // GET /api/appointments/upcoming -> 200
    const upcoming = await apiGet(page, "/appointments/upcoming");
    expect(upcoming.status).toBe(200);

    // GET /api/appointments/stats -> 200 with expected fields
    const stats = await apiGet(page, "/appointments/stats");
    expect(stats.status).toBe(200);
    expect(stats.data).toBeTruthy();

    // GET /api/dashboard/client -> 200 with balance, stats
    const dashboard = await apiGet(page, "/dashboard/client");
    expect(dashboard.status).toBe(200);
    expect(dashboard.data).toBeTruthy();

    // GET /api/services -> 200 with array
    const services = await apiGet(page, "/services");
    expect(services.status).toBe(200);
    expect(Array.isArray(services.data)).toBe(true);
    expect((services.data as unknown[]).length).toBeGreaterThan(0);

    // GET /api/notifications -> 200
    const notifications = await apiGet(page, "/notifications");
    expect(notifications.status).toBe(200);

    // GET /api/notifications/unread-count -> 200 with { count: number }
    const unread = await apiGet(page, "/notifications/unread-count");
    expect(unread.status).toBe(200);
    expect(typeof (unread.data as { count?: unknown })?.count).toBe("number");
  });

  test("11 — Logout", async ({ page }) => {
    await login(page, "client");
    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
