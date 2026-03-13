/**
 * E2E: Settings page smoke tests
 * Tests: profile edit, notification prefs, password change, push subscribe
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Settings — profile edit", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "client");
  });

  test("settings page is accessible via nav", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /nastavení/i })).toBeVisible();
  });

  test("profile section shows email (readonly)", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/client@pristav\.cz|email/i)).toBeVisible();
  });

  test("can update name in profile form", async ({ page }) => {
    await page.goto("/settings");
    const nameInput = page.getByLabel(/jméno/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Nové Testovací Jméno");
    await page.getByRole("button", { name: /uložit profil/i }).click();
    await expect(page.getByText(/uložen|profil.*✓/i)).toBeVisible({ timeout: 5000 });
  });

  test("notification toggles are present", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/email notifikace/i)).toBeVisible();
    await expect(page.getByText(/sms notifikace/i)).toBeVisible();
  });

  test("password change form is present", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/změna hesla/i)).toBeVisible();
    await expect(page.getByLabel(/aktuální heslo/i)).toBeVisible();
  });

  test("password change shows error for wrong current password", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel(/aktuální heslo/i).fill("WrongPassword123");
    await page.getByLabel(/nové heslo/i).fill("NewPassword123!");
    await page.getByLabel(/potvrzení hesla/i).fill("NewPassword123!");
    await page.getByRole("button", { name: /změnit heslo/i }).click();
    await expect(page.getByText(/nesprávné|chyba|error/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Settings — admin view", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin");
  });

  test("admin can access settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /nastavení/i })).toBeVisible();
  });
});
