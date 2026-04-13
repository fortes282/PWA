/**
 * Integration tests — GET /heatmap/therapists
 * Tests: RBAC, required params, response structure, data aggregation
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services } from "../db/schema.js";
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
    category TEXT,
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
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
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
let clientUserId: number;
let employeeUserId: number;
let serviceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-heatmap-routes-suite-min64chars!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-heatmap-routes-suite-min64chars!!!!!!!!!";
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

  db.insert(users).values({ email: `hm-admin-${ts}@test.cz`, passwordHash: admHash, name: "Admin HM", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: `hm-rec-${ts}@test.cz`, passwordHash: recHash, name: "Recepce HM", role: "RECEPTION" }).returning().get();
  const empRes = db.insert(users).values({ email: `hm-emp-${ts}@test.cz`, passwordHash: empHash, name: "Terapeut HM", role: "EMPLOYEE" }).returning().get();
  employeeUserId = empRes.id;
  const cliRes = db.insert(users).values({ email: `hm-client-${ts}@test.cz`, passwordHash: cliHash, name: "Klient HM", role: "CLIENT" }).returning().get();
  clientUserId = cliRes.id;

  const svcRes = db.insert(services).values({ name: "Heatmap Test Service", durationMin: 60, price: 1000, isActive: true }).returning().get();
  serviceId = svcRes.id;

  // Seed appointments at known times for the heatmap
  // 2025-04-01 10:00 UTC (hour 10) — CONFIRMED
  rawSqlite.prepare(
    `INSERT INTO appointments (client_id, employee_id, service_id, start_time, end_time, status, price)
     VALUES (?, ?, ?, '2025-04-01T10:00:00.000Z', '2025-04-01T11:00:00.000Z', 'CONFIRMED', 1000)`
  ).run(clientUserId, employeeUserId, serviceId);

  // 2025-04-02 14:00 UTC (hour 14) — CONFIRMED
  rawSqlite.prepare(
    `INSERT INTO appointments (client_id, employee_id, service_id, start_time, end_time, status, price)
     VALUES (?, ?, ?, '2025-04-02T14:00:00.000Z', '2025-04-02T15:00:00.000Z', 'CONFIRMED', 1000)`
  ).run(clientUserId, employeeUserId, serviceId);

  // 2025-04-03 10:00 UTC (hour 10) — CANCELLED (should be excluded)
  rawSqlite.prepare(
    `INSERT INTO appointments (client_id, employee_id, service_id, start_time, end_time, status, price)
     VALUES (?, ?, ?, '2025-04-03T10:00:00.000Z', '2025-04-03T11:00:00.000Z', 'CANCELLED', 1000)`
  ).run(clientUserId, employeeUserId, serviceId);

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `hm-admin-${ts}@test.cz`, password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `hm-rec-${ts}@test.cz`, password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `hm-emp-${ts}@test.cz`, password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `hm-client-${ts}@test.cz`, password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /heatmap/therapists — RBAC", () => {
  it("admin can access heatmap", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("reception can access heatmap", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("employee cannot access heatmap (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/Forbidden/i);
  });

  it("client cannot access heatmap (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /heatmap/therapists — parameter validation", () => {
  it("returns 400 when 'from' is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/from/i);
  });

  it("returns 400 when 'to' is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/to/i);
  });

  it("returns 400 when both params are missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /heatmap/therapists — response structure", () => {
  it("response contains from, to, therapists array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("from", "2025-04-01");
    expect(body).toHaveProperty("to", "2025-04-30");
    expect(Array.isArray(body.therapists)).toBe(true);
  });

  it("each therapist entry has therapistId, therapistName, hours, total", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const therapists = res.json().therapists as {
      therapistId: number;
      therapistName: string;
      hours: Record<number, number>;
      total: number;
    }[];
    expect(therapists.length).toBeGreaterThan(0);
    const myTherapist = therapists.find((t) => t.therapistId === employeeUserId);
    expect(myTherapist).toBeDefined();
    expect(typeof myTherapist?.therapistName).toBe("string");
    expect(typeof myTherapist?.total).toBe("number");
    expect(typeof myTherapist?.hours).toBe("object");
  });

  it("hours object has keys 0-23 for each therapist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const therapists = res.json().therapists as { hours: Record<string, number> }[];
    for (const therapist of therapists) {
      for (let h = 0; h < 24; h++) {
        expect(therapist.hours).toHaveProperty(String(h));
      }
    }
  });

  it("hour counts reflect the seeded appointments (excludes CANCELLED)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const therapists = res.json().therapists as {
      therapistId: number;
      hours: Record<string, number>;
      total: number;
    }[];
    const myTherapist = therapists.find((t) => t.therapistId === employeeUserId);
    expect(myTherapist).toBeDefined();

    // 2 non-cancelled appointments (CANCELLED one is excluded)
    expect(myTherapist?.total).toBe(2);

    // The heatmap uses new Date(startTime).getHours() — local time.
    // Compute expected hours the same way the route does, to be timezone-agnostic.
    const hour1 = new Date("2025-04-01T10:00:00.000Z").getHours();
    const hour2 = new Date("2025-04-02T14:00:00.000Z").getHours();
    expect(myTherapist?.hours[hour1]).toBeGreaterThanOrEqual(1);
    expect(myTherapist?.hours[hour2]).toBeGreaterThanOrEqual(1);
    // Total hours count across all slots should equal 2
    const totalCount = Object.values(myTherapist?.hours ?? {}).reduce((s, v) => s + v, 0);
    expect(totalCount).toBe(2);
  });

  it("date range filter excludes appointments outside the range", async () => {
    // Request only 2025-04-01 to 2025-04-01 (only the first appointment)
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-01",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const therapists = res.json().therapists as {
      therapistId: number;
      hours: Record<string, number>;
      total: number;
    }[];
    const myTherapist = therapists.find((t) => t.therapistId === employeeUserId);
    expect(myTherapist?.total).toBe(1);
    // The single appointment on 2025-04-01T10:00:00Z
    const hour1 = new Date("2025-04-01T10:00:00.000Z").getHours();
    expect(myTherapist?.hours[hour1]).toBe(1);
    // Total across all hours = 1
    const totalCount = Object.values(myTherapist?.hours ?? {}).reduce((s, v) => s + v, 0);
    expect(totalCount).toBe(1);
  });

  it("total is 0 for therapist with no appointments in range", async () => {
    // Add a second employee with no appointments
    const noApptHash = await hashPassword("NoAppt123!");
    const noApptEmp = db.insert(users).values({ email: `hm-noappt-${ts}@test.cz`, passwordHash: noApptHash, name: "No Appt Emp", role: "EMPLOYEE" }).returning().get();

    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2025-04-01&to=2025-04-30",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const therapists = res.json().therapists as { therapistId: number; total: number }[];
    const zeroTherapist = therapists.find((t) => t.therapistId === noApptEmp.id);
    expect(zeroTherapist?.total).toBe(0);
  });

  it("far-future range returns therapists with zero totals", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/heatmap/therapists?from=2099-01-01&to=2099-12-31",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const therapists = res.json().therapists as { total: number }[];
    therapists.forEach((t) => {
      expect(t.total).toBe(0);
    });
  });
});
