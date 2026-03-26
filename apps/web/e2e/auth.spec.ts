/**
 * E2E: Auth flow smoke tests
 * Tests: login, role redirect, logout, route guard
 */
import { test, expect } from "@playwright/test";
import {
  CLIENT_AUTH_FILE,
  ADMIN_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
} from "./helpers";

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
    await page.locator("#password").fill("WrongPass!");
    await page.getByRole("button", { name: /přihlásit/i }).click();
    // Should stay on login page and show an error.
    // Backend may return 401 (invalid credentials) or 429 (rate-limited after
    // repeated failed attempts across parallel test workers) — both are valid
    // error states that keep the user on /login.
    await expect(page).toHaveURL(/\/login/);
    // Scope to login card (not route announcer / other alerts). WebKit may need extra time for framer-motion.
    const loginCard = page.locator(".rounded-2xl.shadow-xl").first();
    const loginAlert = loginCard.getByRole("alert");
    await expect(loginAlert).toBeVisible({ timeout: 25000 });
    await expect(loginAlert).toContainText(
      /neplatné|chyba|error|unauthorized|zablokován|příliš|http\s*401|údaje|přihlášovací|přihlášení|failed|fetch|síť|too\s+many|requests|429/i
    );
  });

});

// Žádné další POST /auth/login — session z auth.setup.ts (šetří login rate limit na deployi).
test.describe("Auth — role home with saved session", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });
  test("CLIENT lands on /client", async ({ page }) => {
    await page.goto("/client");
    await expect(page).toHaveURL(/\/client/);
  });
});

test.describe("Auth — RECEPTION home", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });
  test("RECEPTION lands on /reception", async ({ page }) => {
    await page.goto("/reception");
    await expect(page).toHaveURL(/\/reception/);
  });
});

test.describe("Auth — EMPLOYEE home", () => {
  test.use({ storageState: EMPLOYEE_AUTH_FILE });
  test("EMPLOYEE lands on /employee", async ({ page }) => {
    await page.goto("/employee");
    await expect(page).toHaveURL(/\/employee/);
  });
});

test.describe("Auth — ADMIN home", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });
  test("ADMIN lands on /admin", async ({ page }) => {
    await page.goto("/admin");
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
    // On mobile (<md breakpoint) the CLIENT layout hides the sidebar and shows
    // a bottom tab bar. Logout lives inside the "Více" bottom sheet.
    // On desktop logout is directly in the sidebar — no sheet needed.
    //
    // Use waitFor() instead of isVisible() — isVisible() is a synchronous
    // immediate check that returns false during React hydration, causing
    // flaky failures on iphone/android projects before the tab bar renders.
    const moreTab = page.getByRole("button", { name: /^více$/i });
    const moreVisible = await moreTab
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (moreVisible) {
      await moreTab.click();
      // Wait for the Framer Motion sheet animation to finish before clicking.
      await page.getByTestId("more-sheet").waitFor({ state: "visible", timeout: 3000 });
    }
    await page.getByRole("button", { name: /odhlásit/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
