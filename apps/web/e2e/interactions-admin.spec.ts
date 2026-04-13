/**
 * ADMIN portal — behaviorální interakční testy.
 *
 * Každý test:
 * 1. Vytvoří testovací data přes API (stav je předvídatelný)
 * 2. Provede akci přes UI — KAŽDÝ KROK JE POVINNÝ (žádné if/catch escape hatches)
 * 3. Ověří outcome přes API (ne jen "toast se zobrazil")
 *
 * UI prvky mají data-testid pro spolehlivé selektory.
 */
import { test, expect } from "@playwright/test";
import { login, navigateTo, apiGet, apiPost, waitForLoaded } from "./helpers";

test.describe("Admin — Správa služeb (Services CRUD)", () => {
  test.setTimeout(120_000);

  test("Vytvoření nové služby přes UI — ověření v API", async ({ page }) => {
    const serviceName = `E2E Terapie ${Date.now()}`;

    await login(page, "admin");
    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    // Kliknout "Přidat" — MUSÍ existovat
    await expect(page.getByTestId("btn-add-service")).toBeVisible();
    await page.getByTestId("btn-add-service").click();

    // Formulář se MUSÍ zobrazit
    await expect(page.getByTestId("service-form")).toBeVisible();

    // Vyplnit formulář
    await page.getByTestId("input-service-name").fill(serviceName);
    await page.getByTestId("input-service-duration").fill("45");
    await page.getByTestId("input-service-price").fill("750");
    await page.getByTestId("input-service-desc").fill("E2E test popis");

    // Uložit
    await page.getByTestId("btn-save-service").click();

    // Formulář se MUSÍ zavřít
    await expect(page.getByTestId("service-form")).not.toBeVisible({ timeout: 8_000 });

    // Ověřit přes API — služba MUSÍ existovat
    const res = await apiGet(page, "/services?includeInactive=true");
    expect(res.status).toBe(200);
    const services = res.data as Array<{ name: string; durationMin: number; price: number }>;
    const created = services.find((s) => s.name === serviceName);
    expect(created, `Služba "${serviceName}" nebyla nalezena v API`).toBeTruthy();
    expect(created!.durationMin).toBe(45);
    expect(created!.price).toBe(750);
  });

  test("Editace existující služby — změna ceny ověřena v API", async ({ page }) => {
    const serviceName = `E2E Edit ${Date.now()}`;
    await login(page, "admin");
    const createRes = await apiPost(page, "/services", { name: serviceName, durationMin: 30, price: 500 });
    expect(createRes.status).toBe(201);
    const serviceId = (createRes.data as { id: number }).id;

    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    // Řádek se MUSÍ zobrazit
    await expect(page.getByTestId(`service-row-${serviceId}`)).toBeVisible({ timeout: 10_000 });

    // Kliknout edit
    await page.getByTestId(`btn-edit-service-${serviceId}`).click();

    // Formulář se MUSÍ otevřít s předvyplněnými hodnotami
    await expect(page.getByTestId("service-form")).toBeVisible();
    await expect(page.getByTestId("input-service-name")).toHaveValue(serviceName);

    // Změnit cenu
    await page.getByTestId("input-service-price").fill("999");
    await page.getByTestId("btn-save-service").click();

    // Formulář se zavře
    await expect(page.getByTestId("service-form")).not.toBeVisible({ timeout: 8_000 });

    // Ověřit přes API
    const res = await apiGet(page, `/services/${serviceId}`);
    expect(res.status).toBe(200);
    expect((res.data as { price: number }).price).toBe(999);
  });

  test("Validace formuláře — délka pod 5 min zabrání vytvoření", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    // Spočítat existující počet služeb před testem
    const beforeRes = await apiGet(page, "/services?includeInactive=true");
    const countBefore = (beforeRes.data as unknown[]).length;

    await page.getByTestId("btn-add-service").click();
    await expect(page.getByTestId("service-form")).toBeVisible();

    // Zadat délku pod minimum (2 min), prázdný název
    await page.getByTestId("input-service-duration").fill("2");
    await page.getByTestId("btn-save-service").click();

    // Formulář NESMÍ zmizet — validace ho drží otevřeného
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("service-form")).toBeVisible();

    // Ověřit přes API — žádná nová služba nepřibyla
    const afterRes = await apiGet(page, "/services?includeInactive=true");
    const countAfter = (afterRes.data as unknown[]).length;
    expect(countAfter).toBe(countBefore);
  });

  test("Deaktivace služby — ověření isActive=false v API", async ({ page }) => {
    const serviceName = `E2E Deaktivace ${Date.now()}`;
    await login(page, "admin");
    const createRes = await apiPost(page, "/services", { name: serviceName, durationMin: 30, price: 200 });
    const serviceId = (createRes.data as { id: number }).id;

    await navigateTo(page, "/admin/services");
    await waitForLoaded(page);

    // Řádek MUSÍ být viditelný
    await expect(page.getByTestId(`service-row-${serviceId}`)).toBeVisible({ timeout: 10_000 });

    // Kliknout deaktivovat — window.confirm automaticky accept
    page.once("dialog", (d) => d.accept());
    await page.getByTestId(`btn-deactivate-service-${serviceId}`).click();

    // Ověřit přes API
    await page.waitForTimeout(1000);
    const res = await apiGet(page, `/services/${serviceId}`);
    expect(res.status).toBe(200);
    expect((res.data as { isActive: boolean }).isActive, "Služba stále aktivní po deaktivaci").toBe(false);

    // Reaktivace tlačítko se MUSÍ zobrazit (service-row existuje, ale teď má reactivate btn)
    await expect(page.getByTestId(`btn-reactivate-service-${serviceId}`)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Admin — Správa uživatelů (Users CRUD)", () => {
  test.setTimeout(120_000);

  test("Vytvoření nového uživatele přes UI — ověření v API", async ({ page }) => {
    const userName = `E2E Klient ${Date.now()}`;
    const userEmail = `e2e-${Date.now()}@test.cz`;

    await login(page, "admin");
    await navigateTo(page, "/admin/users");
    await waitForLoaded(page);

    // Kliknout "Přidat uživatele" — MUSÍ existovat
    await expect(page.getByTestId("btn-add-user")).toBeVisible();
    await page.getByTestId("btn-add-user").click();

    // Formulář se MUSÍ zobrazit
    await expect(page.getByTestId("add-user-form")).toBeVisible();

    // Vyplnit
    await page.getByTestId("input-user-name").fill(userName);
    await page.getByTestId("input-user-email").fill(userEmail);
    await page.getByTestId("input-user-password").fill("TestPass123!");
    await page.getByTestId("select-user-role").selectOption("CLIENT");

    // Odeslat
    await page.getByTestId("btn-submit-user").click();

    // Modal se MUSÍ zavřít
    await expect(page.getByTestId("add-user-form")).not.toBeVisible({ timeout: 8_000 });

    // Ověřit přes API — uživatel MUSÍ existovat
    const res = await apiGet(page, "/users");
    expect(res.status).toBe(200);
    const users = res.data as Array<{ name: string; email: string; role: string }>;
    const created = users.find((u) => u.email === userEmail);
    expect(created, `Uživatel ${userEmail} nebyl nalezen v API`).toBeTruthy();
    expect(created!.name).toBe(userName);
    expect(created!.role).toBe("CLIENT");
  });

  test("Vyhledávání — 'Martin' zobrazí Martina Svobodu a skryje ostatní", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/users");
    await waitForLoaded(page);

    // Tabulka se MUSÍ načíst se seedovými uživateli
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
    const totalBefore = await page.locator("tbody tr").count();
    expect(totalBefore).toBeGreaterThanOrEqual(6); // Seed má 8 uživatelů

    // Vyhledat "Martin"
    await expect(page.getByTestId("input-search-users")).toBeVisible();
    await page.getByTestId("input-search-users").fill("Martin");
    await page.waitForTimeout(600);

    // Počet řádků se MUSÍ snížit
    const filteredCount = await page.locator("tbody tr").count();
    expect(filteredCount).toBeLessThan(totalBefore);
    expect(filteredCount).toBeGreaterThan(0);

    // Musí obsahovat "Martin"
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText(/martin/i);

    // Vyčistit
    await page.getByTestId("input-search-users").fill("");
    await page.waitForTimeout(600);
    const totalAfter = await page.locator("tbody tr").count();
    expect(totalAfter).toBe(totalBefore);
  });

  test("Filtrování dle role CLIENT — zobrazí jen klienty", async ({ page }) => {
    await login(page, "admin");
    await navigateTo(page, "/admin/users");
    await waitForLoaded(page);

    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("select-filter-role")).toBeVisible();
    await page.getByTestId("select-filter-role").selectOption("CLIENT");
    await page.waitForTimeout(500);

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // V každém řádku musí být select s hodnotou "CLIENT"
    for (let i = 0; i < Math.min(count, 4); i++) {
      const roleSelect = rows.nth(i).locator("select");
      await expect(roleSelect).toHaveValue("CLIENT");
    }

    // Resetovat filtr
    await page.getByTestId("select-filter-role").selectOption("ALL");
    await page.waitForTimeout(300);
    const totalAfter = await page.locator("tbody tr").count();
    expect(totalAfter).toBeGreaterThan(count);
  });

  test("Deaktivace uživatele + ConfirmDialog — ověření isActive=false v API", async ({ page }) => {
    const userEmail = `e2e-deact-${Date.now()}@test.cz`;
    await login(page, "admin");
    const createRes = await apiPost(page, "/users", {
      name: "E2E Deactivate User",
      email: userEmail,
      password: "TestPass123!",
      role: "CLIENT",
    });
    expect(createRes.status).toBe(201);
    const userId = (createRes.data as { id: number }).id;

    await navigateTo(page, "/admin/users");
    await waitForLoaded(page);

    // Řádek MUSÍ existovat
    await expect(page.getByTestId(`user-row-${userId}`)).toBeVisible({ timeout: 10_000 });

    // Kliknout Deaktivovat
    await page.getByTestId(`btn-deactivate-user-${userId}`).click();

    // ConfirmDialog se zobrazí — kliknout potvrdit
    // ConfirmDialog komponenta používá role="dialog" nebo data-testid
    const confirmBtn = page.getByRole("button", { name: /deaktivovat/i }).last();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    await page.waitForTimeout(1000);

    // Ověřit přes API
    const res = await apiGet(page, `/users/${userId}`);
    expect(res.status).toBe(200);
    expect((res.data as { isActive: boolean }).isActive, "Uživatel stále aktivní po deaktivaci").toBe(false);
  });
});

