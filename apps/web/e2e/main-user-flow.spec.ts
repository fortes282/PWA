/**
 * Jeden komplexní E2E smoke: kritický uživatelský flow přes UI + lehký API kontrolní bod.
 * Netestuje „vše přes UI“ — detailní logika patří do Vitestu u jednotek / MSW u komponent.
 *
 * Spuštění: pnpm -C apps/web run test:e2e:prepare && pnpm -C apps/web test:e2e
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login } from "./helpers";

test.describe("Main user flow (CLIENT)", () => {
  test("login → klientská zóna → kredity → API balance → odhlášení", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Přihlášení klienta (seed)", async () => {
      await login(page, "client");
      await expect(page).toHaveURL(/\/client/);
    });

    await test.step("Shell aplikace (obsah v main)", async () => {
      const main = page.locator("main#main-content, main").first();
      await expect(main).toBeVisible({ timeout: 20_000 });
    });

    await test.step("Accessibility (axe) — /client", async () => {
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      expect(
        critical,
        `Critical a11y: ${JSON.stringify(critical.map((v) => v.id), null, 2)}`,
      ).toEqual([]);
    });

    await test.step("Stránka kreditů (client-side navigace — zachová AuthContext)", async () => {
      await page.getByRole("link", { name: /^finance$/i }).first().click();
      await expect(page).toHaveURL(/\/client\/credits/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: /^Kredity$/i })).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.locator("main").first()).toBeVisible();
      const card = page.locator("main .card").filter({ hasText: /Aktuální zůstatek|zůstatek/i }).first();
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toContainText(/\d/, { timeout: 25_000 });
    });

    await test.step("API GET /api/credits/balance (stejná session jako stránka)", async () => {
      const res = await page.request.get("/api/credits/balance");
      expect(res.ok(), `HTTP ${res.status()}: ${await res.text()}`).toBeTruthy();
      const data = (await res.json()) as { balance?: unknown };
      expect(typeof data.balance).toBe("number");
      expect(Number.isFinite(data.balance as number)).toBe(true);
    });

    await test.step("Odhlášení", async () => {
      await page.goto("/client", { waitUntil: "domcontentloaded" });

      const moreTab = page.getByRole("button", { name: /^více$/i });
      const moreVisible = await moreTab
        .waitFor({ state: "visible", timeout: 4_000 })
        .then(() => true)
        .catch(() => false);
      if (moreVisible) {
        await moreTab.click();
        await page.getByTestId("more-sheet").waitFor({ state: "visible", timeout: 4_000 });
      }

      await page.getByRole("button", { name: /odhlásit/i }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  });
});
