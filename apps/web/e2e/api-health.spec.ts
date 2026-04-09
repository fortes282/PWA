/**
 * API Health, public endpoints, PWA assets, CORS/headers, auth boundary, role boundaries, Swagger docs.
 */
import { test, expect } from "@playwright/test";
import { USERS, login, apiGet, apiPost, type UserRole } from "./helpers";

// ---------------------------------------------------------------------------
// 1. Health endpoints (no auth)
// ---------------------------------------------------------------------------
test.describe("Health endpoints", () => {
  test("GET /api/health returns 200", async ({ page }) => {
    const res = await page.request.get("/api/health");
    expect(res.status()).toBe(200);
  });

  test("GET /api/health/ping returns 200", async ({ page }) => {
    const res = await page.request.get("/api/health/ping");
    expect(res.status()).toBe(200);
  });

  test("GET /api/health/detailed returns 200 with uptime and db", async ({ page }) => {
    const res = await page.request.get("/api/health/detailed");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.uptime).toBe("number");
    expect(body.db).toBeDefined();
    expect(typeof body.db).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// 2. Public pages (no auth)
// ---------------------------------------------------------------------------
test.describe("Public pages", () => {
  test("GET /login loads with email and password inputs", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#password")).toBeVisible({ timeout: 15_000 });
  });

  test("GET /booking loads the public booking form", async ({ page }) => {
    const res = await page.goto("/booking", { waitUntil: "domcontentloaded" });
    expect(res).not.toBeNull();
    expect(res!.status()).toBeLessThan(400);
  });

  test("GET /offline loads the offline fallback page", async ({ page }) => {
    const res = await page.goto("/offline", { waitUntil: "domcontentloaded" });
    expect(res).not.toBeNull();
    expect(res!.status()).toBeLessThan(400);
  });

  test("GET /privacy loads the privacy page", async ({ page }) => {
    const res = await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    expect(res).not.toBeNull();
    expect(res!.status()).toBeLessThan(400);
  });
});

// ---------------------------------------------------------------------------
// 3. PWA assets (no auth)
// ---------------------------------------------------------------------------
test.describe("PWA assets", () => {
  test("GET /manifest.json returns valid PWA manifest", async ({ page }) => {
    const res = await page.request.get("/manifest.json");
    expect(res.status()).toBe(200);

    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType.toLowerCase()).toContain("json");

    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.start_url).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. API CORS and headers (no auth)
// ---------------------------------------------------------------------------
test.describe("API CORS and headers", () => {
  test("GET /api/health response has security headers", async ({ page }) => {
    const res = await page.request.get("/api/health");
    const headers = res.headers();

    const hasXContentTypeOptions = !!headers["x-content-type-options"];
    const hasXFrameOptions = !!headers["x-frame-options"];
    const hasCSP = !!headers["content-security-policy"];

    expect(hasXContentTypeOptions).toBe(true);
    expect(hasXFrameOptions || hasCSP).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. API auth boundary (no auth — all should return 401)
// ---------------------------------------------------------------------------
test.describe("API auth boundary", () => {
  test.setTimeout(120_000);

  test("GET /api/users returns 401", async ({ page }) => {
    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(401);
  });

  test("GET /api/appointments returns 401", async ({ page }) => {
    const res = await page.request.get("/api/appointments");
    expect(res.status()).toBe(401);
  });

  test("GET /api/credits/balance returns 401", async ({ page }) => {
    const res = await page.request.get("/api/credits/balance");
    expect(res.status()).toBe(401);
  });

  test("GET /api/notifications returns 401", async ({ page }) => {
    const res = await page.request.get("/api/notifications");
    expect(res.status()).toBe(401);
  });

  test("POST /api/appointments with empty body returns 401", async ({ page }) => {
    const res = await page.request.post("/api/appointments", { data: {} });
    expect(res.status()).toBe(401);
  });

  test("GET /api/stats returns 401", async ({ page }) => {
    const res = await page.request.get("/api/stats");
    expect(res.status()).toBe(401);
  });

  test("GET /api/dashboard/reception returns 401", async ({ page }) => {
    const res = await page.request.get("/api/dashboard/reception");
    expect(res.status()).toBe(401);
  });

  test("GET /api/dashboard/client returns 401", async ({ page }) => {
    const res = await page.request.get("/api/dashboard/client");
    expect(res.status()).toBe(401);
  });

  test("GET /api/waitlist returns 401", async ({ page }) => {
    const res = await page.request.get("/api/waitlist");
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 6. API role boundaries (login then test)
// ---------------------------------------------------------------------------
test.describe("API role boundaries", () => {
  test.setTimeout(120_000);

  // -- Client role restrictions --

  test("client cannot access GET /api/users (403)", async ({ page }) => {
    await login(page, "client");
    const { status } = await apiGet(page, "/users");
    expect(status).toBe(403);
  });

  test("client cannot access GET /api/stats (403)", async ({ page }) => {
    await login(page, "client");
    const { status } = await apiGet(page, "/stats");
    expect(status).toBe(403);
  });

  test("client cannot access GET /api/dashboard/reception (403)", async ({ page }) => {
    await login(page, "client");
    const { status } = await apiGet(page, "/dashboard/reception");
    expect(status).toBe(403);
  });

  test("client cannot POST /api/users (403)", async ({ page }) => {
    await login(page, "client");
    const { status } = await apiPost(page, "/users", {
      email: "x@x.cz",
      password: "Test123!",
      name: "X",
    });
    expect(status).toBe(403);
  });

  test("client cannot DELETE /api/services/1 (403)", async ({ page }) => {
    await login(page, "client");
    const res = await page.request.delete("/api/services/1");
    expect(res.status()).toBe(403);
  });

  // -- Employee role restrictions --

  test("employee cannot access GET /api/stats (403)", async ({ page }) => {
    await login(page, "employee");
    const { status } = await apiGet(page, "/stats");
    expect(status).toBe(403);
  });

  test("employee cannot POST /api/users (403)", async ({ page }) => {
    await login(page, "employee");
    const { status } = await apiPost(page, "/users", {
      email: "x@x.cz",
      password: "Test123!",
      name: "X",
    });
    expect(status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 7. Swagger docs (no auth)
// ---------------------------------------------------------------------------
test.describe("Swagger docs", () => {
  test("GET /api/docs loads successfully", async ({ page }) => {
    const res = await page.request.get("/api/docs", {
      maxRedirects: 5,
    });
    // Accept 200 (direct) or a successful redirect target
    expect(res.status()).toBeLessThan(400);
    expect(res.ok()).toBe(true);
  });
});
