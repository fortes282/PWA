/**
 * Playwright auth setup — runs once before browser projects.
 * Jedna sekvence přihlášení (4× POST /auth/login) s pauzami; mezi rolemi se čistí session,
 * aby se zbytečně nenásobily rate-limity ani duplicitní cookies.
 */
import { test as setup } from "@playwright/test";
import {
  login,
  CLIENT_AUTH_FILE,
  ADMIN_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
  sleepMs,
  E2E_LOGIN_GAP_MS,
  clearSessionForNextLogin,
} from "./helpers";

// Auth setup logs in 4 roles sequentially. Each login may be followed by a
// configurable gap (E2E_LOGIN_GAP_MS) to respect rate limits on the target
// server. On remote servers where rate limiting is disabled (CI=true env on
// VPS), pass E2E_LOGIN_GAP_MS=500 to keep setup fast.
//
// On localhost there is no rate limit -- use 100ms gap for speed.
const _baseURL = process.env.BASE_URL || "";
const _isLocal =
  !_baseURL || _baseURL.includes("localhost") || _baseURL.includes("127.0.0.1");
const loginGap = _isLocal ? 100 : E2E_LOGIN_GAP_MS;

setup.setTimeout(180_000);

setup("authenticate all roles and save storage", async ({ page }) => {
  await login(page, "client");
  await page.context().storageState({ path: CLIENT_AUTH_FILE });

  await clearSessionForNextLogin(page);
  await sleepMs(loginGap);
  await login(page, "admin");
  await page.context().storageState({ path: ADMIN_AUTH_FILE });

  await clearSessionForNextLogin(page);
  await sleepMs(loginGap);
  await login(page, "reception");
  await page.context().storageState({ path: RECEPTION_AUTH_FILE });

  await clearSessionForNextLogin(page);
  await sleepMs(loginGap);
  await login(page, "employee");
  await page.context().storageState({ path: EMPLOYEE_AUTH_FILE });
});
