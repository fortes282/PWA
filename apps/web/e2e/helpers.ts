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

const _baseURL = process.env.BASE_URL || "";
const _isRemote =
  _baseURL && !_baseURL.includes("localhost") && !_baseURL.includes("127.0.0.1");
// On remote targets (VPS/staging) the API is proxied by nginx at /api/.
// On localhost the API runs directly at port 3001.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (_isRemote ? `${_baseURL}/api` : "http://127.0.0.1:3001");

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

// ---------------------------------------------------------------------------
// Visual regression helpers (used by admin-extra, client-extra, data-quality)
// ---------------------------------------------------------------------------

/** Check that NO visible text contains "undefined" as a standalone word. */
async function assertNoUndefined(page: Page) {
  const body = await page.locator("main").textContent();
  const undefinedMatches = (body || "").match(/\bundefined\b/gi);
  expect(undefinedMatches, `Found "undefined" in page content: ${undefinedMatches}`).toBeNull();
}

/** Check that NO visible text contains "NaN". */
async function assertNoNaN(page: Page) {
  const body = await page.locator("main").textContent();
  const nanMatches = (body || "").match(/\bNaN\b/g);
  expect(nanMatches, `Found "NaN" in page content`).toBeNull();
}

/** Check no "[object Object]" displayed. */
async function assertNoObjectObject(page: Page) {
  const body = await page.locator("main").textContent();
  expect(body).not.toContain("[object Object]");
}

/** Run all three basic data-quality assertions. */
export async function assertDataQuality(page: Page) {
  await assertNoUndefined(page);
  await assertNoNaN(page);
  await assertNoObjectObject(page);
}

/**
 * Deep DOM-walking garbage text scan — walks all visible text nodes,
 * skipping script/style/code/pre/textarea and hidden elements.
 * Catches undefined%, NaN, null, [object Object] anywhere in visible UI.
 */
export async function assertNoGarbageTextDeep(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const garbage = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          const tag = el.tagName;
          if (["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT"].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (el.offsetParent === null && el.tagName !== "BODY") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const hits: string[] = [];
    while (walker.nextNode()) {
      const txt = walker.currentNode.textContent?.trim() ?? "";
      if (!txt) continue;
      if (/\bundefined\b/i.test(txt) || /\bNaN\b/.test(txt) || /\bnull\b/i.test(txt) || txt.includes("[object Object]")) {
        const ctx = txt.slice(0, 80);
        const el = walker.currentNode.parentElement;
        const selector = el?.tagName + (el?.className ? `.${String(el.className).split(" ")[0]}` : "");
        hits.push(`"${ctx}" in <${selector}>`);
      }
    }
    return hits;
  });

  expect(garbage, `${label}: garbage text in visible DOM:\n${garbage.join("\n")}`).toEqual([]);
}

/**
 * Assert that no stat card / KPI element has text clipped by overflow.
 * Detects the "36 800,00 K" bug where "Kč" is cut off by card boundary.
 */
export async function assertNoTextClipping(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const clipped = await page.evaluate(() => {
    const results: string[] = [];
    const candidates = document.querySelectorAll(
      ".card p, .card span, .card h2, .card h3, .card div, [class*='stat'] p, [class*='stat'] span"
    );

    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.offsetParent === null) continue;
      if (el.children.length > 2) continue;

      const text = el.innerText?.trim();
      if (!text || text.length < 2) continue;

      if (el.scrollWidth > el.clientWidth + 24) {
        results.push(
          `Clipped: "${text.slice(0, 40)}" (scrollW=${el.scrollWidth}, clientW=${el.clientWidth}) in ${el.tagName}.${String(el.className).split(" ")[0]}`
        );
      }
    }
    return results;
  });

  expect(clipped, `${label}: text clipping in stat cards:\n${clipped.join("\n")}`).toEqual([]);
}
