/**
 * NOC 28 — Login history, active sessions, session revocation, version 2.9.0.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, applyRuntimeMigrations } from "../db/index.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, target_id INTEGER, target_type TEXT, details TEXT, ip TEXT, created_at INTEGER);
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-noc28-suite-min64chars!!!!!!!!!!!!!!!!!!!!!!";
  process.env.LOGIN_RATE_MAX = "100";

  rawSqlite.exec(MIGRATION_SQL);
  applyRuntimeMigrations();

  // Seed users
  const adminHash = hashPassword("Admin123!");
  const clientHash = hashPassword("Klient123!");
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("noc28-admin@test.cz", adminHash, "NOC28 Admin", "ADMIN");
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("noc28-client@test.cz", clientHash, "NOC28 Client", "CLIENT");

  app = await buildApp({ logger: false });
  await app.ready();

  const adminRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "noc28-admin@test.cz", password: "Admin123!" },
  });
  adminToken = adminRes.json().accessToken;

  const clientRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "noc28-client@test.cz", password: "Klient123!" },
  });
  clientToken = clientRes.json().accessToken;
});

afterAll(async () => {
  await app.close();
});

// ── Login History ────────────────────────────────────────────────────────

describe("NOC 28 — Login History", () => {
  it("GET /login-history returns own login history", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/login-history",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("ip");
    expect(body[0]).toHaveProperty("success");
    expect(body[0]).toHaveProperty("createdAt");
  });

  it("GET /login-history requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/login-history",
    });
    expect(res.statusCode).toBe(401);
  });

  it("records failed login attempts", async () => {
    // Try a failed login
    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "noc28-admin@test.cz", password: "WrongPassword123!" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/login-history",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    const failed = body.filter((e: any) => !e.success);
    expect(failed.length).toBeGreaterThan(0);
  });
});

// ── Admin Login History ─────────────────────────────────────────────────

describe("NOC 28 — Admin Login History", () => {
  it("GET /admin/login-history returns all history for admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/login-history",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty("userName");
    expect(body.items[0]).toHaveProperty("userEmail");
  });

  it("GET /admin/login-history rejects non-admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/login-history",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /admin/login-history filters by success", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/login-history?success=false",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const item of body.items) {
      expect(item.success).toBe(false);
    }
  });
});

// ── Active Sessions ─────────────────────────────────────────────────────

describe("NOC 28 — Active Sessions", () => {
  it("GET /admin/active-sessions lists sessions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/active-sessions",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("sessionId");
    expect(body[0]).toHaveProperty("userName");
    expect(body[0]).toHaveProperty("userEmail");
    expect(body[0]).toHaveProperty("expiresAt");
  });

  it("GET /admin/active-sessions rejects non-admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/active-sessions",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE /admin/active-sessions/user/:userId revokes all user sessions", async () => {
    // Get client user id
    const clientUser = rawSqlite.prepare("SELECT id FROM users WHERE email = ?").get("noc28-client@test.cz") as { id: number };
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/active-sessions/user/${clientUser.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().revoked).toBeGreaterThanOrEqual(0);
  });
});

// ── Version ─────────────────────────────────────────────────────────────

describe("NOC 28 — Version 2.9.0", () => {
  it("health endpoint reports v2.9.0", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json().version).toBe("2.9.0");
  });

  it("OpenAPI spec reports v2.9.0", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    expect(res.json().info.version).toBe("2.9.0");
  });
});
