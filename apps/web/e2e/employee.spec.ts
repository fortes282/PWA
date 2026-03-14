/**
 * E2E: Employee role smoke tests
 * Tests: day timeline, appointments, medical reports, colleagues
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Employee — core pages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "employee");
  });

  test("employee dashboard loads with timeline (E1)", async ({ page }) => {
    await page.goto("/employee");
    await expect(page.getByRole("heading", { name: /timeline|rozvrh|terapeut/i })).toBeVisible();
    // Timeline hours 07:00–20:00 should be visible
    await expect(page.getByText(/07:00|08:00/i).first()).toBeVisible();
  });

  test("appointments page loads with client cards (E2)", async ({ page }) => {
    await page.goto("/employee/appointments");
    await expect(page.getByRole("heading", { name: /termíny|appointments/i })).toBeVisible();
  });

  test("medical reports page loads with create form (E3)", async ({ page }) => {
    await page.goto("/employee/reports");
    await expect(page.getByRole("heading", { name: /zpráv|report/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /nová zpráva/i })).toBeVisible();
  });

  test("can open new medical report form", async ({ page }) => {
    await page.goto("/employee/reports");
    await page.getByRole("button", { name: /nová zpráva/i }).click();
    await expect(page.getByLabel(/klient/i)).toBeVisible();
    await expect(page.getByLabel(/název/i)).toBeVisible();
    await expect(page.getByLabel(/obsah/i)).toBeVisible();
  });

  test("colleagues page loads (E4)", async ({ page }) => {
    await page.goto("/employee/colleagues");
    await expect(page.getByRole("heading", { name: /kolegov/i })).toBeVisible();
  });
});
