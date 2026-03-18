/**
 * NOC 14 — Appointment client notes tests
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, category TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, cancellation_reason TEXT, client_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, appointment_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, service_id INTEGER NOT NULL, employee_id INTEGER, preferred_dates TEXT, status TEXT NOT NULL DEFAULT 'WAITING', notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, metadata TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', total REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, paid_at TEXT, notes TEXT, payment_method TEXT, payment_paid_at INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, total REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS medical_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, appointment_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, diagnosis TEXT, recommendations TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS behavior_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, points REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS profile_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, changed_by INTEGER NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS fio_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, fio_id TEXT NOT NULL UNIQUE, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CZK', variable_symbol TEXT, note TEXT, counter_account TEXT, counter_name TEXT, transaction_date TEXT NOT NULL, matched_invoice_id INTEGER, matched_client_id INTEGER, is_matched INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL UNIQUE, blood_type TEXT, allergies TEXT, contraindications TEXT, medications TEXT, chronic_conditions TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, primary_diagnosis TEXT, functional_status TEXT, rehab_goals TEXT, notes TEXT, last_updated_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, amount REAL NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'PENDING', reviewed_by INTEGER, review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, target_id INTEGER, target_type TEXT, details TEXT, ip TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS appointment_series (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, client_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, day_of_week INTEGER NOT NULL, frequency TEXT NOT NULL DEFAULT 'WEEKLY', start_date TEXT NOT NULL, end_date TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS time_off_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, start_date_time TEXT NOT NULL, end_date_time TEXT NOT NULL, reason TEXT, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let receptionToken: string;
let clientId: number;
let employeeId: number;
let serviceId: number;
let appointmentId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-appt-notes-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  const client = db.insert(users).values({ email: "notes-client@test.cz", passwordHash: h, name: "Klient Notes", role: "CLIENT" }).returning().get();
  const emp = db.insert(users).values({ email: "notes-emp@test.cz", passwordHash: h, name: "Emp Notes", role: "EMPLOYEE" }).returning().get();
  db.insert(users).values({ email: "notes-admin@test.cz", passwordHash: h, name: "Admin Notes", role: "ADMIN" }).run();
  db.insert(users).values({ email: "notes-rec@test.cz", passwordHash: h, name: "Recepce Notes", role: "RECEPTION" }).run();

  clientId = client.id;
  employeeId = emp.id;

  const svc = rawSqlite.prepare("INSERT INTO services (name, duration_min, price, is_active) VALUES ('Masáž', 60, 500, 1)").run();
  serviceId = svc.lastInsertRowid as number;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notes-admin@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notes-client@test.cz", password: "Test1234!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notes-rec@test.cz", password: "Test1234!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Appointment client notes", () => {
  it("client can create appointment with client_note", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        clientId,
        employeeId,
        serviceId,
        startTime: "2026-05-10T10:00:00.000Z",
        endTime: "2026-05-10T11:00:00.000Z",
        clientNote: "Mám alergii na levanduli",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clientNote).toBe("Mám alergii na levanduli");
    appointmentId = body.id;
  });

  it("admin can update client_note via PATCH", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${appointmentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { clientNote: "Aktualizovaná poznámka" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().clientNote).toBe("Aktualizovaná poznámka");
  });

  it("reception can update client_note", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${appointmentId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientNote: "Poznámka od recepce" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().clientNote).toBe("Poznámka od recepce");
  });

  it("client note max 500 chars — rejects over limit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        clientId,
        employeeId,
        serviceId,
        startTime: "2026-05-11T10:00:00.000Z",
        endTime: "2026-05-11T11:00:00.000Z",
        clientNote: "x".repeat(501),
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("appointment without client_note has null or undefined clientNote", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        clientId,
        employeeId,
        serviceId,
        startTime: "2026-05-12T10:00:00.000Z",
        endTime: "2026-05-12T11:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clientNote === null || body.clientNote === undefined).toBe(true);
  });
});
