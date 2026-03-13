/**
 * Integration tests for notifications routes:
 * - Create notification
 * - List notifications (role-filtered)
 * - Read single / read-all
 * - Bulk send (RECEPTION/ADMIN)
 * - Delete
 * - RBAC (client can't create/bulk-send)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CLIENT',
    phone TEXT,
    avatar_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    behavior_score REAL NOT NULL DEFAULT 100,
    email_enabled INTEGER NOT NULL DEFAULT 1,
    sms_enabled INTEGER NOT NULL DEFAULT 0,
    push_enabled INTEGER NOT NULL DEFAULT 0,
    push_subscription TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    duration_min INTEGER NOT NULL DEFAULT 60,
    price REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    room_id INTEGER REFERENCES rooms(id),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    price REAL,
    booking_activated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id),
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id),
    employee_id INTEGER REFERENCES users(id),
    preferred_dates TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING',
    notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    total REAL NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL,
    paid_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS medical_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    appointment_id INTEGER REFERENCES appointments(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    diagnosis TEXT,
    recommendations TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    points REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS profile_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_by INTEGER NOT NULL REFERENCES users(id),
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fio_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fio_id TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    variable_symbol TEXT,
    note TEXT,
    counter_account TEXT,
    counter_name TEXT,
    transaction_date TEXT NOT NULL,
    matched_invoice_id INTEGER REFERENCES invoices(id),
    matched_client_id INTEGER REFERENCES users(id),
    is_matched INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    diagnosis TEXT,
    allergies TEXT,
    medications TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let client2Token: string;
let receptionToken: string;
let clientId: number;
let client2Id: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-notif-test-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-notif-test-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const adminH = await hashPassword("Admin123!");
  const clientH = await hashPassword("Klient123!");
  const recH = await hashPassword("Recepce1!");

  db.insert(users).values({ email: "notif-admin@test.cz", passwordHash: adminH, name: "Admin", role: "ADMIN" }).run();
  const c1 = db.insert(users).values({ email: "notif-client@test.cz", passwordHash: clientH, name: "Klient Jedna", role: "CLIENT" }).returning().get();
  clientId = c1.id;
  const c2 = db.insert(users).values({ email: "notif-client2@test.cz", passwordHash: clientH, name: "Klient Dva", role: "CLIENT" }).returning().get();
  client2Id = c2.id;
  db.insert(users).values({ email: "notif-rec@test.cz", passwordHash: recH, name: "Recepce", role: "RECEPTION" }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notif-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notif-client@test.cz", password: "Klient123!" } })).json().accessToken;
  client2Token = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notif-client2@test.cz", password: "Klient123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "notif-rec@test.cz", password: "Recepce1!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Notifications CRUD", () => {
  let notifId: number;

  it("admin can create notification for client", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, type: "GENERAL", title: "Test zpráva", message: "Toto je testovací notifikace." },
    });
    expect(res.statusCode).toBe(201);
    notifId = res.json().id;
    expect(notifId).toBeTruthy();
  });

  it("client sees their own notification", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const notifs = res.json();
    expect(notifs.some((n: any) => n.id === notifId)).toBe(true);
    expect(notifs.find((n: any) => n.id === notifId).isRead).toBe(false);
  });

  it("client cannot see another client's notifications", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${client2Token}` },
    });
    expect(res.statusCode).toBe(200);
    // client2 should not see client's notification
    expect(res.json().some((n: any) => n.id === notifId)).toBe(false);
  });

  it("client can mark single notification as read", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/notifications/${notifId}/read`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);

    // Verify it's now read
    const list = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const found = list.json().find((n: any) => n.id === notifId);
    expect(found?.isRead).toBe(true);
  });

  it("client can delete their notification", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/notifications/${notifId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client cannot create notifications", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userId: clientId, type: "GENERAL", title: "Hack", message: "Neautorizováno" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Bulk notifications", () => {
  it("reception can bulk-send to multiple clients", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications/bulk",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: {
        userIds: [clientId, client2Id],
        type: "GENERAL",
        title: "Hromadná zpráva",
        message: "Toto je hromadná zpráva pro všechny klienty.",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().sent).toBe(2);
  });

  it("clients receive the bulk notification", async () => {
    const r1 = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const r2 = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${client2Token}` },
    });
    expect(r1.json().some((n: any) => n.title === "Hromadná zpráva")).toBe(true);
    expect(r2.json().some((n: any) => n.title === "Hromadná zpráva")).toBe(true);
  });

  it("reception can mark all as read for themselves", async () => {
    // Create a notification for reception user first
    const recUser = await app.inject({
      method: "GET",
      url: "/users",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const recId = recUser.json().find((u: any) => u.role === "RECEPTION")?.id;
    if (recId) {
      await app.inject({
        method: "POST",
        url: "/notifications",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { userId: recId, type: "GENERAL", title: "Pro recepci", message: "Test" },
      });
    }

    const res = await app.inject({
      method: "POST",
      url: "/notifications/read-all",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client cannot bulk-send notifications", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications/bulk",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userIds: [clientId], type: "GENERAL", title: "Hack", message: "Neautorizováno" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("bulk-send rejects empty userIds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications/bulk",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userIds: [], type: "GENERAL", title: "Empty", message: "Test" },
    });
    expect(res.statusCode).toBe(400);
  });
});
