/**
 * Integration tests — /wellbeing/*
 * Tests: POST survey, GET my-history, GET team-overview, RBAC
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
  CREATE TABLE IF NOT EXISTS wellbeing_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week TEXT NOT NULL,
    q1 INTEGER NOT NULL,
    q2 INTEGER NOT NULL,
    q3 INTEGER NOT NULL,
    q4 INTEGER NOT NULL,
    q5 INTEGER NOT NULL,
    average_score REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
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
  process.env.JWT_SECRET = "test-secret-wellbeing-suite-min64chars!!!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-wellbeing-suite-min64chars!!!!!!!!!!!!!!!";
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

  db.insert(users).values({ email: `wb-admin-${ts}@test.cz`, passwordHash: admHash, name: "Admin WB", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: `wb-rec-${ts}@test.cz`, passwordHash: recHash, name: "Recepce WB", role: "RECEPTION" }).returning().get();
  db.insert(users).values({ email: `wb-emp-${ts}@test.cz`, passwordHash: empHash, name: "Terapeut WB", role: "EMPLOYEE" }).returning().get();
  db.insert(users).values({ email: `wb-client-${ts}@test.cz`, passwordHash: cliHash, name: "Klient WB", role: "CLIENT" }).returning().get();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `wb-admin-${ts}@test.cz`, password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `wb-rec-${ts}@test.cz`, password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `wb-emp-${ts}@test.cz`, password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `wb-client-${ts}@test.cz`, password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("POST /wellbeing/survey — RBAC and validation", () => {
  it("employee can submit a wellbeing survey", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { q1: 4, q2: 3, q3: 4, q4: 3, q5: 4, week: "2026-W10" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.survey).toBeDefined();
    expect(body.survey.week).toBe("2026-W10");
    expect(body.survey.averageScore).toBeCloseTo((4 + 3 + 4 + 3 + 4) / 5, 2);
  });

  it("admin can also submit a wellbeing survey", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, week: "2026-W11" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().survey.averageScore).toBeCloseTo(5, 2);
  });

  it("client cannot submit wellbeing survey (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("reception cannot submit wellbeing survey (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 when q1 is out of range (> 5)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { q1: 6, q2: 3, q3: 3, q4: 3, q5: 3 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/q1/);
  });

  it("returns 400 when q3 is below range (< 1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { q1: 3, q2: 3, q3: 0, q4: 3, q5: 3 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/q3/);
  });

  it("returns 400 when a score is not an integer", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { q1: 3, q2: 3.5, q3: 3, q4: 3, q5: 3 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/q2/);
  });

  it("submitting for the same week replaces the previous entry (upsert)", async () => {
    // First submission
    await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { q1: 2, q2: 2, q3: 2, q4: 2, q5: 2, week: "2026-W20" },
    });

    // Second submission for same week — should upsert
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, week: "2026-W20" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().survey.averageScore).toBeCloseTo(4, 2);

    // Verify only one entry exists for this week
    const rows = rawSqlite
      .prepare("SELECT COUNT(*) as cnt FROM wellbeing_surveys WHERE week = '2026-W20'")
      .get() as { cnt: number };
    expect(rows.cnt).toBe(1);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/wellbeing/survey",
      payload: { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3 },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /wellbeing/my-history — employee view", () => {
  it("employee can view their own wellbeing history", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.history)).toBe(true);
    expect(typeof body.hasCurrentWeek).toBe("boolean");
    expect(typeof body.currentWeek).toBe("string");
    expect(Array.isArray(body.tips)).toBe(true);
  });

  it("history contains the surveys submitted in earlier tests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    const history = res.json().history as { week: string }[];
    expect(history.some((s) => s.week === "2026-W10")).toBe(true);
  });

  it("history is limited to 12 weeks max", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.json().history.length).toBeLessThanOrEqual(12);
  });

  it("trend field is one of improving/declining/stable", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(["improving", "declining", "stable"]).toContain(res.json().trend);
  });

  it("avgScore is null when no history exists (fresh employee)", async () => {
    const freshHash = await hashPassword("Fresh123!");
    const freshUser = db.insert(users).values({ email: `wb-fresh-${ts}@test.cz`, passwordHash: freshHash, name: "Fresh Emp", role: "EMPLOYEE" }).returning().get();
    const freshToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `wb-fresh-${ts}@test.cz`, password: "Fresh123!" } })).json().accessToken;

    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${freshToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().history).toHaveLength(0);
    expect(res.json().avgScore).toBeNull();
    expect(freshUser.id).toBeGreaterThan(0);
  });

  it("client cannot view wellbeing history (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("reception cannot view wellbeing history (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/my-history",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /wellbeing/team-overview — admin view", () => {
  it("admin can view team overview", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/team-overview",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.totalEmployees).toBe("number");
    expect(typeof body.respondentsLast4Weeks).toBe("number");
    expect(typeof body.belowThresholdCount).toBe("number");
    expect(typeof body.alertCount).toBe("number");
    expect(body.overtime).toBeDefined();
    expect(body.caseload).toBeDefined();
    expect(Array.isArray(body.weeklyTrend)).toBe(true);
  });

  it("response includes overtime and caseload with correct structure", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/team-overview",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    expect(typeof body.overtime.avgHoursPerWeek).toBe("number");
    expect(typeof body.overtime.totalHoursLastWeek).toBe("number");
    expect(typeof body.caseload.avgClientsPerTherapist).toBe("number");
    expect(typeof body.caseload.avgSessionDurationMin).toBe("number");
  });

  it("employee cannot view team overview (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/team-overview",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("reception cannot view team overview (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/team-overview",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot view team overview (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/team-overview",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("weeklyTrend is ordered chronologically (ascending)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/wellbeing/team-overview",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const trend = res.json().weeklyTrend as { week: string }[];
    if (trend.length > 1) {
      for (let i = 1; i < trend.length; i++) {
        expect(trend[i].week >= trend[i - 1].week).toBe(true);
      }
    }
    expect(true).toBe(true); // passes if 0 or 1 entries
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/wellbeing/team-overview" });
    expect(res.statusCode).toBe(401);
  });
});
