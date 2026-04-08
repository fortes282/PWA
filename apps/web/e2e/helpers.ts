/**
 * Minimální pomůcky pro E2E — jeden hlavní flow, žádné sdílené .auth soubory.
 * Seed uživatelé: apps/api seed (klient@pristav.cz …).
 */
import type { Page } from "@playwright/test";

/** Demo účty odpovídající seedu DB. */
export const USERS = {
  client: { email: "klient@pristav.cz", password: "Klient123!" },
} as const;

/** Přihlášení přes /login a čekání na dashboard podle role. */
export async function login(page: Page, role: keyof typeof USERS): Promise<void> {
  const { email, password } = USERS[role];
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /přihlásit/i }).click();
  await page.waitForURL(/\/(client|reception|employee|admin)(\/|$|\?)/, { timeout: 20_000 });
}
