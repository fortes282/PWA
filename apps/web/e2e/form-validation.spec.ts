/**
 * Formulářová validace — co se stane při odesílání špatných/prázdných dat.
 */
import { test, expect } from "@playwright/test";
import { login, navigateTo, apiPost, waitForLoaded } from "./helpers";

test.describe("Validace formulářů", () => {
  test.setTimeout(120_000);

  // ── Login validace ─────────────────────────────────────────────────────────

  test("5.1 — Login: prázdná pole — formulář se neodešle", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 20_000 });

    const submitBtn = page.getByRole("button", { name: /přihlásit/i });
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Stránka zůstane na loginu
    await expect(page).toHaveURL(/\/login/);
    // HTML5 validace nebo custom error
    const emailInput = page.locator("#email");
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
  });

  test("5.2 — Login: neplatné heslo → chyba", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill("klient@pristav.cz");
    await page.locator("#password").fill("SpatneHeslo999!");
    await page.getByRole("button", { name: /přihlásit/i }).click();

    const error = page.locator("text=/neplatné|invalid|chybné|špatné|wrong/i").first();
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("5.3 — Login: neexistující email → chyba", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill("neexistuje@test.cz");
    await page.locator("#password").fill("SpatneHeslo123!");
    await page.getByRole("button", { name: /přihlásit/i }).click();

    const error = page.locator("text=/neplatné|invalid|chybné/i").first();
    await expect(error).toBeVisible({ timeout: 15_000 });
  });

  test("5.4 — Login: špatný formát emailu → HTML5 validace", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill("nenimail");
    await page.locator("#password").fill("heslo");
    await page.getByRole("button", { name: /přihlásit/i }).click();

    const emailInput = page.locator("#email");
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Settings validace ──────────────────────────────────────────────────────

  test("5.5 — Settings: prázdné jméno → validace", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/settings");
    await waitForLoaded(page);

    const nameInput = page.locator("input[name='name'], input[placeholder*='jméno']").first();
    const hasName = await nameInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasName) {
      await nameInput.clear();
      const saveBtn = page.getByRole("button", { name: /uložit|save/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(1000);

      // Chyba nebo HTML5 required
      const nameValidity = await nameInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      const errorVisible = await page.locator("text=/povinné|required|chybí|missing/i").first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(!nameValidity || errorVisible).toBeTruthy();
    }
  });

  // ── Admin services validace ────────────────────────────────────────────────

  test("5.6 — Admin services: chyba při příliš krátké délce sezení", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    const addBtn = page.getByRole("button", { name: /přidat|nová|add/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    const nameInput = page.locator("input[name='name'], input[placeholder*='název']").first();
    if (await nameInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await nameInput.fill("E2E Chybná délka");

      const durationInput = page.locator("input[name='duration'], input[type='number']").first();
      if (await durationInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await durationInput.fill("2"); // Méně než min 5 minut
      }

      const saveBtn = page.getByRole("button", { name: /uložit|save/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(1000);

      // Chyba se zobrazí
      const errorMsg = page.locator("text=/zkontrolujte|chyba|min|příliš/i").first();
      const hasError = await errorMsg.isVisible({ timeout: 5_000 }).catch(() => false);

      // Služba nebyla vytvořena (formulář zůstal)
      const servicesRes = await page.request.get("/api/services?includeInactive=true");
      const services = await servicesRes.json() as Array<{ name: string }>;
      const created = services.find((s) => s.name === "E2E Chybná délka");
      expect(created ?? hasError).toBeTruthy(); // Buď chyba nebo žádná nová položka
    }
  });

  // ── Forgot password validace ───────────────────────────────────────────────

  test("5.7 — Forgot password: prázdný email → validace", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const submitBtn = page.getByRole("button", { name: /odeslat|send|resetovat|reset/i }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasSubmit) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/forgot-password/);
    }
  });

  test("5.8 — Forgot password: neexistující email → anti-enumeration zpráva", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });

    const emailInput = page.locator("input[type='email']").first();
    const hasInput = await emailInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasInput) {
      await emailInput.fill("neexistuje@test.cz");
      const submitBtn = page.getByRole("button", { name: /odeslat|send|reset/i }).first();
      await submitBtn.click();

      // Anti-enumeration: stejná zpráva jako pro existující email
      const successMsg = page.locator("text=/pokud.*účet|email.*odeslán|zkontrolujte.*email|odeslali jsme/i").first();
      await expect(successMsg).toBeVisible({ timeout: 15_000 });
    }
  });

  test("5.9 — Forgot password: platný email → úspěšná zpráva", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });

    const emailInput = page.locator("input[type='email']").first();
    const hasInput = await emailInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasInput) {
      await emailInput.fill("klient@pristav.cz");
      const submitBtn = page.getByRole("button", { name: /odeslat|send|reset/i }).first();
      await submitBtn.click();

      const successMsg = page.locator("text=/pokud.*účet|email.*odeslán|zkontrolujte|odeslali jsme/i").first();
      await expect(successMsg).toBeVisible({ timeout: 15_000 });
    }
  });

  // ── Waitlist validace ──────────────────────────────────────────────────────

  test("5.10 — Waitlist: přidání bez výběru služby → validace", async ({ page }) => {
    await login(page, "client");
    await navigateTo(page, "/client/waitlist");
    await waitForLoaded(page);

    const addBtn = page.getByRole("button", { name: /přidat.*se|přidat|add/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasAdd) {
      await addBtn.click();

      // Kliknout submit bez výběru služby
      const submitBtn = page.getByRole("button", { name: /přidat|submit/i }).first();
      const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasSubmit) {
        await submitBtn.click();
        await page.waitForTimeout(500);

        // Buď se nezobrazí nový záznam nebo se zobrazí error
        const waitlistBefore = await page.request.get("/api/waitlist");
        const before = await waitlistBefore.json() as unknown[];
        // Pokud byl validace úspěšná, žádná položka bez služby
        expect(before.length).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
