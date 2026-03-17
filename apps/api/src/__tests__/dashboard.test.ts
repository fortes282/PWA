/**
 * Integration tests — /dashboard/reception and /dashboard/client
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
  CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL UNIQUE, created_by INTEGER NOT NULL, diagnosis TEXT, allergies TEXT, medications TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, amount REAL NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'PENDING', reviewed_by INTEGER, review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let receptionToken: string;
let clientToken: string;
let adminToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-dashboard-suite-min64chars!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-dashboard-suite-min64chars!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  db.insert(users).values({ email: "dash-rec@test.cz", passwordHash: h, name: "Recepce Dash", role: "RECEPTION" }).run();
  db.insert(users).values({ email: "dash-client@test.cz", passwordHash: h, name: "Klient Dash", role: "CLIENT" }).run();
  db.insert(users).values({ email: "dash-admin@test.cz", passwordHash: h, name: "Admin Dash", role: "ADMIN" }).run();

  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "dash-rec@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "dash-client@test.cz", password: "Test1234!" } })).json().accessToken;
  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "dash-admin@test.cz", password: "Test1234!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /dashboard/reception", () => {
  it("reception can access dashboard", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/reception",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("today");
    expect(body).toHaveProperty("counts");
    expect(body).toHaveProperty("todayRevenue");
    expect(body).toHaveProperty("upcomingToday");
  });

  it("counts object has required fields", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/reception",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const counts = res.json().counts;
    expect(typeof counts.todayTotal).toBe("number");
    expect(typeof counts.pendingActivation).toBe("number");
    expect(typeof counts.pendingCreditRequests).toBe("number");
    expect(typeof counts.waitingWaitlist).toBe("number");
    expect(typeof counts.activeClients).toBe("number");
    expect(typeof counts.unreadNotifications).toBe("number");
  });

  it("client cannot access reception dashboard (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/reception",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("today field is in YYYY-MM-DD format", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/reception",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.json().today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("GET /dashboard/client", () => {
  it("client can access own dashboard", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/client",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("balance");
    expect(body).toHaveProperty("nextAppointment");
    expect(body).toHaveProperty("stats");
  });

  it("stats object has required fields", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/client",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const stats = res.json().stats;
    expect(typeof stats.completedAppointments).toBe("number");
    expect(typeof stats.cancelledAppointments).toBe("number");
    expect(typeof stats.unreadNotifications).toBe("number");
    expect(typeof stats.pendingCreditRequests).toBe("number");
  });

  it("reception can also access client dashboard (role-based)", async () => {
    // reception calling /dashboard/client returns their own data
    const res = await app.inject({
      method: "GET", url: "/dashboard/client",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    // Any authenticated user should get 200 (it reads their own data)
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /dashboard/employee", () => {
  it("admin can access employee dashboard", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/employee",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof body.todayApptCount).toBe("number");
    expect(body.stats).toBeDefined();
    expect(typeof body.stats.completedAllTime).toBe("number");
    expect(typeof body.stats.unreadNotifications).toBe("number");
  });

  it("client cannot access employee dashboard (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/dashboard/employee",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/employee" });
    expect(res.statusCode).toBe(401);
  });
});
