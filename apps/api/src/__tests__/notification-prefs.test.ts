/**
 * NOC 17/2 — Notification Preferences
 * GET /notification-preferences — returns prefs (default all true)
 * PATCH /notification-preferences — updates preferences
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
`;

let app: FastifyInstance;
let clientToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-notification-prefs-noc17-min64chars!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const hash = await hashPassword("Pass123!");
  db.insert(users).values({ email: "np-client@test.cz", passwordHash: hash, name: "Klient NP", role: "CLIENT" }).run();

  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "np-client@test.cz", password: "Pass123!" } })).json().accessToken;
});

afterAll(async () => { await app.close(); });

describe("Notification Preferences", () => {
  it("test 1: GET /notification-preferences returns default prefs (all true)", async () => {
    const res = await app.inject({
      method: "GET", url: "/notification-preferences",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailReminders).toBe(true);
    expect(body.smsReminders).toBe(true);
    expect(body.pushReminders).toBe(true);
  });

  it("test 2: PATCH /notification-preferences updates email preference", async () => {
    const res = await app.inject({
      method: "PATCH", url: "/notification-preferences",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { emailReminders: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailReminders).toBe(false);
    expect(body.smsReminders).toBe(true);
    expect(body.pushReminders).toBe(true);
  });

  it("test 3: PATCH /notification-preferences updates multiple preferences", async () => {
    const res = await app.inject({
      method: "PATCH", url: "/notification-preferences",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { emailReminders: true, smsReminders: false, pushReminders: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailReminders).toBe(true);
    expect(body.smsReminders).toBe(false);
    expect(body.pushReminders).toBe(false);
  });

  it("test 4: PATCH /notification-preferences is idempotent", async () => {
    // Apply same patch twice, result should be same
    const payload = { emailReminders: true, smsReminders: true, pushReminders: true };
    await app.inject({
      method: "PATCH", url: "/notification-preferences",
      headers: { authorization: `Bearer ${clientToken}` },
      payload,
    });
    const res = await app.inject({
      method: "PATCH", url: "/notification-preferences",
      headers: { authorization: `Bearer ${clientToken}` },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.emailReminders).toBe(true);
    expect(body.smsReminders).toBe(true);
    expect(body.pushReminders).toBe(true);
  });
});
