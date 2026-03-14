/**
 * Integration tests — /working-hours
 * Tests: list, upsert, toggle, RBAC
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
    email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100,
    email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0,
    push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, appointment_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, service_id INTEGER NOT NULL, employee_id INTEGER, preferred_dates TEXT, status TEXT NOT NULL DEFAULT 'WAITING', notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, metadata TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', total REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, paid_at TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, total REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS medical_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, appointment_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, diagnosis TEXT, recommendations TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS behavior_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, points REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS profile_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, changed_by INTEGER NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS fio_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, fio_id TEXT NOT NULL UNIQUE, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CZK', variable_symbol TEXT, note TEXT, counter_account TEXT, counter_name TEXT, transaction_date TEXT NOT NULL, matched_invoice_id INTEGER, matched_client_id INTEGER, is_matched INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL UNIQUE, blood_type TEXT, allergies TEXT, contraindications TEXT, medications TEXT, chronic_conditions TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, primary_diagnosis TEXT, functional_status TEXT, rehab_goals TEXT, notes TEXT, last_updated_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, amount REAL NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'PENDING', reviewed_by INTEGER, review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let employeeToken: string;
let clientToken: string;
let employeeId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-working-hours-suite-min64chars!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const admHash = await hashPassword("Admin123!");
  const recHash = await hashPassword("Recepce1!");
  const empHash = await hashPassword("Terapeut123!");
  const cliHash = await hashPassword("Klient123!");

  db.insert(users).values({ email: "wh-admin@test.cz", passwordHash: admHash, name: "Admin WH", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: "wh-reception@test.cz", passwordHash: recHash, name: "Recepce WH", role: "RECEPTION" }).returning().get();
  const empRes = db.insert(users).values({ email: "wh-emp@test.cz", passwordHash: empHash, name: "Terapeut WH", role: "EMPLOYEE" }).returning().get();
  employeeId = empRes.id;
  db.insert(users).values({ email: "wh-client@test.cz", passwordHash: cliHash, name: "Klient WH", role: "CLIENT" }).returning().get();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "wh-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "wh-reception@test.cz", password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "wh-emp@test.cz", password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "wh-client@test.cz", password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Working hours — RBAC", () => {
  it("admin can list working hours", async () => {
    const res = await app.inject({
      method: "GET", url: "/working-hours",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("reception can list working hours", async () => {
    const res = await app.inject({
      method: "GET", url: "/working-hours",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("employee can list working hours", async () => {
    const res = await app.inject({
      method: "GET", url: "/working-hours",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client cannot list working hours (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/working-hours",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Working hours — CRUD", () => {
  // PUT /working-hours/:employeeId takes an array of { dayOfWeek, startTime, endTime, isActive }
  it("admin can set working hours for an employee (bulk PUT)", async () => {
    const res = await app.inject({
      method: "PUT", url: `/working-hours/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", isActive: true },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true },
      ],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body.find((h: any) => h.dayOfWeek === 1)?.startTime).toBe("08:00");
  });

  it("reception can replace working hours for an employee", async () => {
    const res = await app.inject({
      method: "PUT", url: `/working-hours/${employeeId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: [
        { dayOfWeek: 1, startTime: "07:00", endTime: "15:00", isActive: true },
        { dayOfWeek: 3, startTime: "10:00", endTime: "18:00", isActive: true },
      ],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should now have 2 entries (Mon + Wed)
    expect(body.find((h: any) => h.dayOfWeek === 1)?.startTime).toBe("07:00");
    expect(body.find((h: any) => h.dayOfWeek === 3)?.startTime).toBe("10:00");
  });

  it("employee can view their own working hours by employeeId", async () => {
    const res = await app.inject({
      method: "GET", url: `/working-hours?employeeId=${employeeId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("admin can update (deactivate) a single working hour entry", async () => {
    // Get the entries first
    const listRes = await app.inject({
      method: "GET", url: `/working-hours?employeeId=${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const rows = listRes.json();
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0];

    const patchRes = await app.inject({
      method: "PATCH", url: `/working-hours/${firstRow.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isActive: false },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().isActive).toBe(false);
  });

  it("bulk PUT replaces all existing hours (idempotent)", async () => {
    const res1 = await app.inject({
      method: "PUT", url: `/working-hours/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: [
        { dayOfWeek: 4, startTime: "08:00", endTime: "16:00", isActive: true },
      ],
    });
    expect(res1.statusCode).toBe(200);
    // Only 1 entry now (Thu), previous entries deleted
    expect(res1.json()).toHaveLength(1);
    expect(res1.json()[0].dayOfWeek).toBe(4);
  });

  it("client cannot set working hours (403)", async () => {
    const res = await app.inject({
      method: "PUT", url: `/working-hours/${employeeId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: [],
    });
    expect(res.statusCode).toBe(403);
  });
});
