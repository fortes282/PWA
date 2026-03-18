/**
 * NOC 16/1 — Direct Messages
 * POST /messages, GET /messages, GET /messages/:id, PATCH /messages/:id/read, DELETE /messages/:id
 * GET /messages/unread-count, GET /messages/contacts
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
let empToken: string;
let adminId: number;
let clientId: number;
let empId: number;
let msgId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-messages-noc16-min64chars!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const hash = await hashPassword("Pass123!");

  const admin = db.insert(users).values({ email: "msg-admin@test.cz", passwordHash: hash, name: "Admin MSG", role: "ADMIN" }).returning().get();
  const emp = db.insert(users).values({ email: "msg-emp@test.cz", passwordHash: hash, name: "Terapeut MSG", role: "EMPLOYEE" }).returning().get();
  const client = db.insert(users).values({ email: "msg-client@test.cz", passwordHash: hash, name: "Klient MSG", role: "CLIENT" }).returning().get();

  adminId = admin.id;
  empId = emp.id;
  clientId = client.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "msg-admin@test.cz", password: "Pass123!" } })).json().accessToken;
  empToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "msg-emp@test.cz", password: "Pass123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "msg-client@test.cz", password: "Pass123!" } })).json().accessToken;
});

afterAll(async () => { await app.close(); });

describe("Direct Messages", () => {
  it("test 1: CLIENT sends message to EMPLOYEE — 201 + message in inbox", async () => {
    const res = await app.inject({
      method: "POST", url: "/messages",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { toUserId: empId, subject: "Dotaz na termín", body: "Dobrý den, mohu změnit termín?" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty("id");
    expect(body.subject).toBe("Dotaz na termín");
    expect(body.fromUserId).toBe(clientId);
    expect(body.toUserId).toBe(empId);
    msgId = body.id;

    // Check inbox of employee
    const inbox = await app.inject({
      method: "GET", url: "/messages?folder=inbox",
      headers: { authorization: `Bearer ${empToken}` },
    });
    expect(inbox.statusCode).toBe(200);
    const msgs = inbox.json();
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs.some((m: any) => m.id === msgId)).toBe(true);
  });

  it("test 2: recipient can GET /messages/:id (auto-marks read) + reply", async () => {
    const res = await app.inject({
      method: "GET", url: `/messages/${msgId}`,
      headers: { authorization: `Bearer ${empToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(msgId);
    expect(body.isRead).toBe(true); // auto-read
    expect(body).toHaveProperty("from");
    expect(body.from.id).toBe(clientId);
    expect(Array.isArray(body.replies)).toBe(true);

    // Employee replies
    const reply = await app.inject({
      method: "POST", url: "/messages",
      headers: { authorization: `Bearer ${empToken}` },
      payload: { toUserId: clientId, subject: "Re: Dotaz na termín", body: "Samozřejmě, zavolejte nám.", parentId: msgId },
    });
    expect(reply.statusCode).toBe(201);
    const replyBody = reply.json();
    expect(replyBody.parentId).toBe(msgId);
  });

  it("test 3: GET /messages/unread-count returns correct number", async () => {
    // Client should have 1 unread (the reply from employee)
    const res = await app.inject({
      method: "GET", url: "/messages/unread-count",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("count");
    expect(body.count).toBeGreaterThanOrEqual(1);
  });

  it("test 4: GET /messages/contacts — client sees RECEPTION and EMPLOYEE only", async () => {
    const res = await app.inject({
      method: "GET", url: "/messages/contacts",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const contacts = res.json();
    expect(Array.isArray(contacts)).toBe(true);
    // Should include employee
    expect(contacts.some((c: any) => c.id === empId)).toBe(true);
    // Should NOT include other clients
    const clientRoles = contacts.filter((c: any) => c.role === "CLIENT");
    expect(clientRoles.length).toBe(0);
  });

  it("test 5: DELETE /messages/:id — only sender or ADMIN can delete", async () => {
    // Unauthorized deletion (employee trying to delete client's msg)
    const res403 = await app.inject({
      method: "DELETE", url: `/messages/${msgId}`,
      headers: { authorization: `Bearer ${empToken}` },
    });
    expect(res403.statusCode).toBe(403);

    // Sender (client) can delete
    const res200 = await app.inject({
      method: "DELETE", url: `/messages/${msgId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res200.statusCode).toBe(200);
    expect(res200.json().ok).toBe(true);
  });

  it("test 6: sending to self returns 400", async () => {
    const res = await app.inject({
      method: "POST", url: "/messages",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { toUserId: clientId, subject: "Self test", body: "Toto by nemělo projít." },
    });
    expect(res.statusCode).toBe(400);
  });
});
