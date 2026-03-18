/**
 * NOC 26 — Activity feed, quick summary, notification filtering, version 2.7.0.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite } from "../db/index.js";
import { buildApp } from "../server.js";
import { applyRuntimeMigrations } from "../db/index.js";
import { hashPassword } from "../utils/hash.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), category TEXT);
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, cancellation_reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), recurrence_rule TEXT, recurrence_end_date TEXT, recurrence_parent_id INTEGER);
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
  CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, target_id INTEGER, target_type TEXT, details TEXT, ip TEXT, created_at INTEGER);
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-noc26-suite-min64chars!!!!!!!!!!!!!!!!!!!!!!";
  process.env.LOGIN_RATE_MAX = "100";

  rawSqlite.exec(MIGRATION_SQL);
  applyRuntimeMigrations();

  // Seed users
  const adminHash = hashPassword("Admin123!");
  const clientHash = hashPassword("Klient123!");
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("noc26-admin@test.cz", adminHash, "NOC26 Admin", "ADMIN");
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("noc26-client@test.cz", clientHash, "NOC26 Client", "CLIENT");

  // Seed a service and room for appointments
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO services (id, name, duration_min, price) VALUES (?, ?, ?, ?)"
  ).run(901, "NOC26 Test Service", 60, 500);
  rawSqlite.prepare(
    "INSERT OR IGNORE INTO rooms (id, name) VALUES (?, ?)"
  ).run(901, "NOC26 Test Room");

  app = await buildApp({ logger: false });
  await app.ready();

  const adminRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "noc26-admin@test.cz", password: "Admin123!" },
  });
  adminToken = adminRes.json().accessToken;

  const clientRes = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "noc26-client@test.cz", password: "Klient123!" },
  });
  clientToken = clientRes.json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("NOC 26 — Version 2.7.0", () => {
  it("health endpoint reports v2.7.0", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe("2.7.0");
  });

  it("OpenAPI spec reports v2.7.0", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    expect(res.json().info.version).toBe("2.7.0");
  });
});

describe("NOC 26 — Activity Feed", () => {
  it("GET /stats/activity-feed returns items array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/stats/activity-feed?limit=5",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty("total");
  });

  it("Activity feed is forbidden for CLIENT", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/stats/activity-feed",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("NOC 26 — Quick Summary", () => {
  it("GET /stats/quick-summary returns today data", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/stats/quick-summary",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("today");
    expect(body.today).toHaveProperty("total");
    expect(body.today).toHaveProperty("revenue");
    expect(body).toHaveProperty("upcomingNext2h");
    expect(body).toHaveProperty("totalPendingAll");
  });

  it("Quick summary is forbidden for CLIENT", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/stats/quick-summary",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("NOC 26 — Notifications filtering", () => {
  it("GET /notifications returns notifications with total", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.notifications)).toBe(true);
  });

  it("GET /notifications?unread=true filters unread only", async () => {
    // Create a notification first
    await app.inject({
      method: "POST",
      url: "/notifications",
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        userId: rawSqlite.prepare("SELECT id FROM users WHERE email = ?").get("noc26-admin@test.cz") as any,
        type: "GENERAL",
        title: "Test Unread",
        message: "This is unread",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/notifications?unread=true",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const n of body.notifications) {
      expect(n.isRead).toBe(false);
    }
  });

  it("GET /notifications supports limit and offset", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notifications?limit=2&offset=0",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications.length).toBeLessThanOrEqual(2);
  });
});
