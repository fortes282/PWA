/**
 * E2E: Settings page smoke tests
 * Tests: profile edit, notification prefs, password change, push subscribe
 *
 * Auth strategy: one login per role/context, fresh page per test.
 * This avoids repeated auth/login requests that would otherwise trip the
 * backend auth rate limit during the settings suite, while still isolating
 * page-level state and route mocks between tests.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, CLIENT_AUTH_FILE, ADMIN_AUTH_FILE } from "./helpers";

/** Inject a full push-capable browser environment mock. */
async function injectPushMocks(page: Page, opts: { alreadySubscribed?: boolean } = {}) {
  const { alreadySubscribed = false } = opts;

  // Navigate BEFORE installing the init script so we use the real navigator.serviceWorker
  // to unregister any active SW. An active SW intercepts fetch() from its own context,
  // bypassing page.route() mocks. Clearing it here ensures subsequent navigations (where
  // the init script is active) go through Playwright's network layer as expected.
  await page.goto("/settings");
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  });

  // Install the mock AFTER unregistering — fires on all subsequent navigations only.
  await page.addInitScript(({ alreadySubscribed }) => {
    const fakeSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/playwright-test-endpoint",
      keys: { p256dh: "playwright-p256dh-key", auth: "playwright-auth-key" },
      toJSON() {
        return { endpoint: this.endpoint, keys: this.keys };
      },
      async unsubscribe() {
        return true;
      },
    };

    const pushManager = {
      async getSubscription() {
        return alreadySubscribed ? fakeSubscription : null;
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
  }, { alreadySubscribed });
}

test.describe.serial("Settings — profile edit", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: CLIENT_AUTH_FILE });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("settings page is accessible via nav", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /nastavení/i })).toBeVisible();
  });

  test("profile section shows email (readonly)", async () => {
    await page.goto("/settings");
    await expect(page.getByText(/klient@pristav\.cz/).first()).toBeVisible();
  });

  test("can update name in profile form", async () => {
    await page.goto("/settings");
    // Wait for page to fully initialize (initial auth uses real API).
    // Then intercept subsequent /auth/refresh calls triggered by handleSaveProfile →
    // refreshUser(), so a race with parallel tests consuming the rotating refresh token
    // cannot clear the user and redirect to /login before the success banner renders.
    const nameInput = page.getByLabel(/jméno/i);
    await expect(nameInput).toBeVisible();

    // Capture the current valid access token from localStorage so the mock can return it.
    // Returning the already-valid access token (rather than a fake one) keeps the session
    // intact for subsequent tests in this serial block — they call loadSession() and find
    // a real, unexpired token and skip cookie-based refresh entirely.
    const currentSession = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("pristav_auth") || "null"); } catch { return null; }
    });

    await page.route(`**/auth/refresh`, async (route) => {
      if (currentSession?.token && currentSession?.user) {
        // Return the existing valid access token — no rotation, no state change.
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: currentSession.token, user: currentSession.user }),
        });
      } else {
        // Fallback: forge a plausible token if localStorage was somehow empty.
        const exp = Math.floor(Date.now() / 1000) + 900;
        const payloadB64 = Buffer.from(
          JSON.stringify({ id: 1, email: "klient@pristav.cz", name: "Testovací Klient", role: "CLIENT", exp })
        ).toString("base64");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payloadB64}.fake`,
            user: { id: 1, email: "klient@pristav.cz", name: "Testovací Klient", role: "CLIENT" },
          }),
        });
      }
    });

    await nameInput.fill("Nové Testovací Jméno");
    await page.getByRole("button", { name: /uložit profil/i }).click();
    await expect(page.getByText(/uložen|profil.*✓/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("notification toggles are present", async () => {
    await page.goto("/settings");
    await expect(page.getByText(/email notifikace/i)).toBeVisible();
    await expect(page.getByText(/sms notifikace/i)).toBeVisible();
  });

  test("password change form is present", async () => {
    await page.goto("/settings");
    await expect(page.getByText(/změna hesla/i)).toBeVisible();
    await expect(page.getByLabel(/aktuální heslo/i)).toBeVisible();
  });

  test("password change shows error for wrong current password", async () => {
    await page.goto("/settings");
    await page.getByLabel(/aktuální heslo/i).fill("WrongPassword123");
    await page.getByLabel(/nové heslo/i).fill("NewPassword123!");
    await page.getByLabel(/potvrzení hesla/i).fill("NewPassword123!");
    await page.getByRole("button", { name: /změnit heslo/i }).click();
    await expect(page.getByText(/nesprávné|chyba|error/i)).toBeVisible({ timeout: 5000 });
  });

  test("can complete push subscription flow when browser + API are available", async () => {
    await context.grantPermissions(["notifications"]);
    await injectPushMocks(page);

    await page.route(`**/push/vapid-public-key`, async (route) => {
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
    await page.route(`**/push/subscribe`, async (route) => {
      subscribePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: /aktivovat/i }).click();

    await expect(page.getByText(/aktivováno/i)).toBeVisible({ timeout: 10000 });
    expect(subscribePayload).toBeTruthy();
    expect(subscribePayload.endpoint).toContain("playwright-test-endpoint");
    expect(subscribePayload.keys.p256dh).toBe("playwright-p256dh-key");
  });

  test("shows already-subscribed state on load when browser has existing subscription", async () => {
    await context.grantPermissions(["notifications"]);
    await injectPushMocks(page, { alreadySubscribed: true });

    await page.goto("/settings");

    await expect(page.getByText(/aktivováno/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /^Odhlásit$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /testovací notifikaci/i })).toBeVisible();
  });

  test("can unsubscribe from push when already subscribed", async () => {
    await context.grantPermissions(["notifications"]);
    await injectPushMocks(page, { alreadySubscribed: true });

    let unsubscribeCalled = false;
    await page.route(`**/push/unsubscribe`, async (route) => {
      unsubscribeCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/settings");
    await expect(page.getByText(/aktivováno/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /^Odhlásit$/ }).click();

    await expect(page.getByRole("button", { name: /aktivovat/i })).toBeVisible({ timeout: 5000 });
    expect(unsubscribeCalled).toBe(true);
  });

  test("can trigger self-test push when subscribed", async () => {
    await context.grantPermissions(["notifications"]);
    await injectPushMocks(page, { alreadySubscribed: true });

    let testCalled = false;
    await page.route(`**/push/test`, async (route) => {
      testCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sent: true, vapidConfigured: true }),
      });
    });

    await page.goto("/settings");
    await expect(page.getByText(/aktivováno/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /testovací notifikaci/i }).click();

    await expect(page.getByText(/testovací notifikace odeslána/i)).toBeVisible({ timeout: 5000 });
    expect(testCalled).toBe(true);
  });

  test("shows server-not-configured message when VAPID not set", async () => {
    await context.grantPermissions(["notifications"]);
    await injectPushMocks(page);

    await page.route(`**/push/vapid-public-key`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false, publicKey: null }),
      });
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: /aktivovat/i }).click();

    await expect(page.getByText(/nejsou nakonfigurovány na serveru/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe.serial("Settings — admin view", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("admin can access settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /nastavení/i })).toBeVisible();
  });
});
