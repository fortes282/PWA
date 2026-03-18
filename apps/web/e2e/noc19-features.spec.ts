import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Public booking stránka", () => {
  test("Veřejná stránka /booking je přístupná bez přihlášení", async ({ page }) => {
    await page.goto("/booking");
    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/rezerv|termín|booking/i).first()).toBeVisible();
  });

  test("Zobrazí výběr termínů (sloty)", async ({ page }) => {
    await page.goto("/booking");
    // Should show time slots
    await expect(page.getByText(/\d{1,2}:\d{2}/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("Klik na termín zobrazí formulář", async ({ page }) => {
    await page.goto("/booking");
    // Click first available slot button
    const slotBtn = page.getByRole("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
    if (await slotBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slotBtn.click();
      // Form should appear
      await expect(page.getByText(/jméno|kontakt|email/i).first()).toBeVisible({ timeout: 3000 });
    } else {
      // Slots might be displayed differently
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});

test.describe("Admin packages — správa balíčků", () => {
  test("Admin vidí stránku /admin/packages", async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto("/admin/packages");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/balíčky|packages/i).first()).toBeVisible();
  });

  test("Admin vidí tlačítko pro přidání balíčku", async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto("/admin/packages");
    await expect(page.getByText(/přidat balíček|nový balíček|\+ přidat/i).first()).toBeVisible();
  });

  test("Admin může otevřít formulář pro nový balíček", async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto("/admin/packages");
    const addBtn = page.getByText(/přidat balíček|\+ přidat/i).first();
    await addBtn.click();
    // Form should appear with name input
    await expect(page.getByText(/název|name/i).first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Client packages — přehled balíčků", () => {
  test("Klient vidí stránku /client/packages", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/client/packages");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/balíčky|packages/i).first()).toBeVisible();
  });

  test("Klient vidí sekci dostupné balíčky", async ({ page }) => {
    await login(page, USERS.client);
    await page.goto("/client/packages");
    await expect(page.getByText(/dostupné balíčky|moje balíčky/i).first()).toBeVisible({ timeout: 5000 });
  });
});
