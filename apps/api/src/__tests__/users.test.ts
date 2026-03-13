/**
 * Integration tests for user profile update and notification preferences.
 * Tests the PATCH /users/:id endpoint for:
 *   - name/phone profile update (client self-update)
 *   - emailEnabled / smsEnabled notification prefs (bug fix in UpdateUserSchema)
 *   - RBAC: client cannot update another user
 *   - Admin can update any user
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
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    diagnosis TEXT,
    allergies TEXT,
    medications TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let client2Token: string;
let adminId: number;
let clientId: number;
let client2Id: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-users-test-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-users-test-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const adminHash = await hashPassword("Admin123!");
  const clientHash = await hashPassword("Klient123!");

  const adminResult = db.insert(users).values({
    email: "users-admin@test.cz",
    passwordHash: adminHash,
    name: "Admin Test",
    role: "ADMIN",
  }).returning().get();
  adminId = adminResult.id;

  const clientResult = db.insert(users).values({
    email: "users-client@test.cz",
    passwordHash: clientHash,
    name: "Klient Test",
    role: "CLIENT",
  }).returning().get();
  clientId = clientResult.id;

  const client2Result = db.insert(users).values({
    email: "users-client2@test.cz",
    passwordHash: clientHash,
    name: "Klient Druhý",
    role: "CLIENT",
  }).returning().get();
  client2Id = client2Result.id;

  const adminLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "users-admin@test.cz", password: "Admin123!" },
  });
  adminToken = adminLogin.json().accessToken;

  const clientLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "users-client@test.cz", password: "Klient123!" },
  });
  clientToken = clientLogin.json().accessToken;

  const client2Login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "users-client2@test.cz", password: "Klient123!" },
  });
  client2Token = client2Login.json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("User profile self-update", () => {
  it("client can update own name", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: "Nové Jméno" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Nové Jméno");
  });

  it("client can update own phone", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { phone: "+420 123 456 789" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().phone).toBe("+420 123 456 789");
  });

  it("client can update email notification preference", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { emailEnabled: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().emailEnabled).toBe(false);
  });

  it("client can update sms notification preference", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { smsEnabled: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().smsEnabled).toBe(true);
  });

  it("profile changes are persisted in GET /users/:id", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.name).toBe("Nové Jméno");
    expect(data.phone).toBe("+420 123 456 789");
    expect(data.emailEnabled).toBe(false);
    expect(data.smsEnabled).toBe(true);
  });
});

describe("User profile RBAC", () => {
  it("client cannot update another client", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${client2Id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: "Hacknuté jméno" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can update any user", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${client2Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Admin-upravené jméno" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Admin-upravené jméno");
  });

  it("unauthenticated request is rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/users/${clientId}`,
      payload: { name: "No token" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("User list RBAC", () => {
  it("admin can list all users", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().length).toBeGreaterThanOrEqual(3);
  });

  it("client cannot list users", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client can view own profile", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(clientId);
  });

  it("client cannot view another client's profile", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/users/${client2Id}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
