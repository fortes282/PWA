/**
 * NOC 15/2 — Waitlist Auto-Fill
 * Tests that cancelling an appointment automatically notifies waiting clients.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, appointments, waitlist, notifications } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "mock-id" }),
    })),
  },
}));

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
let clientId: number;
let waitingClientId: number;
let employeeId: number;
let serviceId: number;
let appointmentId: number;
let waitlistEntryId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-waitlist-autofill-noc15-min64chars!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const hash = await hashPassword("Pass123!");

  const admin = db.insert(users).values({ email: "wl-admin@test.cz", passwordHash: hash, name: "Admin WL", role: "ADMIN" }).returning().get();
  const emp = db.insert(users).values({ email: "wl-emp@test.cz", passwordHash: hash, name: "Emp WL", role: "EMPLOYEE" }).returning().get();
  const client = db.insert(users).values({ email: "wl-client@test.cz", passwordHash: hash, name: "Klient WL", role: "CLIENT" }).returning().get();
  const waiting = db.insert(users).values({ email: "wl-waiting@test.cz", passwordHash: hash, name: "Čekající WL", role: "CLIENT", emailEnabled: true }).returning().get();

  employeeId = emp.id;
  clientId = client.id;
  waitingClientId = waiting.id;

  const svc = db.insert(services).values({ name: "Masáž WL", durationMin: 60, price: 800, isActive: true }).returning().get();
  serviceId = svc.id;

  // Appointment for clientId (will be cancelled)
  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3_600_000).toISOString();
  const appt = db.insert(appointments).values({
    clientId, employeeId, serviceId,
    startTime: future, endTime: futureEnd,
    status: "CONFIRMED", price: 800, bookingActivated: true,
  }).returning().get();
  appointmentId = appt.id;

  // Waitlist entry for waitingClientId
  const wlEntry = db.insert(waitlist).values({
    clientId: waitingClientId, serviceId, status: "WAITING",
  }).returning().get();
  waitlistEntryId = wlEntry.id;

  adminToken = (await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: "wl-admin@test.cz", password: "Pass123!" },
  })).json().accessToken;
});

afterAll(async () => { await app.close(); });

describe("Waitlist Auto-Fill", () => {
  it("test 1: cancelling appointment creates WAITLIST_AVAILABLE notification for waiting client", async () => {
    const notifsBefore = rawSqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND type = 'WAITLIST_AVAILABLE'")
      .get(waitingClientId) as { cnt: number };

    const res = await app.inject({
      method: "PATCH", url: `/appointments/${appointmentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "CANCELLED", cancellationReason: "Test cancellation" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("CANCELLED");

    const notifsAfter = rawSqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND type = 'WAITLIST_AVAILABLE'")
      .get(waitingClientId) as { cnt: number };
    expect(notifsAfter.cnt).toBeGreaterThan(notifsBefore.cnt);
  });

  it("test 2: waitlist entry is updated to NOTIFIED after cancellation", async () => {
    const entry = rawSqlite
      .prepare("SELECT status FROM waitlist WHERE id = ?")
      .get(waitlistEntryId) as { status: string };
    expect(entry.status).toBe("NOTIFIED");
  });

  it("test 3: no duplicate notifications when appointment already cancelled", async () => {
    // Create another appointment and cancel it
    const future2 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const futureEnd2 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3_600_000).toISOString();
    const appt2 = db.insert(appointments).values({
      clientId, employeeId, serviceId,
      startTime: future2, endTime: futureEnd2,
      status: "CONFIRMED", price: 800, bookingActivated: true,
    }).returning().get();

    // No WAITING entries remain (they're all NOTIFIED), so no new WAITLIST_AVAILABLE
    const notifsBefore = rawSqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND type = 'WAITLIST_AVAILABLE'")
      .get(waitingClientId) as { cnt: number };

    const res = await app.inject({
      method: "PATCH", url: `/appointments/${appt2.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "CANCELLED" },
    });
    expect(res.statusCode).toBe(200);

    const notifsAfter = rawSqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND type = 'WAITLIST_AVAILABLE'")
      .get(waitingClientId) as { cnt: number };
    // No new notification since entry is already NOTIFIED
    expect(notifsAfter.cnt).toBe(notifsBefore.cnt);
  });
});
