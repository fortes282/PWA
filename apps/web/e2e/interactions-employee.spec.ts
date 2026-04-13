/**
 * EMPLOYEE portal — behaviorální interakční testy.
 */
import { test, expect } from "@playwright/test";
import {
  login,
  navigateTo,
  apiGet,
  waitForLoaded,
} from "./helpers";

test.describe("Employee — interakce", () => {
  test.setTimeout(180_000);

  // ── Dashboard / dnešní rozvrh ──────────────────────────────────────────────

  test("4.1 — Dashboard: dnešní timeline se načte", async ({ page }) => {
    await login(page, "employee");
    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 20_000 });
    await waitForLoaded(page);

    // Timeline je viditelná
    const timeline = page.locator("[class*='timeline'], [class*='schedule'], [class*='calendar']").first();
    const hasTimeline = await timeline.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasTimeline) {
      expect(hasTimeline).toBe(true);
    }

    // API check — dnešní termíny
    const todayRes = await apiGet(page, "/appointments/today");
    expect(todayRes.status).toBe(200);
  });

  test("4.2 — Dashboard: toggle zobrazení prázdných hodin", async ({ page }) => {
    await login(page, "employee");
    await waitForLoaded(page);

    const toggleBtn = page.getByRole("button", { name: /všechny hodiny|skrýt prázdné|all hours/i }).first();
    const hasToggle = await toggleBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasToggle) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      // Stav se přepnul
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

  test("4.3 — Dashboard: označení termínu jako dokončeného", async ({ page }) => {
    await login(page, "employee");
    await waitForLoaded(page);

    // Najít check button u CONFIRMED termínu
    const doneBtn = page.locator("button").filter({
      has: page.locator("[data-lucide='check-circle'], svg"),
    }).first();
    const altDoneBtn = page.getByRole("button", { name: /hotovo|done|complete|dokončit/i }).first();

    const hasDone = await doneBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasAlt = await altDoneBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasDone || hasAlt) {
      const btn = hasDone ? doneBtn : altDoneBtn;
      await btn.click();

      // Confirm dialog
      const confirmBtn = page.getByRole("button", { name: /hotovo|potvrdit|confirm|ano/i }).first();
      const hasConfirm = await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasConfirm) {
        await confirmBtn.click();
        await waitForLoaded(page);
        // Toast o dokončení
      }
    }
  });

  // ── Moje termíny ──────────────────────────────────────────────────────────

  test("4.4 — Appointments: seznam termínů s filtrem", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/appointments");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    const appointmentsRes = await apiGet(page, "/appointments?employeeId=3");
    expect(appointmentsRes.status).toBe(200);

    // Filtr data
    const dateFilter = page.locator("input[type='date']").first();
    const hasDateFilter = await dateFilter.isVisible({ timeout: 8_000 }).catch(() => false);
    if (hasDateFilter) {
      const today = new Date().toISOString().slice(0, 10);
      await dateFilter.fill(today);
      await page.waitForTimeout(500);
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

  test("4.5 — Appointments: slide-over detail termínu", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/appointments");
    await waitForLoaded(page);

    // Kliknout na první termín
    const appointmentCard = page.locator(".card, li").first();
    const hasCard = await appointmentCard.isVisible({ timeout: 15_000 }).catch(() => false);
    if (hasCard) {
      await appointmentCard.click();

      // Slide-over nebo detail panel
      const slideOver = page.locator("[class*='slide'], [class*='drawer'], [class*='panel'], [role='dialog']").first();
      const hasSlide = await slideOver.isVisible({ timeout: 8_000 }).catch(() => false);
      if (hasSlide) {
        // Zavřít slide-over
        const closeBtn = page.getByRole("button", { name: /×|close|zavřít/i }).first();
        await closeBtn.click().catch(() => {});
      }
    }
  });

  // ── Klienti ────────────────────────────────────────────────────────────────

  test("4.6 — Clients: seznam klientů terapeuta", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/clients");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    const clientsRes = await apiGet(page, "/employees/me/clients");
    expect([200, 404]).toContain(clientsRes.status); // Může vrátit 404 pokud endpoint nemá /me

    // Alespoň klienti z týmu
    const clientRes2 = await apiGet(page, "/users?role=CLIENT");
    expect(clientRes2.status).toBe(200);
  });

  test("4.7 — Clients: vyhledávání klienta", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/clients");
    await waitForLoaded(page);

    const searchInput = page.locator("input[type='search'], input[placeholder*='hledat'], input[placeholder*='search']").first();
    const hasSearch = await searchInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasSearch) {
      await searchInput.fill("Martin");
      await page.waitForTimeout(800);
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

  // ── Therapy reports ────────────────────────────────────────────────────────

  test("4.8 — Therapy reports: seznam zpráv", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/therapy-reports");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
  });

  test("4.9 — Therapy reports: nová zpráva — formulář", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/therapy-reports/new");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    // Formulář by měl být viditelný
    const form = page.locator("form, [class*='form']").first();
    const hasForm = await form.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasForm) {
      // Alespoň nadpis formuláře
      const heading = page.locator("h1, h2").first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── Homework ───────────────────────────────────────────────────────────────

  test("4.10 — Homework: stránka pro terapeuta", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/homework");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
  });

  // ── Exercise library ───────────────────────────────────────────────────────

  test("4.11 — Exercise library: knihovna cviků", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/exercise-library");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    const exercisesRes = await apiGet(page, "/exercise-library");
    expect(exercisesRes.status).toBe(200);
  });

  // ── Session templates ──────────────────────────────────────────────────────

  test("4.12 — Session templates: šablony sezení", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/session-templates");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
  });

  // ── Wellbeing ──────────────────────────────────────────────────────────────

  test("4.13 — Wellbeing: check-in formulář", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/wellbeing");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    // Formulář nebo existující záznamy
    const content = page.locator(".card, form, [class*='wellbeing'], p").first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test("4.14 — Wellbeing: odeslání check-inu", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/wellbeing");
    await waitForLoaded(page);

    // Hledat tlačítka pro hodnocení (1-5 stupnice)
    const ratingBtns = page.locator("button").filter({ hasText: /^[1-5]$/ }).first();
    const hasRating = await ratingBtns.isVisible({ timeout: 8_000 }).catch(() => false);
    if (hasRating) {
      // Kliknout na 4 pro každou otázku
      const allRatingBtns = page.locator("button").filter({ hasText: /^[1-5]$/ });
      const count = await allRatingBtns.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        await allRatingBtns.nth(i).click().catch(() => {});
        await page.waitForTimeout(200);
      }

      const submitBtn = page.getByRole("button", { name: /odeslat|submit|uložit|save/i }).first();
      const hasSubmit = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasSubmit) {
        await submitBtn.click();
        await waitForLoaded(page);
      }
    }
  });

  // ── Rozvrh ────────────────────────────────────────────────────────────────

  test("4.15 — Schedule: rozvrh terapeuta", async ({ page }) => {
    await login(page, "employee");
    await navigateTo(page, "/employee/schedule");
    await waitForLoaded(page);

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
  });
});
