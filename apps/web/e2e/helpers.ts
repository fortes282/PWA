/**
 * E2E test helpers — sdilene utility pro vsechny testy.
 * Seed uzivatele: apps/api seed.
 */
import type { Page } from "@playwright/test";

/** Demo ucty odpovidajici seedu DB. */
export const USERS = {
  client: { email: "klient@pristav.cz", password: "Klient123!", role: "CLIENT" },
  client2: { email: "klient2@pristav.cz", password: "Klient123!", role: "CLIENT" },
  client3: { email: "klient3@pristav.cz", password: "Klient123!", role: "CLIENT" },
  client4: { email: "klient4@pristav.cz", password: "Klient123!", role: "CLIENT" },
  reception: { email: "recepce@pristav.cz", password: "Recepce123!", role: "RECEPTION" },
  employee: { email: "terapeut@pristav.cz", password: "Terapeut123!", role: "EMPLOYEE" },
  employee2: { email: "terapeut2@pristav.cz", password: "Terapeut123!", role: "EMPLOYEE" },
  admin: { email: "admin@pristav.cz", password: "Admin123!", role: "ADMIN" },
} as const;

export type UserRole = keyof typeof USERS;

/** Seed services. */
export const SERVICES = [
  { name: "Neurorehabilitace", duration: 60, price: 1200 },
  { name: "Vstupní konzultace", duration: 30, price: 600 },
  { name: "Skupinové cvičení", duration: 90, price: 400 },
  { name: "Fyzioterapie", duration: 60, price: 1000 },
  { name: "Psychoterapie", duration: 50, price: 1500 },
  { name: "Ergoterapie", duration: 60, price: 1100 },
  { name: "Logopedie", duration: 45, price: 900 },
] as const;

/** Seed rooms. */
export const ROOMS = [
  "Rehabilitační sál A",
  "Terapeutická místnost 1",
  "Terapeutická místnost 2",
  "Skupinový sál",
] as const;

/** Prihlaseni pres /login a cekani na dashboard podle role. */
export async function login(page: Page, role: UserRole): Promise<void> {
  const { email, password } = USERS[role];
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /přihlásit/i }).click();
  await page.waitForURL(/\/(client|reception|employee|admin)(\/|$|\?)/, {
    timeout: 30_000,
  });
}

/** Odhlaseni — klikne na tlacitko odhlaseni. */
export async function logout(page: Page): Promise<void> {
  // Mobile: klikni na "Více" tab pokud existuje
  const moreTab = page.getByRole("button", { name: /^více$/i });
  const moreVisible = await moreTab
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (moreVisible) {
    await moreTab.click();
    await page.getByTestId("more-sheet").waitFor({ state: "visible", timeout: 4_000 }).catch(() => {});
  }

  // Desktop sidebar or mobile drawer
  const logoutBtn = page.getByRole("button", { name: /odhlásit/i });
  const logoutLink = page.getByRole("link", { name: /odhlásit/i });

  const btnVisible = await logoutBtn.isVisible().catch(() => false);
  if (btnVisible) {
    await logoutBtn.click();
  } else {
    await logoutLink.click();
  }

  await page.waitForURL(/\/login/, { timeout: 15_000 });
}

/** Navigace na URL a cekani na obsah. */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Cekej na main#main-content (z Layout) NEBO jakykoli main NEBO body obsah
  await page
    .locator("main#main-content, main, #__next")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}

/** API GET request s autentizaci stranky (cookies). */
export async function apiGet(page: Page, path: string) {
  const res = await page.request.get(`/api${path}`);
  return { status: res.status(), data: await res.json().catch(() => null), ok: res.ok() };
}

/** API POST request s autentizaci stranky. */
export async function apiPost(page: Page, path: string, body: Record<string, unknown>) {
  const res = await page.request.post(`/api${path}`, { data: body });
  return { status: res.status(), data: await res.json().catch(() => null), ok: res.ok() };
}

/** Non-fatal console errors to ignore. */
const IGNORED_CONSOLE_PATTERNS = [
  "favicon",
  "404",
  "push",
  "subscription",
  "service-worker",
  "sw.js",
  "workbox",
  "manifest",
  "hydrat",
  "next-router",
  "NEXT_REDIRECT",
  "AbortError",
  "cancelled",
  "ERR_CONNECTION",
  "net::ERR",
  "ResizeObserver",
  "ChunkLoadError",
  "Loading chunk",
  "Failed to fetch",
];

/** Overeni ze stranka neobsahuje fatalni console errory. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const isIgnored = IGNORED_CONSOLE_PATTERNS.some((p) =>
        text.toLowerCase().includes(p.toLowerCase()),
      );
      if (!isIgnored) {
        errors.push(text);
      }
    }
  });
  return errors;
}

/** Cekani na zmizeni loading stavu. */
export async function waitForLoaded(page: Page): Promise<void> {
  const spinner = page.locator('[data-testid="loading"], .animate-pulse, .animate-spin').first();
  await spinner.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
}

/** Overeni ze stranka ma titulek. */
export async function expectHeading(page: Page, text: string | RegExp): Promise<void> {
  const heading = page.getByRole("heading", { name: text }).first();
  await heading.waitFor({ state: "visible", timeout: 15_000 });
}

/** Overeni ze stranka se nacetla bez padu (main viditelny). */
export async function expectPageLoaded(page: Page): Promise<void> {
  await page
    .locator("main#main-content, main, #__next")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}
