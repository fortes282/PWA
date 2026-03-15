/**
 * E2E: Settings page smoke tests
 * Tests: profile edit, notification prefs, password change, push subscribe
 */
import { test, expect } from "@playwright/test";
import { API_URL, login } from "./helpers";

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
    // The client user's email is klient@pristav.cz (shown as readonly in profile)
    await expect(page.getByText(/klient@pristav\.cz/).first()).toBeVisible();
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

  test("can complete push subscription flow when browser + API are available", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);

    await page.addInitScript(() => {
      const fakeSubscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/playwright-test-endpoint",
        keys: {
          p256dh: "playwright-p256dh-key",
          auth: "playwright-auth-key",
        },
        toJSON() {
          return {
            endpoint: this.endpoint,
            keys: this.keys,
          };
        },
      };

      const pushManager = {
        async getSubscription() {
          return null;
        },
        async subscribe() {
          return fakeSubscription;
        },
      };

      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: function PushManager() {},
      });

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register: async () => ({ scope: "/" }),
          ready: Promise.resolve({ pushManager }),
        },
      });
    });

    await page.route(`${API_URL}/push/vapid-public-key`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          publicKey: "BJfagHnmHxjgxuSyqnTAR-eXYsNEYfERqFjnLoBT7Ky4s-jHBXJgKh0kKhlQQRaA1GMv2jk4VtRXA3vhFNLHDo",
        }),
      });
    });

    let subscribePayload: any = null;
    await page.route(`${API_URL}/push/subscribe`, async (route) => {
      subscribePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: /aktivovat/i }).click();

    await expect(page.getByText(/aktivováno/i)).toBeVisible({ timeout: 5000 });
    expect(subscribePayload).toBeTruthy();
    expect(subscribePayload.endpoint).toContain("playwright-test-endpoint");
    expect(subscribePayload.keys.p256dh).toBe("playwright-p256dh-key");
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
