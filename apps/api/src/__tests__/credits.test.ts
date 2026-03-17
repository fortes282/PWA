/**
 * Integration tests — /credits
 * Tests: balance, transactions, adjust (admin), RBAC
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, creditTransactions } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, cancellation_reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
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
  process.env.JWT_SECRET = "test-secret-for-credits-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const admHash = await hashPassword("Admin123!");
  const cliHash = await hashPassword("Klient123!");

  const cliRes = db.insert(users).values({ email: "cred-client@test.cz", passwordHash: cliHash, name: "Klient Cred", role: "CLIENT" }).returning().get();
  clientId = cliRes.id;
  db.insert(users).values({ email: "cred-admin@test.cz", passwordHash: admHash, name: "Admin Cred", role: "ADMIN" }).returning().get();

  // Seed initial credit
  db.insert(creditTransactions).values({ userId: clientId, type: "PURCHASE", amount: 3000, balance: 3000, note: "Počáteční kredit" }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "cred-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "cred-client@test.cz", password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Credits — balance", () => {
  it("client can get own balance", async () => {
    const res = await app.inject({
      method: "GET", url: "/credits/balance",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().balance).toBe(3000);
  });

  it("admin can get any user balance by userId", async () => {
    const res = await app.inject({
      method: "GET", url: `/credits/balance/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().balance).toBe(3000);
  });

  it("client cannot get other user's balance (403)", async () => {
    const res = await app.inject({
      method: "GET", url: `/credits/balance/999`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Credits — transactions", () => {
  it("client can list own transactions", async () => {
    const res = await app.inject({
      method: "GET", url: "/credits/transactions",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((t: any) => t.type === "PURCHASE")).toBe(true);
  });

  it("admin can adjust credits (add)", async () => {
    const res = await app.inject({
      method: "POST", url: "/credits/adjust",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, amount: 500, type: "ADJUSTMENT", note: "Kompenzace" },
    });
    expect(res.statusCode).toBe(201);
    // Balance should now be 3500
    const balRes = await app.inject({
      method: "GET", url: `/credits/balance/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(balRes.json().balance).toBe(3500);
  });

  it("admin can adjust credits (subtract)", async () => {
    const res = await app.inject({
      method: "POST", url: "/credits/adjust",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, amount: -200, type: "ADJUSTMENT", note: "Oprava" },
    });
    expect(res.statusCode).toBe(201);
    const balRes = await app.inject({
      method: "GET", url: `/credits/balance/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(balRes.json().balance).toBe(3300);
  });

  it("client cannot adjust credits (403)", async () => {
    const res = await app.inject({
      method: "POST", url: "/credits/adjust",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userId: clientId, amount: 9999, note: "Hack" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Credits — history pagination", () => {
  it("GET /credits/history returns paginated structure", async () => {
    const res = await app.inject({
      method: "GET", url: "/credits/history",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("pagination");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toHaveProperty("pages");
    expect(body.pagination).toHaveProperty("hasMore");
  });

  it("GET /credits/history?page=1&limit=2 respects limit", async () => {
    // Seed a few more transactions first so paging makes sense
    db.insert(creditTransactions).values({ userId: clientId, type: "PURCHASE", amount: 100, balance: 3400, note: "Extra 1" }).run();
    db.insert(creditTransactions).values({ userId: clientId, type: "PURCHASE", amount: 100, balance: 3500, note: "Extra 2" }).run();

    const res = await app.inject({
      method: "GET", url: "/credits/history?page=1&limit=2",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.page).toBe(1);
  });

  it("GET /credits/history page 2 returns different items than page 1", async () => {
    const p1 = await app.inject({
      method: "GET", url: "/credits/history?page=1&limit=2",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const p2 = await app.inject({
      method: "GET", url: "/credits/history?page=2&limit=2",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(p1.statusCode).toBe(200);
    expect(p2.statusCode).toBe(200);
    const ids1 = p1.json().items.map((t: any) => t.id);
    const ids2 = p2.json().items.map((t: any) => t.id);
    // Pages should be different (no overlap)
    const overlap = ids1.filter((id: number) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });
});

describe("GET /credits/summary/:userId", () => {
  it("admin can get credit summary for client", async () => {
    const res = await app.inject({
      method: "GET", url: `/credits/summary/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe(clientId);
    expect(typeof body.balance).toBe("number");
    expect(typeof body.totalPurchased).toBe("number");
    expect(typeof body.totalUsed).toBe("number");
    expect(Array.isArray(body.recentTransactions)).toBe(true);
    expect(body.recentTransactions.length).toBeLessThanOrEqual(10);
  });

  it("client cannot get credit summary (403)", async () => {
    const res = await app.inject({
      method: "GET", url: `/credits/summary/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /credits/stats", () => {
  it("client can get their credit stats", async () => {
    const res = await app.inject({
      method: "GET", url: "/credits/stats",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.balance).toBe("number");
    expect(typeof body.totalIn).toBe("number");
    expect(typeof body.totalOut).toBe("number");
    expect(typeof body.transactionCount).toBe("number");
  });

  it("balance = totalIn - totalOut approximately", async () => {
    const res = await app.inject({
      method: "GET", url: "/credits/stats",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const body = res.json();
    // balance should roughly equal totalIn - totalOut
    expect(Math.abs(body.balance - (body.totalIn - body.totalOut))).toBeLessThanOrEqual(0.01);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/credits/stats" });
    expect(res.statusCode).toBe(401);
  });
});
