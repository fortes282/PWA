/**
 * Integration tests — /system-settings
 * Tests: public read, admin read/write, RBAC
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let receptionToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-system-settings-suite-min64chars!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-system-settings-suite-min64chars!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  db.insert(users).values({ email: "ss-admin@test.cz", passwordHash: h, name: "Admin SS", role: "ADMIN" }).run();
  db.insert(users).values({ email: "ss-client@test.cz", passwordHash: h, name: "Client SS", role: "CLIENT" }).run();
  db.insert(users).values({ email: "ss-rec@test.cz", passwordHash: h, name: "Reception SS", role: "RECEPTION" }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "ss-admin@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "ss-client@test.cz", password: "Test1234!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "ss-rec@test.cz", password: "Test1234!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /system-settings/public", () => {
  it("any authenticated user can read public settings", async () => {
    const res = await app.inject({
      method: "GET", url: "/system-settings/public",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json()).toBe("object");
  });

  it("reception can read public settings", async () => {
    const res = await app.inject({
      method: "GET", url: "/system-settings/public",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/system-settings/public" });
    expect(res.statusCode).toBe(401);
  });

  it("public settings only expose whitelisted keys", async () => {
    // Write a non-public setting first
    await app.inject({
      method: "PUT", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { timezone: "Europe/Prague", internalSecret: "SHOULD_NOT_BE_PUBLIC" },
    });
    const res = await app.inject({
      method: "GET", url: "/system-settings/public",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const body = res.json();
    expect(body.internalSecret).toBeUndefined();
    // whitelisted key should be present
    expect(body.timezone).toBe("Europe/Prague");
  });
});

describe("GET /system-settings (admin only)", () => {
  it("admin can read all settings", async () => {
    const res = await app.inject({
      method: "GET", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json()).toBe("object");
  });

  it("client cannot read all settings (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/system-settings",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("reception cannot read all settings (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/system-settings",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns all settings including non-public keys", async () => {
    const res = await app.inject({
      method: "GET", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    // internalSecret was set in public-settings test above
    expect(body.internalSecret).toBe("SHOULD_NOT_BE_PUBLIC");
  });
});

describe("PUT /system-settings", () => {
  it("admin can upsert settings", async () => {
    const res = await app.inject({
      method: "PUT", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currency: "CZK", language: "cs", dueDays: "14" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.currency).toBe("CZK");
    expect(body.language).toBe("cs");
    expect(body.dueDays).toBe("14");
  });

  it("upsert updates existing key", async () => {
    await app.inject({
      method: "PUT", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currency: "EUR" },
    });
    const res = await app.inject({
      method: "GET", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.json().currency).toBe("EUR");
  });

  it("client cannot upsert settings (403)", async () => {
    const res = await app.inject({
      method: "PUT", url: "/system-settings",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { currency: "CZK" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("reception cannot upsert settings (403)", async () => {
    const res = await app.inject({
      method: "PUT", url: "/system-settings",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { currency: "CZK" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("numeric values are coerced to string", async () => {
    await app.inject({
      method: "PUT", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dueDays: 30 },
    });
    const res = await app.inject({
      method: "GET", url: "/system-settings",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.json().dueDays).toBe("30");
  });
});
