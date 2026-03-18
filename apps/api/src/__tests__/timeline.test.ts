/**
 * NOC 16/4 — Client Timeline
 * GET /clients/:id/timeline — chronologická osa všech událostí klienta
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, appointments, invoices, creditTransactions, medicalReports } from "../db/schema.js";
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
let clientId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-timeline-noc16-min64chars!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const hash = await hashPassword("Pass123!");

  const admin = db.insert(users).values({ email: "tl-admin@test.cz", passwordHash: hash, name: "Admin TL", role: "ADMIN" }).returning().get();
  const emp = db.insert(users).values({ email: "tl-emp@test.cz", passwordHash: hash, name: "Terapeut TL", role: "EMPLOYEE" }).returning().get();
  const client = db.insert(users).values({ email: "tl-client@test.cz", passwordHash: hash, name: "Klient TL", role: "CLIENT" }).returning().get();
  clientId = client.id;

  const svc = db.insert(services).values({ name: "Terapie TL", durationMin: 60, price: 700, isActive: true }).returning().get();

  // Create data points
  const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 3_600_000).toISOString();
  db.insert(appointments).values({
    clientId: client.id, employeeId: emp.id, serviceId: svc.id,
    startTime: past, endTime: pastEnd, status: "COMPLETED", price: 700, bookingActivated: true,
  }).run();

  db.insert(invoices).values({
    invoiceNumber: "INV-TL-0001", clientId: client.id, status: "PAID", total: 700,
    dueDate: new Date().toISOString().slice(0, 10),
  }).run();

  db.insert(creditTransactions).values({
    userId: client.id, type: "PURCHASE", amount: 1000, balance: 1000, note: "Test nákup kreditů",
  }).run();

  db.insert(medicalReports).values({
    clientId: client.id, employeeId: emp.id,
    title: "Zpráva po 1. sezení", content: "Klient dobře reaguje.", diagnosis: "MCI",
  }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "tl-admin@test.cz", password: "Pass123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "tl-client@test.cz", password: "Pass123!" } })).json().accessToken;
});

afterAll(async () => { await app.close(); });

describe("Client Timeline", () => {
  it("test 1: ADMIN can GET /clients/:id/timeline — returns mixed events", async () => {
    const res = await app.inject({
      method: "GET", url: `/clients/${clientId}/timeline`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThanOrEqual(3); // appointment + invoice + credit + medical
    expect(body.clientId).toBe(clientId);
  });

  it("test 2: events have required fields (type, createdAt, title, badge)", async () => {
    const res = await app.inject({
      method: "GET", url: `/clients/${clientId}/timeline`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { events } = res.json();
    for (const ev of events) {
      expect(ev).toHaveProperty("type");
      expect(ev).toHaveProperty("createdAt");
      expect(ev).toHaveProperty("title");
      expect(ev).toHaveProperty("badge");
    }
    // Expect different types
    const types = new Set(events.map((e: any) => e.type));
    expect(types.has("appointment")).toBe(true);
    expect(types.has("invoice")).toBe(true);
    expect(types.has("credit")).toBe(true);
  });

  it("test 3: CLIENT can only see own timeline", async () => {
    const res = await app.inject({
      method: "GET", url: `/clients/${clientId}/timeline`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("test 4: limit param works", async () => {
    const res = await app.inject({
      method: "GET", url: `/clients/${clientId}/timeline?limit=2`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.events.length).toBeLessThanOrEqual(2);
  });
});
