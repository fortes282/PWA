import { test, expect } from "@playwright/test";
import { login, USERS, API_URL } from "./helpers";

// ────────── NOC 26 — Admin Dashboard, Activity Feed, Notifications ──────────

test.describe("NOC 26 — Admin Dashboard", () => {
  test("Admin dashboard loads with quick summary", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin");
    await page.waitForTimeout(1000);
    // Dashboard should have summary cards or stats
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });

  test("Activity feed API returns valid data", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${API_URL}/stats/activity-feed?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Quick summary API returns today stats", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${API_URL}/stats/quick-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("appointments");
  });

  test("Notifications API supports filtering", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${API_URL}/notifications?limit=5&unread=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("total");
  });
});

// ────────── NOC 27 — Metrics, Monitoring, Backup ──────────

test.describe("NOC 27 — Metrics & Monitoring", () => {
  test("Prometheus /metrics endpoint returns valid text", async ({ request }) => {
    const res = await request.get(`${API_URL}/metrics`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("pristav_uptime_seconds");
    expect(text).toContain("pristav_memory_rss_bytes");
    expect(text).toContain("pristav_http_requests_total");
  });

  test("JSON /health/metrics returns summary", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${API_URL}/health/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.totalRequests).toBeGreaterThan(0);
    expect(body.memory).toHaveProperty("rss");
    expect(body.memory).toHaveProperty("heapUsed");
  });

  test("Backup endpoint requires admin auth", async ({ request }) => {
    const res = await request.post(`${API_URL}/admin/backup`);
    expect(res.status()).toBe(401);
  });

  test("Backup list endpoint requires admin auth", async ({ request }) => {
    const res = await request.get(`${API_URL}/admin/backups`);
    expect(res.status()).toBe(401);
  });

  test("Health endpoint reports v2.11.0", async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("2.11.0");
  });

  test("Health/ping returns pong", async ({ request }) => {
    const res = await request.get(`${API_URL}/health/ping`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.pong).toBe(true);
  });

  test("Health/detailed returns extended info for admin", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${API_URL}/health/detailed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("2.11.0");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("db");
  });
});
