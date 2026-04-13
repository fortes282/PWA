/**
 * Integration tests — /off-peak/rules & /off-peak/check
 * Tests: CRUD, RBAC, validation, check endpoint
 */
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
  CREATE TABLE IF NOT EXISTS off_peak_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    discount_percent INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
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
    capacity INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS open_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    service_id INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'open',
    max_bookings INTEGER NOT NULL DEFAULT 1,
    current_bookings INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    slot_id INTEGER,
    is_out_of_slot INTEGER NOT NULL DEFAULT 0,
    room_id INTEGER,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    cancellation_reason TEXT,
    price REAL,
    paid_at TEXT,
    payment_method TEXT,
    booking_activated INTEGER NOT NULL DEFAULT 0,
    client_note TEXT,
    is_online INTEGER NOT NULL DEFAULT 0,
    cancellation_risk_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    appointment_id INTEGER,
    invoice_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
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
    client_id INTEGER NOT NULL,
    invoice_type TEXT NOT NULL DEFAULT 'GENERAL',
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
    invoice_id INTEGER NOT NULL,
    appointment_id INTEGER,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    employee_id INTEGER,
    preferred_dates TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING',
    notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS medical_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    appointment_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    points REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    target_id INTEGER,
    target_type TEXT,
    details TEXT,
    ip TEXT,
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
    matched_invoice_id INTEGER,
    matched_client_id INTEGER,
    is_matched INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    blood_type TEXT,
    allergies TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cancellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    reason TEXT,
    is_unjustified INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS profile_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    changed_by INTEGER NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewed_by INTEGER,
    review_note TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const ts = Date.now();

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let employeeToken: string;
let clientToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-off-peak-suite-min64chars!!!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-off-peak-suite-min64chars!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_MAX = "1000000";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const admHash = await hashPassword("Admin123!");
  const recHash = await hashPassword("Recepce1!");
  const empHash = await hashPassword("Terapeut123!");
  const cliHash = await hashPassword("Klient123!");

  db.insert(users).values({ email: `op-admin-${ts}@test.cz`, passwordHash: admHash, name: "Admin OP", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: `op-rec-${ts}@test.cz`, passwordHash: recHash, name: "Recepce OP", role: "RECEPTION" }).returning().get();
  db.insert(users).values({ email: `op-emp-${ts}@test.cz`, passwordHash: empHash, name: "Terapeut OP", role: "EMPLOYEE" }).returning().get();
  db.insert(users).values({ email: `op-client-${ts}@test.cz`, passwordHash: cliHash, name: "Klient OP", role: "CLIENT" }).returning().get();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `op-admin-${ts}@test.cz`, password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `op-rec-${ts}@test.cz`, password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `op-emp-${ts}@test.cz`, password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `op-client-${ts}@test.cz`, password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /off-peak/rules — RBAC", () => {
  it("admin can list off-peak rules", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("reception cannot list off-peak rules (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("employee cannot list off-peak rules (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot list off-peak rules (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/off-peak/rules" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /off-peak/rules — CRUD and validation", () => {
  let ruleId: number;

  it("admin can create a valid off-peak rule", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 1, startTime: "06:00", endTime: "09:00", discountPercent: 20 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.dayOfWeek).toBe(1);
    expect(body.discountPercent).toBe(20);
    ruleId = body.id;
  });

  it("created rule appears in GET /off-peak/rules", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const rules = res.json();
    expect(rules.some((r: { id: number }) => r.id === ruleId)).toBe(true);
  });

  it("returns 400 when dayOfWeek is out of range (> 6)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 7, startTime: "06:00", endTime: "09:00", discountPercent: 20 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/dayOfWeek/);
  });

  it("returns 400 when dayOfWeek is negative", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: -1, startTime: "06:00", endTime: "09:00", discountPercent: 20 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when discountPercent is 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 2, startTime: "06:00", endTime: "09:00", discountPercent: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/discountPercent/);
  });

  it("returns 400 when discountPercent exceeds 100", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 2, startTime: "06:00", endTime: "09:00", discountPercent: 101 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when startTime is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 2, endTime: "09:00", discountPercent: 15 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("non-admin cannot create rules (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { dayOfWeek: 3, startTime: "07:00", endTime: "10:00", discountPercent: 10 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE /off-peak/rules/:id — admin can deactivate rule", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/off-peak/rules/${ruleId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("deleted rule no longer appears in GET /off-peak/rules", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const rules = res.json();
    expect(rules.some((r: { id: number }) => r.id === ruleId)).toBe(false);
  });

  it("DELETE returns 404 for non-existent rule", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/off-peak/rules/999999",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/not found/i);
  });

  it("non-admin cannot delete rules (403)", async () => {
    // Create a rule to try to delete
    const created = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 5, startTime: "08:00", endTime: "11:00", discountPercent: 30 },
    });
    const newRuleId = created.json().id;

    const res = await app.inject({
      method: "DELETE",
      url: `/off-peak/rules/${newRuleId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /off-peak/check — discount calculation", () => {
  let checkRuleId: number;

  beforeAll(async () => {
    // Create a known rule: Monday (dayOfWeek=1), 06:00-09:00, 25%
    const res = await app.inject({
      method: "POST",
      url: "/off-peak/rules",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { dayOfWeek: 1, startTime: "06:00", endTime: "09:00", discountPercent: 25 },
    });
    checkRuleId = res.json().id;
  });

  it("returns offPeak=true and correct discount for matching time", async () => {
    // 2025-04-07 is a Monday
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/check?date=2025-04-07&time=07:00",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offPeak).toBe(true);
    expect(body.discountPercent).toBe(25);
    expect(body.ruleId).toBe(checkRuleId);
  });

  it("returns offPeak=false for non-matching time", async () => {
    // 2025-04-07 is a Monday but 14:00 is outside the rule's 06:00-09:00 window
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/check?date=2025-04-07&time=14:00",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offPeak).toBe(false);
    expect(body.discountPercent).toBe(0);
    expect(body.ruleId).toBeNull();
  });

  it("returns offPeak=false for different day of week", async () => {
    // 2025-04-08 is a Tuesday (dayOfWeek=2), not Monday
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/check?date=2025-04-08&time=07:00",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().offPeak).toBe(false);
  });

  it("returns 400 when date is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/check?time=07:00",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/date/);
  });

  it("returns 400 when time is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/off-peak/check?date=2025-04-07",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/time/);
  });

  it("check endpoint is accessible by all authenticated roles", async () => {
    for (const token of [adminToken, receptionToken, employeeToken, clientToken]) {
      const res = await app.inject({
        method: "GET",
        url: "/off-peak/check?date=2025-04-07&time=07:00",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});
