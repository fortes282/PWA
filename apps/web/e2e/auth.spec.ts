/**
 * E2E: Auth flow smoke tests
 * Tests: login, role redirect, logout, route guard
 */
import { test, expect } from "@playwright/test";
import { login, USERS, CLIENT_AUTH_FILE } from "./helpers";

test.describe("Auth — login", () => {
  test("shows login page at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /přístav radosti/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /přihlásit/i })).toBeVisible();
  });

  test("root / shows landing page with login CTA when not authenticated", async ({ page }) => {
    await page.goto("/");
    // Landing page should be shown — either stays at / or shows login CTA
    await expect(page.getByRole("link", { name: /přihlásit se/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill("wrong@example.com");
    await page.locator('input[type="password"]').fill("WrongPass!");
    await page.getByRole("button", { name: /přihlásit/i }).click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/neplatné|chyba|error|unauthorized/i)).toBeVisible();
  });

  test("CLIENT logs in and lands on /client", async ({ page }) => {
    await login(page, "client");
    await expect(page).toHaveURL(/\/client/);
  });

  test("RECEPTION logs in and lands on /reception", async ({ page }) => {
    await login(page, "reception");
    await expect(page).toHaveURL(/\/reception/);
  });

  test("EMPLOYEE logs in and lands on /employee", async ({ page }) => {
    await login(page, "employee");
    await expect(page).toHaveURL(/\/employee/);
  });

  test("ADMIN logs in and lands on /admin", async ({ page }) => {
    await login(page, "admin");
    await expect(page).toHaveURL(/\/admin/);
  });
});

test.describe("Auth — route guard", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("CLIENT cannot access /admin (redirect to /unauthorized)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("CLIENT cannot access /reception (redirect to /unauthorized)", async ({ page }) => {
    await page.goto("/reception");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("Auth — logout", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("user can log out and is redirected to /login", async ({ page }) => {
    await page.goto("/client");
    // Find logout button in layout
    await page.getByRole("button", { name: /odhlásit|logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
