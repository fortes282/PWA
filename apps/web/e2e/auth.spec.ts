/**
 * E2E: Auth flow smoke tests
 * Tests: login, role redirect, logout, route guard
 */
import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Auth — login", () => {
  test("shows login page at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /přístav radosti/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /přihlásit/i })).toBeVisible();
  });

  test("root / redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill("wrong@example.com");
    await page.getByLabel(/heslo/i).fill("WrongPass!");
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
  test("CLIENT cannot access /admin (redirect to /unauthorized)", async ({ page }) => {
    await login(page, "client");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("CLIENT cannot access /reception (redirect to /unauthorized)", async ({ page }) => {
    await login(page, "client");
    await page.goto("/reception");
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});

test.describe("Auth — logout", () => {
  test("user can log out and is redirected to /login", async ({ page }) => {
    await login(page, "client");
    // Find logout button in layout
    await page.getByRole("button", { name: /odhlásit|logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
