import { test, expect } from "@playwright/test";
import { login, USERS, API_URL } from "./helpers";

// ────────── NOC 28 — Login History, Session Management ──────────

test.describe("NOC 28 — Login History & Sessions", () => {
  test("Login history API returns own history", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { accessToken: token } = await loginRes.json();

    const res = await request.get(`${API_URL}/login-history?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("ip");
      expect(body[0]).toHaveProperty("success");
      expect(body[0]).toHaveProperty("createdAt");
    }
  });

  test("Admin login history API returns all entries", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { accessToken: token } = await loginRes.json();

    const res = await request.get(`${API_URL}/admin/login-history?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Admin login history requires admin role", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.client.email, password: USERS.client.password },
    });
    const { accessToken: token } = await loginRes.json();

    const res = await request.get(`${API_URL}/admin/login-history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });

  test("Active sessions endpoint requires admin auth", async ({ request }) => {
    const res = await request.get(`${API_URL}/admin/active-sessions`);
    expect(res.status()).toBe(401);
  });

  test("Admin can list active sessions", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { accessToken: token } = await loginRes.json();

    const res = await request.get(`${API_URL}/admin/active-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("Admin sessions page loads", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/sessions");
    await page.waitForTimeout(1000);
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });
});

// ────────── NOC 29 — API Keys ──────────

test.describe("NOC 29 — API Key Management", () => {
  test("API keys list requires admin auth", async ({ request }) => {
    const res = await request.get(`${API_URL}/admin/api-keys`);
    expect(res.status()).toBe(401);
  });

  test("Non-admin cannot list API keys", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.client.email, password: USERS.client.password },
    });
    const { accessToken: token } = await loginRes.json();

    const res = await request.get(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });

  test("Admin can create and list API keys", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { accessToken: token } = await loginRes.json();

    // Create key
    const createRes = await request.post(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "E2E Test Key", expiresInDays: 30 },
    });
    expect(createRes.status()).toBe(200);
    const created = await createRes.json();
    expect(created).toHaveProperty("key");
    expect(created.key).toMatch(/^pr_live_/);
    expect(created).toHaveProperty("id");

    // List keys
    const listRes = await request.get(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status()).toBe(200);
    const keys = await listRes.json();
    expect(Array.isArray(keys)).toBe(true);
    const found = keys.find((k: any) => k.id === created.id);
    expect(found).toBeTruthy();
    expect(found.name).toBe("E2E Test Key");

    // Revoke key
    const revokeRes = await request.delete(`${API_URL}/admin/api-keys/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(revokeRes.status()).toBe(200);
  });

  test("API key auth works for health endpoint", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { accessToken: token } = await loginRes.json();

    // Create a key
    const createRes = await request.post(`${API_URL}/admin/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "E2E Auth Test Key" },
    });
    const { key } = await createRes.json();

    // Use key for auth
    const healthRes = await request.get(`${API_URL}/health/detailed`, {
      headers: { "X-API-Key": key },
    });
    expect(healthRes.status()).toBe(200);
    const body = await healthRes.json();
    expect(body).toHaveProperty("version");
  });

  test("Admin API keys page loads", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/api-keys");
    await page.waitForTimeout(1000);
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });
});

// ────────── Version check ──────────

test.describe("Version Check", () => {
  test("Health endpoint reports current version", async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("2.11.0");
  });

  test("Health/detailed reports current version", async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { email: USERS.admin.email, password: USERS.admin.password },
    });
    const { accessToken: token } = await loginRes.json();

    const res = await request.get(`${API_URL}/health/detailed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("2.11.0");
  });
});
