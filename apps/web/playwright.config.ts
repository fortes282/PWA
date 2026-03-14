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
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Run tests in Chromium only for speed; add more devices as needed
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // In CI use a production-like Next start; locally keep dev mode for iteration.
  webServer: {
    command: process.env.CI
      ? `pnpm build && pnpm exec next start -p ${port}`
      : `pnpm exec next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
