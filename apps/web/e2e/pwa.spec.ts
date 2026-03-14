/**
 * E2E: PWA + general smoke tests
 * Tests: manifest, offline page, service worker, settings
 */
import { test, expect } from "@playwright/test";

test.describe("PWA — general", () => {
  test("manifest.json is accessible and has required fields (G2)", async ({ page }) => {
    const response = await page.request.get("/manifest.json");
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test("offline page is accessible (G4, S2)", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /jste offline/i })).toBeVisible();
  });

  test("icon-192.png exists (G3)", async ({ page }) => {
    const response = await page.request.get("/icons/icon-192.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/image/);
  });

  test("icon-512.png exists (G3)", async ({ page }) => {
    const response = await page.request.get("/icons/icon-512.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/image/);
  });

  test("service worker script is served", async ({ page }) => {
    const response = await page.request.get("/sw.js");
    expect(response.status()).toBe(200);
  });
});
