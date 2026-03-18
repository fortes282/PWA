/**
 * NOC 16/2 — Appointment Ratings
 * POST /appointments/:id/rating, GET /appointments/:id/rating
 * GET /employees/:id/ratings, GET /ratings/summary
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
let clientToken: string;
let empId: number;
let clientId: number;
let completedApptId: number;
let pendingApptId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-ratings-noc16-min64chars!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const hash = await hashPassword("Pass123!");

  const admin = db.insert(users).values({ email: "rat-admin@test.cz", passwordHash: hash, name: "Admin RAT", role: "ADMIN" }).returning().get();
  const emp = db.insert(users).values({ email: "rat-emp@test.cz", passwordHash: hash, name: "Terapeut RAT", role: "EMPLOYEE" }).returning().get();
  const client = db.insert(users).values({ email: "rat-client@test.cz", passwordHash: hash, name: "Klient RAT", role: "CLIENT" }).returning().get();

  empId = emp.id;
  clientId = client.id;

  const svc = db.insert(services).values({ name: "Terapie RAT", durationMin: 60, price: 700, isActive: true }).returning().get();

  const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3_600_000).toISOString();
  const completed = db.insert(appointments).values({
    clientId: client.id, employeeId: emp.id, serviceId: svc.id,
    startTime: past, endTime: pastEnd,
    status: "COMPLETED", price: 700, bookingActivated: true,
  }).returning().get();
  completedApptId = completed.id;

  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3_600_000).toISOString();
  const pending = db.insert(appointments).values({
    clientId: client.id, employeeId: emp.id, serviceId: svc.id,
    startTime: future, endTime: futureEnd,
    status: "PENDING", price: 700, bookingActivated: false,
  }).returning().get();
  pendingApptId = pending.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "rat-admin@test.cz", password: "Pass123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "rat-client@test.cz", password: "Pass123!" } })).json().accessToken;
});

afterAll(async () => { await app.close(); });

describe("Appointment Ratings", () => {
  it("test 1: CLIENT can rate a COMPLETED appointment 1–5", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${completedApptId}/rating`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 5, comment: "Výborný terapeut, doporučuji!" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.rating).toBe(5);
    expect(body.appointmentId).toBe(completedApptId);
    expect(body.comment).toBe("Výborný terapeut, doporučuji!");
  });

  it("test 2: cannot rate same appointment twice — 409", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${completedApptId}/rating`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 3 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("test 3: cannot rate a PENDING appointment — 400", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${pendingApptId}/rating`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 4 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("test 4: GET /employees/:id/ratings returns avg rating", async () => {
    const res = await app.inject({
      method: "GET", url: `/employees/${empId}/ratings`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.employeeId).toBe(empId);
    expect(body.averageRating).toBe(5);
    expect(body.totalRatings).toBe(1);
  });

  it("test 5: GET /ratings/summary returns leaderboard (ADMIN)", async () => {
    const res = await app.inject({
      method: "GET", url: "/ratings/summary",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("avg_rating");
      expect(body[0]).toHaveProperty("employee_name");
    }
  });

  it("test 6: invalid rating value returns 400", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${completedApptId}/rating`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 7 },
    });
    expect(res.statusCode).toBe(400);
  });
});
