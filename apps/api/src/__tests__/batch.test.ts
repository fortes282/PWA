/**
 * Integration tests — /batch/appointments/status and /batch/notifications
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, appointments, services, rooms } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, cancellation_reason TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, appointment_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, service_id INTEGER NOT NULL, employee_id INTEGER, preferred_dates TEXT, status TEXT NOT NULL DEFAULT 'WAITING', notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, metadata TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', total REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, paid_at TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, total REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS medical_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, appointment_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, diagnosis TEXT, recommendations TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS behavior_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, points REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS profile_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, changed_by INTEGER NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS fio_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, fio_id TEXT NOT NULL UNIQUE, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CZK', variable_symbol TEXT, note TEXT, counter_account TEXT, counter_name TEXT, transaction_date TEXT NOT NULL, matched_invoice_id INTEGER, matched_client_id INTEGER, is_matched INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL UNIQUE, created_by INTEGER NOT NULL, diagnosis TEXT, allergies TEXT, medications TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, amount REAL NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'PENDING', reviewed_by INTEGER, review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let receptionToken: string;
let clientId: number;
let employeeId: number;
let serviceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-batch-suite-min64chars!!!!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-batch-suite-min64chars!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  db.insert(users).values({ email: "batch-admin@test.cz", passwordHash: h, name: "Admin Batch", role: "ADMIN" }).run();
  db.insert(users).values({ email: "batch-rec@test.cz", passwordHash: h, name: "Recepce Batch", role: "RECEPTION" }).run();
  const c = db.insert(users).values({ email: "batch-client@test.cz", passwordHash: h, name: "Klient Batch", role: "CLIENT" }).returning().get();
  clientId = c.id;
  const emp = db.insert(users).values({ email: "batch-emp@test.cz", passwordHash: h, name: "Terapeut Batch", role: "EMPLOYEE" }).returning().get();
  employeeId = emp.id;

  const svc = db.insert(services).values({ name: "Batch Service", durationMin: 60, price: 1000 }).returning().get();
  serviceId = svc.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "batch-admin@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "batch-client@test.cz", password: "Test1234!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "batch-rec@test.cz", password: "Test1234!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("POST /batch/appointments/status", () => {
  let appt1Id: number;
  let appt2Id: number;

  it("creates two test appointments", async () => {
    const base = new Date(Date.now() + 7 * 86400000);
    const st1 = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0, 0).toISOString();
    const et1 = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0).toISOString();
    const st2 = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 0, 0).toISOString();
    const et2 = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0).toISOString();

    const r1 = await app.inject({
      method: "POST", url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime: st1, endTime: et1 },
    });
    const r2 = await app.inject({
      method: "POST", url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime: st2, endTime: et2 },
    });
    appt1Id = r1.json().id;
    appt2Id = r2.json().id;
    expect(appt1Id).toBeTruthy();
    expect(appt2Id).toBeTruthy();
  });

  it("admin can batch-confirm multiple appointments", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/appointments/status",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [appt1Id, appt2Id], status: "CONFIRMED" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(2);
  });

  it("client cannot batch-update appointments (403)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/appointments/status",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { ids: [appt1Id], status: "CANCELLED" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects empty ids array (400)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/appointments/status",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [], status: "CONFIRMED" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid status (400)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/appointments/status",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [appt1Id], status: "INVALID_STATUS" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /batch/notifications", () => {
  it("admin can send batch notification by userIds", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/notifications",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        userIds: [clientId],
        type: "GENERAL",
        title: "Batch test",
        message: "Hromadná zpráva přes batch API",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toBe(1);
  });

  it("requires type, title and message (400)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/notifications",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userIds: [clientId], type: "GENERAL" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("requires userIds or roles (400)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/notifications",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { type: "GENERAL", title: "X", message: "Y" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("client cannot send batch notifications (403)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userIds: [clientId], type: "GENERAL", title: "Hack", message: "Nope" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /batch/users/active", () => {
  it("admin can bulk deactivate users", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/users/active",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [clientId], isActive: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.updated).toBe(1);
    expect(body.isActive).toBe(false);
  });

  it("admin can bulk reactivate users", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/users/active",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [clientId], isActive: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().updated).toBe(1);
    expect(res.json().isActive).toBe(true);
  });

  it("returns 400 for empty ids array", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/users/active",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [], isActive: false },
    });
    expect(res.statusCode).toBe(400);
  });

  it("reception cannot bulk activate users (403)", async () => {
    const res = await app.inject({
      method: "POST", url: "/batch/users/active",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { ids: [clientId], isActive: false },
    });
    expect(res.statusCode).toBe(403);
  });
});
