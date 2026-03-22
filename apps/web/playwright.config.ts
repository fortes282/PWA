import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Pristav Radosti PWA.
 * Tests run against a locally started dev server.
 *
 * Usage:
 *   pnpm -C apps/web test:e2e
 *   pnpm -C apps/web test:e2e --headed
 */
const port = process.env.PORT || "3000";
const baseURL = process.env.BASE_URL || `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 1,
  expect: { timeout: process.env.CI ? 10000 : 5000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Auth setup project: logs in once and saves storage state so that
  // settings tests (and future suites) can reuse sessions without
  // hammering the auth rate-limit endpoint.
  //
  // Projects:
  //   chromium  — Desktop Chrome (baseline)
  //   webkit    — Desktop Safari (macOS Safari engine)
  //   iphone    — Mobile Safari on iPhone 15 (iOS WebKit)
  //   android   — Mobile Chrome on Pixel 7 (Android Chromium)
  //
  // Setup runs once; all browser projects depend on it and reuse the
  // same auth storage-state files so login is not repeated per browser.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 15"] },
      dependencies: ["setup"],
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
  ],

  // In CI the app is pre-built by the CI step before Playwright runs.
  // Locally keep dev mode for fast iteration.
  webServer: {
    command: process.env.CI
      ? `pnpm exec next start -p ${port}`
      : `pnpm exec next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180 * 1000,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001",
    },
  },
});
