/**
 * Integration tests — /export/clients.csv, /export/appointments.csv, /export/invoices.csv
 * Tests: CSV content-type headers, RBAC, date filtering, CSV structure
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
    payment_method TEXT,
    payment_paid_at INTEGER,
    foundation_notified_at TEXT,
    reminder_sent_at TEXT,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    source_month TEXT,
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
  CREATE TABLE IF NOT EXISTS loyalty_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    points REAL NOT NULL,
    type TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  process.env.JWT_SECRET = "test-secret-export-routes-suite-min64chars!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-export-routes-suite-min64chars!!!!!!!!!!";
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

  db.insert(users).values({ email: `ex-admin-${ts}@test.cz`, passwordHash: admHash, name: "Admin EX", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: `ex-rec-${ts}@test.cz`, passwordHash: recHash, name: "Recepce EX", role: "RECEPTION" }).returning().get();
  const empRes = db.insert(users).values({ email: `ex-emp-${ts}@test.cz`, passwordHash: empHash, name: "Terapeut EX", role: "EMPLOYEE" }).returning().get();
  employeeUserId = empRes.id;
  const cliRes = db.insert(users).values({ email: `ex-client-${ts}@test.cz`, passwordHash: cliHash, name: "Klient EX", role: "CLIENT" }).returning().get();
  clientUserId = cliRes.id;

  const svcRes = db.insert(services).values({ name: "Export Test Service", durationMin: 60, price: 1500, isActive: true }).returning().get();
  serviceId = svcRes.id;

  // Seed an appointment for export tests
  rawSqlite.prepare(
    `INSERT INTO appointments (client_id, employee_id, service_id, start_time, end_time, status, price)
     VALUES (?, ?, ?, '2025-03-15T10:00:00.000Z', '2025-03-15T11:00:00.000Z', 'COMPLETED', 1500)`
  ).run(clientUserId, employeeUserId, serviceId);

  // Seed an invoice for export tests
  rawSqlite.prepare(
    `INSERT INTO invoices (invoice_number, client_id, status, total, due_date, created_at)
     VALUES ('INV-EXPORT-001', ?, 'PAID', 1500, '2025-04-01', '2025-03-20T10:00:00.000Z')`
  ).run(clientUserId);

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ex-admin-${ts}@test.cz`, password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ex-rec-${ts}@test.cz`, password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ex-emp-${ts}@test.cz`, password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ex-client-${ts}@test.cz`, password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /export/clients.csv — RBAC and content", () => {
  it("admin can export clients CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/clients.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("clients.csv");
  });

  it("reception can export clients CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/clients.csv",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  });

  it("employee cannot export clients CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/clients.csv",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot export clients CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/clients.csv",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("CSV has correct header row", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/clients.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.body.replace(/^\uFEFF/, ""); // strip BOM
    const lines = body.split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe("id,name,email,phone,created_at,behavior_score,loyalty_points");
  });

  it("CSV contains the seeded client data row", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/clients.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.body.replace(/^\uFEFF/, "");
    expect(body).toContain("Klient EX");
    expect(body).toContain(`ex-client-${ts}@test.cz`);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/export/clients.csv" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /export/appointments.csv — RBAC, filtering, content", () => {
  it("admin can export appointments CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("appointments.csv");
  });

  it("reception can export appointments CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("employee cannot export appointments CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot export appointments CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("CSV has correct header row", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.body.replace(/^\uFEFF/, "");
    const firstLine = body.split(/\r?\n/)[0];
    expect(firstLine).toBe("id,date,client,employee,service,status,price");
  });

  it("date filter from=2025-03-01&to=2025-03-31 returns the seeded appointment", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv?from=2025-03-01&to=2025-03-31",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.body.replace(/^\uFEFF/, "");
    const lines = body.split(/\r?\n/).filter(Boolean);
    // Header + at least 1 data row
    expect(lines.length).toBeGreaterThan(1);
    expect(body).toContain("Klient EX");
  });

  it("date filter outside appointment range returns only header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv?from=2020-01-01&to=2020-01-31",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.body.replace(/^\uFEFF/, "");
    const lines = body.split(/\r?\n/).filter(Boolean);
    expect(lines).toHaveLength(1); // only header
  });

  it("CSV response starts with BOM (UTF-8)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/appointments.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    // BOM is \uFEFF
    expect(res.body.charCodeAt(0)).toBe(0xFEFF);
  });
});

describe("GET /export/invoices.csv — admin only, RBAC, content", () => {
  it("admin can export invoices CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("invoices.csv");
  });

  it("reception cannot export invoices CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("employee cannot export invoices CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot export invoices CSV (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("CSV has correct header row", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.body.replace(/^\uFEFF/, "");
    const firstLine = body.split(/\r?\n/)[0];
    expect(firstLine).toBe("id,invoice_number,client,total,status,due_date,paid_at,created_at");
  });

  it("date filter returns the seeded invoice", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv?from=2025-03-01&to=2025-03-31",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.body.replace(/^\uFEFF/, "");
    const lines = body.split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBeGreaterThan(1);
    expect(body).toContain("INV-EXPORT-001");
    expect(body).toContain("Klient EX");
  });

  it("date filter excludes invoices outside range", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/export/invoices.csv?from=2020-01-01&to=2020-12-31",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.body.replace(/^\uFEFF/, "");
    const lines = body.split(/\r?\n/).filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/export/invoices.csv" });
    expect(res.statusCode).toBe(401);
  });
});
