import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
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
    client_id INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    room_id INTEGER REFERENCES rooms(id),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    price REAL,
    booking_activated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id),
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    employee_id INTEGER REFERENCES users(id),
    preferred_dates TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING',
    notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    total REAL NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL,
    paid_at TEXT,
    notes TEXT,
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
    client_id INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    appointment_id INTEGER REFERENCES appointments(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    diagnosis TEXT,
    recommendations TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    points REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS profile_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_by INTEGER NOT NULL REFERENCES users(id),
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

beforeAll(async () => {
  // Run migrations on in-memory db
  rawSqlite.pragma("foreign_keys = ON");
  rawSqlite.exec(MIGRATION_SQL);

  // Seed test users
  await db.insert(users).values([
    {
      email: "active@test.cz",
      passwordHash: hashPassword("Password123!"),
      name: "Active User",
      role: "CLIENT",
      isActive: true,
    },
    {
      email: "inactive@test.cz",
      passwordHash: hashPassword("Password123!"),
      name: "Inactive User",
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

describe("Auth routes", () => {
  let accessToken: string;
  let refreshCookie: string;

  // ── POST /auth/login ─────────────────────────────────────────────────

  it("POST /auth/login — success (returns accessToken + user)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "active@test.cz", password: "Password123!" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("active@test.cz");
    expect(body.user.role).toBe("CLIENT");

    accessToken = body.accessToken;

    // Extract refresh cookie
    const cookies = res.cookies as Array<{ name: string; value: string }>;
    const rc = cookies.find((c) => c.name === "refreshToken");
    expect(rc).toBeDefined();
    refreshCookie = rc!.value;
  });

  it("POST /auth/login — invalid password (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "active@test.cz", password: "WrongPassword!" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("POST /auth/login — inactive user (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "inactive@test.cz", password: "Password123!" },
    });

    expect(res.statusCode).toBe(403);
  });

  // ── GET /auth/me ─────────────────────────────────────────────────────

  it("GET /auth/me — with valid token (200 + user)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe("active@test.cz");
    expect(body.name).toBe("Active User");
    expect(body.passwordHash).toBeUndefined();
  });

  it("GET /auth/me — without token (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(res.statusCode).toBe(401);
  });

  // ── POST /auth/refresh ──────────────────────────────────────────────

  it("POST /auth/refresh — valid refresh cookie (200 + new token)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refreshToken: refreshCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("active@test.cz");

    // Update tokens (refresh rotates the token)
    accessToken = body.accessToken;
    const cookies = res.cookies as Array<{ name: string; value: string }>;
    const rc = cookies.find((c) => c.name === "refreshToken");
    expect(rc).toBeDefined();
    refreshCookie = rc!.value;
  });

  it("POST /auth/refresh — missing cookie (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });

    expect(res.statusCode).toBe(401);
  });

  it("POST /auth/refresh — invalid cookie (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refreshToken: "invalid-token-value" },
    });

    expect(res.statusCode).toBe(401);
  });

  // ── POST /auth/logout ───────────────────────────────────────────────

  it("POST /auth/logout — success (200, cookie cleared)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { authorization: `Bearer ${accessToken}` },
      cookies: { refreshToken: refreshCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // After logout, the old refresh token should no longer work
    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refreshToken: refreshCookie },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});
