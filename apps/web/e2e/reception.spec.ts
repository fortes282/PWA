/**
 * E2E: Reception role smoke tests
 * Tests: dashboard, calendar, appointments, clients, health records, waitlist, billing
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Reception — core pages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "reception");
  });

  test("reception dashboard loads with stats", async ({ page }) => {
    await page.goto("/reception");
    await expect(page.getByRole("heading", { name: /recepce/i })).toBeVisible();
    await expect(page.getByText(/dnešní termíny|klientů/i)).toBeVisible();
  });

  test("calendar page loads with week/month toggle (R1)", async ({ page }) => {
    await page.goto("/reception/calendar");
    await expect(page.getByRole("heading", { name: /kalendář/i })).toBeVisible();
    // Week/month toggle
    await expect(page.getByRole("button", { name: /týden/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /měsíc/i })).toBeVisible();
    // Therapist filter
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("calendar: can switch to month view", async ({ page }) => {
    await page.goto("/reception/calendar");
    await page.getByRole("button", { name: /měsíc/i }).click();
    // Month view shows day-of-week headers
    await expect(page.getByText(/po/i).first()).toBeVisible();
  });

  test("appointments page loads", async ({ page }) => {
    await page.goto("/reception/appointments");
    await expect(page.getByRole("heading", { name: /termíny/i })).toBeVisible();
  });

  test("clients page loads with search", async ({ page }) => {
    await page.goto("/reception/clients");
    await expect(page.getByRole("heading", { name: /klient/i })).toBeVisible();
    await expect(page.getByPlaceholder(/hledat/i)).toBeVisible();
  });

  test("health records page loads (R6)", async ({ page }) => {
    await page.goto("/reception/health-records");
    await expect(page.getByRole("heading", { name: /zdravotní záznamy/i })).toBeVisible();
  });

  test("waitlist page loads", async ({ page }) => {
    await page.goto("/reception/waitlist");
    await expect(page.getByRole("heading", { name: /waitlist/i })).toBeVisible();
  });

  test("billing page loads", async ({ page }) => {
    await page.goto("/reception/billing");
    await expect(page.getByRole("heading", { name: /billing|faktur/i })).toBeVisible();
  });

  test("working hours page loads", async ({ page }) => {
    await page.goto("/reception/working-hours");
    await expect(page.getByRole("heading", { name: /pracovní hodiny/i })).toBeVisible();
  });
});
