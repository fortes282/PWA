import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Pristav Radosti PWA.
 * Tests run against a locally started dev server.
 *
 * Usage:
 *   pnpm -C apps/web test:e2e
 *   pnpm -C apps/web test:e2e --headed
 *
 * Project pipeline:
 *   setup -> health-gate -> chromium (+ webkit, iphone, android, ipad depend on setup)
 *
 * The health-gate runs health-check.spec.ts on Desktop Chrome first.
 * If any page crashes, downstream chromium tests are blocked.
 */
const port = process.env.PORT || "3000";
const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
const isLocalTarget =
  baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI || !isLocalTarget ? 4 : undefined,
  retries: process.env.CI ? 2 : 1,
  expect: { timeout: process.env.CI ? 10000 : 5000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Self-signed cert on staging/VPS (nginx ssl with self-signed cert).
    ignoreHTTPSErrors: !isLocalTarget,
  },

  projects: [
    // --- Auth setup: logs in once and saves storage state ---
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // --- Health gate: health-check.spec.ts on Desktop Chrome FIRST ---
    {
      name: "health-gate",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /health-check\.spec\.ts/,
      dependencies: ["setup"],
    },

    // --- ALL tests on ALL devices (depend on health-gate) ---
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /health-check\.spec\.ts/,
      dependencies: ["health-gate"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /health-check\.spec\.ts/,
      dependencies: ["health-gate"],
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 15"] },
      testIgnore: /health-check\.spec\.ts/,
      dependencies: ["health-gate"],
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"] },
      testIgnore: /health-check\.spec\.ts/,
      dependencies: ["health-gate"],
    },
    {
      name: "android-samsung",
      use: { ...devices["Galaxy S9+"] },
      testIgnore: /health-check\.spec\.ts/,
      dependencies: ["health-gate"],
    },
    {
      name: "ipad",
      use: { ...devices["iPad Pro 11"] },
      testIgnore: /health-check\.spec\.ts/,
      dependencies: ["health-gate"],
    },
  ],

  // Only start Next when targeting localhost. For deploy E2E (BASE_URL remote), rely on live stack.
  ...(isLocalTarget
    ? {
        webServer: {
          command: process.env.CI
            ? `pnpm exec next start -p ${port}`
            : `pnpm exec next dev -p ${port}`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 180 * 1000,
          env: {
            NEXT_PUBLIC_API_URL:
              process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001",
          },
        },
      }
    : {}),
});
