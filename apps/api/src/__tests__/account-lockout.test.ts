import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../server.js";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import type { FastifyInstance } from "fastify";

// Raise rate limits for lockout testing
process.env.LOGIN_RATE_MAX = "100";
process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "100";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CLIENT',
    phone TEXT,
    avatar_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    behavior_score REAL NOT NULL DEFAULT 100,
    email_enabled INTEGER NOT NULL DEFAULT 1,
    sms_enabled INTEGER NOT NULL DEFAULT 0,
    push_enabled INTEGER NOT NULL DEFAULT 0,
    push_subscription TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

let app: FastifyInstance;

beforeAll(async () => {
  rawSqlite.pragma("foreign_keys = ON");
  rawSqlite.exec(MIGRATION_SQL);

  await db.insert(users).values([
    {
      email: "lockout@test.cz",
      passwordHash: hashPassword("Correct123!"),
      name: "Lockout Test",
      role: "CLIENT",
      isActive: true,
    },
  ]);

  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Account lockout", () => {
  it("locks account after 5 failed login attempts", async () => {
    const email = "nonexistent-lockout@test.cz";

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "WrongPassword123" },
      });
      expect(res.statusCode).toBe(401);
    }

    // 6th attempt should be locked (429)
    const locked = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "WrongPassword123" },
    });
    expect(locked.statusCode).toBe(429);
    expect(JSON.parse(locked.body).error).toContain("zablokován");
  });

  it("successful login clears lockout counter", async () => {
    const email = "lockout@test.cz";

    // 3 failed attempts (under threshold)
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "WrongPassword123" },
      });
    }

    // Successful login
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "Correct123!" },
    });
    expect(res.statusCode).toBe(200);

    // After successful login, counter should be reset — 3 more fails should not lock
    for (let i = 0; i < 3; i++) {
      const fail = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "WrongAgainLong1" },
      });
      expect(fail.statusCode).toBe(401); // Not 429 — counter was reset
    }
  });
});
