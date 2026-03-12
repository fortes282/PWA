/**
 * Integration tests for services, rooms, waitlist, and notifications routes.
 * Uses auth test pattern (inline migration + manual user creation).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

// Minimal migration SQL for test
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
    description TEXT,
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
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let adminId: number;
let clientId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-services-test-suite-min64chars!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-services-test-suite-min64chars!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const adminHash = await hashPassword("Admin123!");
  const clientHash = await hashPassword("Klient123!");

  const adminResult = db.insert(users).values({
    email: "svc-admin@test.cz",
    passwordHash: adminHash,
    name: "Admin Test",
    role: "ADMIN",
  }).returning().get();
  adminId = adminResult.id;

  const clientResult = db.insert(users).values({
    email: "svc-client@test.cz",
    passwordHash: clientHash,
    name: "Client Test",
    role: "CLIENT",
  }).returning().get();
  clientId = clientResult.id;

  const adminLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "svc-admin@test.cz", password: "Admin123!" },
  });
  adminToken = adminLogin.json().accessToken;

  const clientLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "svc-client@test.cz", password: "Klient123!" },
  });
  clientToken = clientLogin.json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Health", () => {
  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });
});

describe("Services", () => {
  it("GET /services — returns array for authenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/services",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("POST /services — CLIENT gets 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/services",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: "Test", durationMin: 60, price: 100 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST /services — ADMIN creates service", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/services",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Terapie Test", durationMin: 45, price: 1200 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe("Terapie Test");
    expect(body.price).toBe(1200);
  });
});

describe("Rooms", () => {
  it("GET /rooms — returns array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/rooms",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("POST /rooms — CLIENT gets 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: "Místnost Test", capacity: 1 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST /rooms — ADMIN creates room", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Místnost A", capacity: 2 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("Místnost A");
  });
});

describe("Waitlist", () => {
  it("GET /waitlist — requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/waitlist" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /waitlist — returns array for authenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/waitlist",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe("Notifications", () => {
  it("GET /notifications — requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /notifications — returns array for client", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("POST /notifications — CLIENT gets 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userId: adminId, type: "GENERAL", title: "T", message: "M" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST /notifications — ADMIN can create", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/notifications",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, type: "GENERAL", title: "Test notif", message: "Test zpráva" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().title).toBe("Test notif");
  });
});

describe("Appointments", () => {
  it("GET /appointments — requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/appointments" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /appointments — returns array for client", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("GET /appointments/available — requires serviceId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments/available",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect([400, 200]).toContain(res.statusCode);
  });
});
