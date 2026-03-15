/**
 * Playwright auth setup — runs once before the test suite.
 * Logs in as each role and saves the browser storage state so that
 * individual tests can reuse sessions without hitting auth rate limits.
 */
import { test as setup } from "@playwright/test";
import { login, CLIENT_AUTH_FILE, ADMIN_AUTH_FILE } from "./helpers";

setup("authenticate as client", async ({ page }) => {
  await login(page, "client");
  await page.context().storageState({ path: CLIENT_AUTH_FILE });
});

setup("authenticate as admin", async ({ page }) => {
  await login(page, "admin");
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
