/**
 * Employee E2E flow — all employee user scenarios for Pristav Radosti neurotherapy app.
 *
 * Spuštění: pnpm -C apps/web run test:e2e:prepare && pnpm -C apps/web test:e2e
 */
import { test, expect } from "@playwright/test";
import {
  USERS,
  login,
  logout,
  navigateTo,
  apiGet,
  apiPost,
  collectConsoleErrors,
  waitForLoaded,
  expectHeading,
  type UserRole,
} from "./helpers";

test.describe("Employee flow", () => {
  test.setTimeout(180_000);

  test("Dashboard (Timeline) — login & verify main content", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await test.step("Login as employee", async () => {
      await login(page, "employee");
      await expect(page).toHaveURL(/\/employee/);
    });

    await test.step("Main content visible", async () => {
      const main = page.locator("main#main-content, main").first();
      await expect(main).toBeVisible({ timeout: 20_000 });
      await waitForLoaded(page);
    });

    await test.step("Timeline view with hours or schedule display", async () => {
      // Look for timeline hours, appointment cards, or schedule-related content
      const timeline = page.locator(
        '[data-testid="timeline"], [data-testid="schedule"], .timeline, .schedule, [class*="timeline"], [class*="schedule"]',
      ).first();
      const timeSlots = page.locator('text=/\\d{1,2}:\\d{2}|\\d{1,2}\\s*h/i').first();
      const appointmentCards = page.locator(
        '.card, [data-testid="appointment-card"], [class*="appointment"]',
      ).first();
      const currentIndicator = page.locator(
        '[data-testid="current-time"], [class*="current-time"], [class*="now-indicator"]',
      ).first();

      // At least one of these should be visible on the dashboard
      const hasTimeline = await timeline.isVisible().catch(() => false);
      const hasTimeSlots = await timeSlots.isVisible().catch(() => false);
      const hasCards = await appointmentCards.isVisible().catch(() => false);
      const hasIndicator = await currentIndicator.isVisible().catch(() => false);

      expect(
        hasTimeline || hasTimeSlots || hasCards || hasIndicator,
        "Expected timeline, time slots, appointment cards, or current time indicator to be visible on employee dashboard",
      ).toBe(true);
    });
  });

  test("Clients page — /employee/clients", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/clients");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    // Client list, table, or stats should be present
    const clientContent = page.locator(
      'table, [data-testid="client-list"], [class*="client"], ul, .card',
    ).first();
    await expect(clientContent).toBeVisible({ timeout: 20_000 });
  });

  test("Appointments — /employee/appointments", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/appointments");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    // Appointment list or empty state
    const appointmentContent = page.locator(
      'table, [data-testid="appointment-list"], [class*="appointment"], ul, .card, text=/žádné|no appointments|seznam/i',
    ).first();
    await expect(appointmentContent).toBeVisible({ timeout: 20_000 });
  });

  test("Schedule — /employee/schedule", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/schedule");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Reports — /employee/reports", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/reports");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Colleagues — /employee/colleagues", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/colleagues");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });

    // At least one colleague visible (seed has 2 employees)
    const colleagueItems = page.locator(
      '[data-testid="colleague-item"], [class*="colleague"], .card, li, tr',
    );
    // Wait for content to load, then check that there is at least one colleague entry
    await page.waitForTimeout(3_000);
    await waitForLoaded(page);

    const colleagueCard = page.locator('main .card, main li, main tr, main [class*="colleague"]');
    const count = await colleagueCard.count();
    expect(count, "Expected at least one colleague to be visible").toBeGreaterThanOrEqual(1);
  });

  test("Therapy reports — /employee/therapy-reports", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/therapy-reports");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Exercise library — /employee/exercise-library", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/exercise-library");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Homework — /employee/homework", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/homework");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Session templates — /employee/session-templates", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/session-templates");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Wellbeing — /employee/wellbeing", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/wellbeing");
    await waitForLoaded(page);

    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
  });

  test("Employee API checks", async ({ page }) => {
    await login(page, "employee");
    await waitForLoaded(page);

    await test.step("GET /api/dashboard/employee → 200 with todayApptCount, stats", async () => {
      const { status, data } = await apiGet(page, "/dashboard/employee");
      expect(status).toBe(200);
      expect(data).toHaveProperty("todayApptCount");
      expect(data).toHaveProperty("stats");
    });

    await test.step("GET /api/appointments/today → 200", async () => {
      const { status } = await apiGet(page, "/appointments/today");
      expect(status).toBe(200);
    });

    await test.step("GET /api/appointments → 200", async () => {
      const { status } = await apiGet(page, "/appointments");
      expect(status).toBe(200);
    });

    await test.step("GET /api/services → 200", async () => {
      const { status } = await apiGet(page, "/services");
      expect(status).toBe(200);
    });

    await test.step("GET /api/notifications → 200", async () => {
      const { status } = await apiGet(page, "/notifications");
      expect(status).toBe(200);
    });

    await test.step("GET /api/notifications/unread-count → 200", async () => {
      const { status } = await apiGet(page, "/notifications/unread-count");
      expect(status).toBe(200);
    });

    await test.step("GET /api/auth/me → 200 with role EMPLOYEE", async () => {
      const { status, data } = await apiGet(page, "/auth/me");
      expect(status).toBe(200);
      expect(data.role).toBe("EMPLOYEE");
    });
  });

  test("Logout → verify on /login", async ({ page }) => {
    await login(page, "employee");
    await waitForLoaded(page);

    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
