/**
 * Integration tests — /invoices
 * Tests: create, list, get by id, status change, RBAC
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
let invoiceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-invoices-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const admHash = await hashPassword("Admin123!");
  const recHash = await hashPassword("Recepce1!");
  const cliHash = await hashPassword("Klient123!");

  const cliRes = db.insert(users).values({ email: "inv-client@test.cz", passwordHash: cliHash, name: "Klient Invoice", role: "CLIENT" }).returning().get();
  clientId = cliRes.id;
  db.insert(users).values({ email: "inv-admin@test.cz", passwordHash: admHash, name: "Admin Invoice", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: "inv-rec@test.cz", passwordHash: recHash, name: "Recepce Invoice", role: "RECEPTION" }).returning().get();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "inv-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "inv-rec@test.cz", password: "Recepce1!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "inv-client@test.cz", password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Invoices — RBAC", () => {
  it("admin can list invoices", async () => {
    const res = await app.inject({
      method: "GET", url: "/invoices",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("client can list own invoices", async () => {
    const res = await app.inject({
      method: "GET", url: "/invoices",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("client cannot create invoice (403)", async () => {
    const res = await app.inject({
      method: "POST", url: "/invoices",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        clientId,
        dueDate: "2026-04-01",
        items: [{ description: "Test", quantity: 1, unitPrice: 100 }],
      },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Invoices — CRUD", () => {
  it("reception can create invoice with items", async () => {
    const res = await app.inject({
      method: "POST", url: "/invoices",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: {
        clientId,
        dueDate: "2026-04-30",
        notes: "Test faktura",
        items: [
          { description: "Masáž 60min", quantity: 1, unitPrice: 1200 },
          { description: "Konzultace", quantity: 2, unitPrice: 300 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.total).toBe(1800); // 1200 + 2*300
    expect(body.status).toBe("DRAFT");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.invoiceNumber).toBeTruthy();
    invoiceId = body.id;
  });

  it("admin can get invoice by id with items", async () => {
    const res = await app.inject({
      method: "GET", url: `/invoices/${invoiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(invoiceId);
    expect(body.total).toBe(1800);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("client can get own invoice", async () => {
    const res = await app.inject({
      method: "GET", url: `/invoices/${invoiceId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(invoiceId);
  });

  it("admin can change invoice status to SENT", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/invoices/${invoiceId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "SENT" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("SENT");
  });

  it("admin can mark invoice as PAID (sets paidAt)", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/invoices/${invoiceId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "PAID" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("PAID");
    expect(body.paidAt).toBeTruthy();
  });

  it("admin can update invoice notes", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/invoices/${invoiceId}/notes`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { notes: "Zaplaceno převodem" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().notes).toBe("Zaplaceno převodem");
  });
});
