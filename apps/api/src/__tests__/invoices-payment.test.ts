/**
 * NOC 14 — Invoice payment tracking tests
 * PATCH /invoices/:id/payment
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, invoices } from "../db/schema.js";
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
`;

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let clientToken: string;
let paidInvoiceId: number;
let draftInvoiceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-inv-payment-suite-min64chars!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  const client = db.insert(users).values({ email: "invpay-client@test.cz", passwordHash: h, name: "Klient InvPay", role: "CLIENT" }).returning().get();
  db.insert(users).values({ email: "invpay-admin@test.cz", passwordHash: h, name: "Admin InvPay", role: "ADMIN" }).run();
  db.insert(users).values({ email: "invpay-rec@test.cz", passwordHash: h, name: "Recepce InvPay", role: "RECEPTION" }).run();

  // Create a PAID invoice
  const paid = db.insert(invoices).values({
    invoiceNumber: "INV-2026-IPAY1",
    clientId: client.id,
    status: "PAID",
    total: 1500,
    dueDate: "2026-03-31",
    paidAt: new Date().toISOString(),
  }).returning().get();
  paidInvoiceId = paid.id;

  // Create a DRAFT invoice
  const draft = db.insert(invoices).values({
    invoiceNumber: "INV-2026-IPAY2",
    clientId: client.id,
    status: "DRAFT",
    total: 500,
    dueDate: "2026-04-30",
  }).returning().get();
  draftInvoiceId = draft.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "invpay-admin@test.cz", password: "Test1234!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "invpay-rec@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "invpay-client@test.cz", password: "Test1234!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("PATCH /invoices/:id/payment", () => {
  it("admin can set payment method on PAID invoice", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/invoices/${paidInvoiceId}/payment`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { payment_method: "card", paid_at: "2026-03-15T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.paymentMethod).toBe("card");
  });

  it("reception can set payment method on PAID invoice", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/invoices/${paidInvoiceId}/payment`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { payment_method: "cash" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().paymentMethod).toBe("cash");
  });

  it("returns 400 if invoice is not PAID", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/invoices/${draftInvoiceId}/payment`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { payment_method: "transfer" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid payment_method", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/invoices/${paidInvoiceId}/payment`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { payment_method: "bitcoin" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("client cannot set payment method (403)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/invoices/${paidInvoiceId}/payment`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { payment_method: "cash" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent invoice", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/invoices/99999/payment",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { payment_method: "cash" },
    });
    expect(res.statusCode).toBe(404);
  });
});
