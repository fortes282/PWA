import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../server.js";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import type { FastifyInstance } from "fastify";

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

  // Create a user with legacy SHA-256 hash
  const password = "LegacyUser1!";
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(password + salt).digest("hex");
  const legacyHash = `${salt}:${hash}`;

  await db.insert(users).values({
    email: "legacy@test.cz",
    passwordHash: legacyHash,
    name: "Legacy User",
    role: "CLIENT",
  });

  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Transparent hash upgrade", () => {
  it("upgrades legacy SHA-256 hash to scrypt on login", async () => {
    // Verify hash is legacy before login
    const [before] = await db.select().from(users).where(eq(users.email, "legacy@test.cz")).limit(1);
    expect(before.passwordHash.startsWith("scrypt:")).toBe(false);

    // Login should succeed and upgrade hash
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "legacy@test.cz", password: "LegacyUser1!" },
    });
    expect(res.statusCode).toBe(200);

    // Hash should now be scrypt
    const [after] = await db.select().from(users).where(eq(users.email, "legacy@test.cz")).limit(1);
    expect(after.passwordHash.startsWith("scrypt:")).toBe(true);

    // Login should still work with new hash
    const res2 = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "legacy@test.cz", password: "LegacyUser1!" },
    });
    expect(res2.statusCode).toBe(200);
  });
});
