/**
 * Authentication E2E tests — login, logout, session, RBAC, API auth.
 * Covers all roles and access-control scenarios for Pristav Radosti.
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

/* ------------------------------------------------------------------ */
/*  1. Login all roles                                                */
/* ------------------------------------------------------------------ */

test.describe("Login all roles", () => {
  const rolePaths: Record<string, RegExp> = {
    client: /\/client/,
    reception: /\/reception/,
    employee: /\/employee/,
    admin: /\/admin/,
  };

  for (const role of ["client", "reception", "employee", "admin"] as const) {
    test(`${role} can login, see content, and logout`, async ({ page }) => {
      test.setTimeout(120_000);

      await test.step("Login", async () => {
        await login(page, role);
        await expect(page).toHaveURL(rolePaths[role]);
      });

      await test.step("Main content visible", async () => {
        const main = page.locator("main").first();
        await expect(main).toBeVisible({ timeout: 20_000 });
        await waitForLoaded(page);
      });

      await test.step("Logout", async () => {
        await logout(page);
        await expect(page).toHaveURL(/\/login/);
      });
    });
  }
});

/* ------------------------------------------------------------------ */
/*  2. Invalid credentials                                            */
/* ------------------------------------------------------------------ */

test.describe("Invalid credentials", () => {
  test("wrong password stays on /login with error", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Submit wrong password", async () => {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
      await page.locator("#email").fill(USERS.client.email);
      await page.locator("#password").fill("WrongPassword999!");
      await page.getByRole("button", { name: /přihlásit/i }).click();
    });

    await test.step("Still on /login with error message", async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      const error = page.locator('[role="alert"], .text-red-500, .text-destructive, [data-testid="error"]').first();
      await expect(error).toBeVisible({ timeout: 15_000 });
    });
  });

  test("non-existent email stays on /login with error", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Submit non-existent email", async () => {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
      await page.locator("#email").fill("neexistuje@pristav.cz");
      await page.locator("#password").fill("SomePassword123!");
      await page.getByRole("button", { name: /přihlásit/i }).click();
    });

    await test.step("Still on /login with error message", async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
      const error = page.locator('[role="alert"], .text-red-500, .text-destructive, [data-testid="error"]').first();
      await expect(error).toBeVisible({ timeout: 15_000 });
    });
  });

  test("empty fields — button disabled or validation error", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Navigate to login page", async () => {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
    });

    await test.step("Button disabled or validation fires on empty submit", async () => {
      const submitBtn = page.getByRole("button", { name: /přihlásit/i });
      const isDisabled = await submitBtn.isDisabled();

      if (isDisabled) {
        expect(isDisabled).toBe(true);
      } else {
        // Button is enabled — click it and expect validation error
        await submitBtn.click();
        const validation = page.locator(
          '[role="alert"], .text-red-500, .text-destructive, [data-testid="error"], :invalid',
        ).first();
        await expect(validation).toBeVisible({ timeout: 10_000 });
        await expect(page).toHaveURL(/\/login/);
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/*  3. Session persistence                                            */
/* ------------------------------------------------------------------ */

test.describe("Session", () => {
  test("session survives page reload", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as client", async () => {
      await login(page, "client");
    });

    await test.step("Navigate to /client/credits", async () => {
      await navigateTo(page, "/client/credits");
      await expect(page).toHaveURL(/\/client\/credits/);
    });

    await test.step("Reload — still on /client/credits", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForLoaded(page);
      await expect(page).toHaveURL(/\/client\/credits/, { timeout: 15_000 });
    });
  });

  test("API /auth/me returns correct role after login", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as client", async () => {
      await login(page, "client");
    });

    await test.step("GET /auth/me returns user data with CLIENT role", async () => {
      const { status, data } = await apiGet(page, "/auth/me");
      expect(status).toBe(200);
      expect(data).toBeTruthy();
      expect(data.role).toBe("CLIENT");
      expect(data.email).toBe(USERS.client.email);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  4. Route protection (RBAC)                                        */
/* ------------------------------------------------------------------ */

test.describe("Route protection", () => {
  test("unauthenticated → /client redirects to /login", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("unauthenticated → /admin redirects to /login", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("client → /admin redirects to /unauthorized", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as client", async () => {
      await login(page, "client");
    });

    await test.step("Navigate to /admin — redirected to /unauthorized", async () => {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/unauthorized/, { timeout: 20_000 });
    });
  });

  test("client → /reception redirects to /unauthorized", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as client", async () => {
      await login(page, "client");
    });

    await test.step("Navigate to /reception — redirected to /unauthorized", async () => {
      await page.goto("/reception", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/unauthorized/, { timeout: 20_000 });
    });
  });

  test("employee → /admin redirects to /unauthorized", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as employee", async () => {
      await login(page, "employee");
    });

    await test.step("Navigate to /admin — redirected to /unauthorized", async () => {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/unauthorized/, { timeout: 20_000 });
    });
  });

  test("reception → /admin redirects to /unauthorized", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as reception", async () => {
      await login(page, "reception");
    });

    await test.step("Navigate to /admin — redirected to /unauthorized", async () => {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/unauthorized/, { timeout: 20_000 });
    });
  });
});

/* ------------------------------------------------------------------ */
/*  5. API authentication                                             */
/* ------------------------------------------------------------------ */

test.describe("API authentication", () => {
  test("no auth → GET /api/auth/me → 401", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Request without session returns 401", async () => {
      // Ensure no session — go to login page (no cookies from login)
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      // Clear any cookies to guarantee unauthenticated state
      await page.context().clearCookies();

      const res = await page.request.get("/api/auth/me");
      expect(res.status()).toBe(401);
    });
  });

  test("authenticated → GET /api/auth/me → 200 with correct email", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as client", async () => {
      await login(page, "client");
    });

    await test.step("GET /api/auth/me returns 200 with email", async () => {
      const res = await page.request.get("/api/auth/me");
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.email).toBe(USERS.client.email);
    });
  });

  test("logout via API → session invalidated", async ({ page }) => {
    test.setTimeout(120_000);

    await test.step("Login as client", async () => {
      await login(page, "client");
    });

    await test.step("POST /api/auth/logout → 200", async () => {
      const res = await page.request.post("/api/auth/logout", { data: {} });
      expect(res.status()).toBe(200);
    });

    await test.step("GET /api/auth/me → 401 after logout", async () => {
      const res = await page.request.get("/api/auth/me");
      expect(res.status()).toBe(401);
    });
  });
});
