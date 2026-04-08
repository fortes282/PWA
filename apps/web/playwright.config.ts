import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — jeden hlavní E2E flow (`e2e/main-user-flow.spec.ts`).
 * Při pádu: screenshot, video, trace (viz `use` níže).
 *
 * Lokálně: spouští API :3001 a Next :3000 (pokud nejsou vypnuté env).
 * @see https://playwright.dev/docs/test-configuration
 */
const webPort = process.env.PLAYWRIGHT_WEB_PORT || "3000";
const baseURL = process.env.BASE_URL || `http://localhost:${webPort}`;
const isLocalTarget =
  baseURL.includes("localhost") || baseURL.includes("127.0.0.1");
const skipWebServer = process.env.PW_SKIP_WEBSERVER === "1";
const skipApiWebServer = process.env.PW_SKIP_API_WEBSERVER === "1";
/** Default false: vždy vlastní API/Next (jinak reuse na :3000/:3001 může použít starý `next dev` bez čerstvého buildu). Nastav `PW_REUSE_WEBSERVER=1` pro rychlejší iteraci. */
const reuseExistingServer = process.env.PW_REUSE_WEBSERVER === "1";

const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
const apiHealthUrl = `${nextPublicApiUrl.replace(/\/$/, "")}/health`;

const nextWebServer = {
  command: process.env.CI
    ? `pnpm exec next start -p ${webPort}`
    : `pnpm exec next dev -p ${webPort}`,
  url: baseURL,
  reuseExistingServer,
  timeout: 180 * 1000,
  env: {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
    NEXT_PUBLIC_API_URL: nextPublicApiUrl,
    API_INTERNAL_URL: nextPublicApiUrl,
  },
};

const apiWebServerEnv: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
  CI: "true",
  JWT_SECRET:
    process.env.JWT_SECRET ||
    "playwright-local-e2e-jwt-secret-at-least-32-characters-long",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    "playwright-local-e2e-refresh-secret-at-least-32-characters-long",
  NODE_ENV: process.env.NODE_ENV || "development",
};

const apiWebServer = {
  command: "pnpm --dir ../api run dev:ci",
  url: apiHealthUrl,
  reuseExistingServer,
  timeout: 120 * 1000,
  env: apiWebServerEnv,
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: /main-user-flow\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: !isLocalTarget,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  ...(isLocalTarget && !skipWebServer
    ? {
        webServer: skipApiWebServer ? [nextWebServer] : [apiWebServer, nextWebServer],
      }
    : {}),
});
