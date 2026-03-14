/**
 * Integration tests — /stats
 * Tests: RBAC, stats structure, date filtering
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, appointments } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
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
let clientToken: string;
let clientId: number;
let employeeId: number;
let serviceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-stats-suite-min64chars!!!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const admHash = await hashPassword("Admin123!");
  const recHash = await hashPassword("Recepce1!");
  const cliHash = await hashPassword("Klient123!");
  const empHash = await hashPassword("Emp123!");

  const cliRes = db.insert(users).values({ email: "st-client@test.cz", passwordHash: cliHash, name: "Klient Stats", role: "CLIENT" }).returning().get();
  clientId = cliRes.id;
  const empRes = db.insert(users).values({ email: "st-emp@test.cz", passwordHash: empHash, name: "Terapeut Stats", role: "EMPLOYEE" }).returning().get();
  employeeId = empRes.id;
  db.insert(users).values({ email: "st-admin@test.cz", passwordHash: admHash, name: "Admin Stats", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: "st-rec@test.cz", passwordHash: recHash, name: "Recepce Stats", role: "RECEPTION" }).returning().get();

  const svcRes = db.insert(services).values({ name: "Masáž Stats", durationMin: 60, price: 1200, isActive: true }).returning().get();
  serviceId = svcRes.id;

  // Seed some appointments for stats
  const pastStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 3600_000).toISOString();
  db.insert(appointments).values({ clientId, employeeId, serviceId, startTime: pastStart, endTime: pastEnd, status: "COMPLETED", price: 1200, bookingActivated: true }).run();
  db.insert(appointments).values({ clientId, employeeId, serviceId, startTime: pastStart, endTime: pastEnd, status: "NO_SHOW", price: 1200, bookingActivated: true }).run();
  db.insert(appointments).values({ clientId, employeeId, serviceId, startTime: pastStart, endTime: pastEnd, status: "CANCELLED", price: 1200, bookingActivated: false }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "st-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "st-rec@test.cz", password: "Recepce1!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "st-client@test.cz", password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Stats — RBAC", () => {
  it("admin can access stats", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("reception can access stats", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client cannot access stats (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Stats — data structure", () => {
  it("returns correct appointment counts", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    expect(typeof body.totalAppts).toBe("number");
    expect(typeof body.completedAppts).toBe("number");
    expect(typeof body.cancelledAppts).toBe("number");
    expect(typeof body.noShowAppts).toBe("number");
    expect(typeof body.revenue).toBe("number");
    // We seeded 3 appointments
    expect(body.totalAppts).toBe(3);
    expect(body.completedAppts).toBe(1);
    expect(body.noShowAppts).toBe(1);
    expect(body.cancelledAppts).toBe(1);
    expect(body.revenue).toBe(1200);
  });

  it("returns no-show rate correctly", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    // closedAppts = 2 (COMPLETED + NO_SHOW), noShow = 1 → 50%
    expect(body.noShowRate).toBe(50);
  });

  it("returns client and employee counts", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    expect(body.totalClients).toBeGreaterThanOrEqual(1);
    expect(body.totalEmployees).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.topServices)).toBe(true);
    expect(Array.isArray(body.topEmployees)).toBe(true);
  });

  it("date filter — from/to limits results", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: "GET", url: `/stats?from=${future}&to=${future}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    // No appointments in the future window
    expect(res.json().totalAppts).toBe(0);
  });

  it("occupancyByDay is an object with date keys", async () => {
    const res = await app.inject({
      method: "GET", url: "/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    expect(typeof body.occupancyByDay).toBe("object");
  });
});
