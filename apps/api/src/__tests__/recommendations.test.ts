/**
 * NOC 16/9 — Smart Recommendations
 * GET /recommendations/rebooking, /recommendations/at-risk, /recommendations/loyalty-rewards
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
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, cancellation_reason TEXT, client_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
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
let riskClientId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-recommend-noc16-min64chars!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const hash = await hashPassword("Pass123!");

  const admin = db.insert(users).values({ email: "rec-admin@test.cz", passwordHash: hash, name: "Admin REC", role: "ADMIN" }).returning().get();
  const reception = db.insert(users).values({ email: "rec-recep@test.cz", passwordHash: hash, name: "Recepce REC", role: "RECEPTION" }).returning().get();
  const emp = db.insert(users).values({ email: "rec-emp@test.cz", passwordHash: hash, name: "Terapeut REC", role: "EMPLOYEE" }).returning().get();
  // Good client — has recent completed appointment
  const goodClient = db.insert(users).values({ email: "rec-good@test.cz", passwordHash: hash, name: "Dobrý klient", role: "CLIENT", behaviorScore: 95 }).returning().get();
  // At-risk client — low behavior score
  const riskClient = db.insert(users).values({ email: "rec-risk@test.cz", passwordHash: hash, name: "Rizikový klient", role: "CLIENT", behaviorScore: 40 }).returning().get();
  riskClientId = riskClient.id;

  const svc = db.insert(services).values({ name: "Terapie REC", durationMin: 60, price: 700, isActive: true }).returning().get();

  // Good client: completed appointment 7 days ago, no upcoming
  const recentPast = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentPastEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600000).toISOString();
  db.insert(appointments).values({
    clientId: goodClient.id, employeeId: emp.id, serviceId: svc.id,
    startTime: recentPast, endTime: recentPastEnd, status: "COMPLETED", price: 700, bookingActivated: true,
  }).run();

  // Risk client: unjustified cancel 10 days ago
  const oldPast = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const oldPastEnd = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 3600000).toISOString();
  db.insert(appointments).values({
    clientId: riskClient.id, employeeId: emp.id, serviceId: svc.id,
    startTime: oldPast, endTime: oldPastEnd, status: "UNJUSTIFIED_CANCEL", price: 700, bookingActivated: true,
  }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "rec-admin@test.cz", password: "Pass123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "rec-recep@test.cz", password: "Pass123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "rec-good@test.cz", password: "Pass123!" } })).json().accessToken;
});

afterAll(async () => { await app.close(); });

describe("Smart Recommendations", () => {
  it("test 1: GET /recommendations/rebooking returns clients needing rebooking (RECEPTION)", async () => {
    const res = await app.inject({
      method: "GET", url: "/recommendations/rebooking?days=30",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty("daysSinceLastVisit");
    expect(rows[0]).toHaveProperty("recommendation");
  });

  it("test 2: GET /recommendations/at-risk returns low-behavior clients", async () => {
    const res = await app.inject({
      method: "GET", url: "/recommendations/at-risk",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(Array.isArray(rows)).toBe(true);
    // Risk client should appear (behaviorScore 40)
    expect(rows.some((r: any) => r.id === riskClientId)).toBe(true);
    const risk = rows.find((r: any) => r.id === riskClientId);
    expect(risk?.risks.length).toBeGreaterThan(0);
  });

  it("test 3: GET /recommendations/loyalty-rewards returns clients near milestone", async () => {
    const res = await app.inject({
      method: "GET", url: "/recommendations/loyalty-rewards",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json();
    expect(Array.isArray(rows)).toBe(true);
    // May be empty if no loyalty points, that's OK
  });

  it("test 4: CLIENT cannot access recommendations — 403", async () => {
    const res = await app.inject({
      method: "GET", url: "/recommendations/rebooking",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
