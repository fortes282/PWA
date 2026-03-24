/**
 * Shared helpers for Playwright E2E tests.
 */
import { Page, expect } from "@playwright/test";
import path from "path";

/** Paths to saved browser storage-state files (written by auth.setup.ts). */
export const CLIENT_AUTH_FILE = path.join(__dirname, ".auth/client.json");
export const ADMIN_AUTH_FILE = path.join(__dirname, ".auth/admin.json");
export const RECEPTION_AUTH_FILE = path.join(__dirname, ".auth/reception.json");
export const EMPLOYEE_AUTH_FILE = path.join(__dirname, ".auth/employee.json");

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

/**
 * POST /auth/login je na API rate-limitovaný (viz `apps/api/src/routes/auth.ts`):
 * default `AUTH_LOGIN_RATE_LIMIT_MAX` = 10, `AUTH_LOGIN_RATE_LIMIT_WINDOW` = 5 minutes (1 IP).
 * Mezi po sobě jdoucími přihlášeními v E2E musí být rozestup ≥ window/max, jinak hrozí 429 (a Playwright retry situaci zhorší).
 */
const AUTH_LOGIN_RATE_LIMIT_MAX = Number.parseInt(
  process.env.E2E_LOGIN_RATE_LIMIT_MAX ||
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX ||
    "10",
  10
);
const AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.E2E_LOGIN_RATE_LIMIT_WINDOW_MS || String(5 * 60 * 1000),
  10
);

/** Minimální pauza mezi dvěma login flow stejné IP (auth setup + testy co volají login opakovaně). */
export const E2E_LOGIN_GAP_MS = Number.parseInt(
  process.env.E2E_LOGIN_GAP_MS ||
    String(Math.ceil(AUTH_LOGIN_RATE_LIMIT_WINDOW_MS / AUTH_LOGIN_RATE_LIMIT_MAX) + 250),
  10
);

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Po uložení storage state přejdi na další roli — vyčisti cookies a web storage. */
export async function clearSessionForNextLogin(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

// Demo credentials matching seed data
export const USERS = {
  admin: { email: "admin@pristav.cz", password: "Admin123!" },
  reception: { email: "recepce@pristav.cz", password: "Recepce123!" },
  employee: { email: "terapeut@pristav.cz", password: "Terapeut123!" },
  client: { email: "klient@pristav.cz", password: "Klient123!" },
};

/**
 * Login via the login page and wait for redirect to dashboard.
 */
export async function login(page: Page, role: keyof typeof USERS) {
  const { email, password } = USERS[role];
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /přihlásit/i }).click();
  // Wait for redirect away from /login
  await expect(page).not.toHaveURL(/\/login/);
}
