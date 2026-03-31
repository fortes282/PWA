/**
 * NOC 29 — API keys, API key auth, version 2.10.0.
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
  process.env.JWT_SECRET = "test-secret-noc29-suite-min64chars!!!!!!!!!!!!!!!!!!!!!!";
  process.env.LOGIN_RATE_MAX = "100";

  rawSqlite.exec(MIGRATION_SQL);
  applyRuntimeMigrations();

  const adminHash = hashPassword("Admin123!");
  const clientHash = hashPassword("Klient123!");
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("noc29-admin@test.cz", adminHash, "NOC29 Admin", "ADMIN");
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("noc29-client@test.cz", clientHash, "NOC29 Client", "CLIENT");

  app = await buildApp({ logger: false });
  await app.ready();

  const adminRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "noc29-admin@test.cz", password: "Admin123!" },
  });
  adminToken = adminRes.json().accessToken;

  const clientRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "noc29-client@test.cz", password: "Klient123!" },
  });
  clientToken = clientRes.json().accessToken;
});

afterAll(async () => {
  await app.close();
});

// ── API Keys CRUD ───────────────────────────────────────────────────────

describe("NOC 29 — API Keys", () => {
  let createdKeyId: number;
  let createdRawKey: string;

  it("GET /admin/api-keys returns empty list initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-keys",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("POST /admin/api-keys creates a key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/api-keys",
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { name: "Test Key", scopes: ["admin:api-keys:read"], expiresInDays: 30 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.key).toMatch(/^pr_live_/);
    expect(body.name).toBe("Test Key");
    expect(body.warning).toBeTruthy();
    createdKeyId = body.id;
    createdRawKey = body.key;
  });

  it("API key can be used for authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-keys",
      headers: { "X-API-Key": createdRawKey },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("Invalid API key returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-keys",
      headers: { "X-API-Key": "pr_live_invalid_key_12345" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /admin/api-keys rejects non-admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/api-keys",
      headers: { Authorization: `Bearer ${clientToken}` },
      payload: { name: "Hacker Key" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE /admin/api-keys/:id revokes a key", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/api-keys/${createdKeyId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("Revoked key no longer works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-keys",
      headers: { "X-API-Key": createdRawKey },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── Version ─────────────────────────────────────────────────────────────

describe("NOC 29 — Version 2.10.0", () => {
  it("health endpoint reports v2.10.0", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json().version).toBe("2.11.0");
  });

  it("OpenAPI spec reports v2.10.0", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    expect(res.json().info.version).toBe("2.11.0");
  });
});