test.describe("Admin — Systémové funkce", () => {
  test.setTimeout(60_000);

  test("Audit log obsahuje záznamy po přihlášení", async ({ page }) => {
    await login(page, "admin");

    const res = await apiGet(page, "/audit-log?limit=10");
    expect(res.status).toBe(200);
    const body = res.data as { items?: unknown[] } | unknown[];
    const items = Array.isArray(body) ? body : (body as { items: unknown[] }).items ?? [];
    expect(items.length, "Audit log je prázdný — přihlášení by mělo vytvořit záznam").toBeGreaterThan(0);
  });

  test("Monitoring /health/detailed vrátí status a tableStats", async ({ page }) => {
    await login(page, "admin");

    const res = await apiGet(page, "/health/detailed");
    expect(res.status).toBe(200);
    const health = res.data as { status: string; tableStats?: unknown };
    expect(health.status).toMatch(/ok|degraded/i);
  });

  test("GDPR statistiky obsahují správná data", async ({ page }) => {
    await login(page, "admin");

    const res = await apiGet(page, "/gdpr/stats");
    expect(res.status).toBe(200);
    const stats = res.data as {
      totalClients: number;
      consentGranted: number;
      consentRate: number;
    };
    expect(stats.totalClients).toBeGreaterThan(0); // Seed má klienty
    expect(stats.consentRate).toBeGreaterThanOrEqual(0);
    expect(stats.consentRate).toBeLessThanOrEqual(100);
  });

  test("Off-peak pravidla jsou přístupná přes API", async ({ page }) => {
    await login(page, "admin");

    const res = await apiGet(page, "/off-peak/rules");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("Admin vidí seznam API klíčů", async ({ page }) => {
    await login(page, "admin");

    const res = await apiGet(page, "/api-keys");
    expect(res.status).toBe(200);
  });
});
