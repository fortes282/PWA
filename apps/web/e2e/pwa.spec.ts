/**
 * E2E: PWA smoke tests
 *
 * Matrix scenarios:
 *   PWA-01 (P0): Manifest.json accessible with required fields (covered by existing test).
 *   PWA-03 (P0): Navigate to /offline → verify offline fallback page renders.
 */
import { test, expect } from "@playwright/test";

test.describe("PWA — general", () => {
  // PWA-01 (P0): manifest.json is accessible and has required fields
  test("PWA-01: manifest.json is accessible and has required fields", async ({
    page,
  }) => {
    const response = await page.request.get("/manifest.json");
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  // PWA-03 (P0): Offline fallback page renders
  test("PWA-03: offline fallback page is accessible and renders", async ({
    page,
  }) => {
    await page.goto("/offline", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("heading", { name: /jste offline/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("icon-192.png exists", async ({ page }) => {
    const response = await page.request.get("/icons/icon-192.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/image/);
  });

  test("icon-512.png exists", async ({ page }) => {
    const response = await page.request.get("/icons/icon-512.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/image/);
  });

  test("service worker script is served", async ({ page }) => {
    const response = await page.request.get("/sw.js");
    expect(response.status()).toBe(200);
  });
});
