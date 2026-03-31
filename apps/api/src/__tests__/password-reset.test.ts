/**
 * Integration tests for password reset flow:
 * - POST /auth/forgot-password
 * - GET /auth/reset-password/validate
 * - POST /auth/reset-password
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, passwordResets } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";

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
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    duration_min INTEGER NOT NULL DEFAULT 60,
    price REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),
    room_id INTEGER REFERENCES rooms(id),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    cancellation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id),
    employee_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'WAITING',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id),
    appointment_id INTEGER REFERENCES appointments(id),
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNPAID',
    due_date TEXT,
    paid_at TEXT,
    variable_symbol TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS medical_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id),
    appointment_id INTEGER REFERENCES appointments(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    diagnosis TEXT,
    pdf_path TEXT,
    docx_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    delta REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS profile_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_by INTEGER REFERENCES users(id),
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fio_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fio_id TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    variable_symbol TEXT,
    note TEXT,
    counter_account TEXT,
    counter_name TEXT,
    transaction_date TEXT NOT NULL,
    matched_invoice_id INTEGER REFERENCES invoices(id),
    matched_client_id INTEGER REFERENCES users(id),
    is_matched INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_employee ON appointments(employee_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_credit_user ON credit_transactions(user_id);
`;

let app: FastifyInstance;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

beforeAll(async () => {
  rawSqlite.pragma("foreign_keys = ON");
  rawSqlite.exec(MIGRATION_SQL);

  await db.insert(users).values([
    {
      email: "reset-user@test.cz",
      passwordHash: hashPassword("OldPassword1!"),
      name: "Reset User",
      role: "CLIENT",
      isActive: true,
    },
    {
      email: "inactive-reset@test.cz",
      passwordHash: hashPassword("OldPassword1!"),
      name: "Inactive Reset",
      role: "CLIENT",
      isActive: false,
    },
  ]);

  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Password Reset — forgot-password", () => {
  it("POST /auth/forgot-password → 200 for existing user (no enumeration)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "reset-user@test.cz" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("e-mail");
  });

  it("POST /auth/forgot-password → 200 for non-existing user (no enumeration)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "nobody@test.cz" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("e-mail");
  });

  it("POST /auth/forgot-password → 200 for inactive user (no enumeration)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "inactive-reset@test.cz" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /auth/forgot-password → 400 without email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /auth/forgot-password → creates password_reset record in DB", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "reset-user@test.cz" },
    });
    const records = await db.select().from(passwordResets);
    expect(records.length).toBeGreaterThan(0);
    // Token should be a 64-char hex string
    expect(records[records.length - 1].token).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Password Reset — validate token", () => {
  it("GET /auth/reset-password/validate → valid: true for valid token", async () => {
    const [user] = await db.select().from(users).where(eq(users.email, "reset-user@test.cz")).limit(1);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.insert(passwordResets).values({ userId: user.id, token: hashResetToken(token), expiresAt });

    const res = await app.inject({
      method: "GET",
      url: `/auth/reset-password/validate?token=${token}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).valid).toBe(true);
  });

  it("GET /auth/reset-password/validate → valid: false for expired token", async () => {
    const [user] = await db.select().from(users).where(eq(users.email, "reset-user@test.cz")).limit(1);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // already expired
    await db.insert(passwordResets).values({ userId: user.id, token: hashResetToken(token), expiresAt });

    const res = await app.inject({
      method: "GET",
      url: `/auth/reset-password/validate?token=${token}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).valid).toBe(false);
  });

  it("GET /auth/reset-password/validate → valid: false for unknown token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/reset-password/validate?token=nonexistenttoken12345",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).valid).toBe(false);
  });
});

describe("Password Reset — reset-password", () => {
  it("POST /auth/reset-password → 200 + password changed", async () => {
    const [user] = await db.select().from(users).where(eq(users.email, "reset-user@test.cz")).limit(1);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.insert(passwordResets).values({ userId: user.id, token: hashResetToken(token), expiresAt });

    const res = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token, password: "NewPassword123!" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("změněno");

    // Can now login with new password
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "reset-user@test.cz", password: "NewPassword123!" },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it("POST /auth/reset-password → 400 for invalid token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token: "invalidtoken", password: "NewPassword123!" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /auth/reset-password → 400 for password too short", async () => {
    const [user] = await db.select().from(users).where(eq(users.email, "reset-user@test.cz")).limit(1);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.insert(passwordResets).values({ userId: user.id, token: hashResetToken(token), expiresAt });

    const res = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token, password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /auth/reset-password → token is invalidated after use (cannot reuse)", async () => {
    const [user] = await db.select().from(users).where(eq(users.email, "reset-user@test.cz")).limit(1);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.insert(passwordResets).values({ userId: user.id, token: hashResetToken(token), expiresAt });

    // Use it once
    await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token, password: "AnotherPass456!" },
    });

    // Try to reuse — should fail
    const res = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token, password: "YetAnother789!" },
    });
    expect(res.statusCode).toBe(400);
  });
});
