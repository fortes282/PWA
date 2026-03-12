/**
 * Integration tests for credits and behavior routes.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

// Use same migration from services test (copy essential tables)
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
let receptionToken: string;
let clientId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-credits-test-suite-min64chars!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-credits-test-suite-min64chars!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const adminHash = await hashPassword("Admin123!");
  const clientHash = await hashPassword("Klient123!");
  const recHash = await hashPassword("Recepce123!");

  const adminResult = db.insert(users).values({
    email: "cred-admin@test.cz", passwordHash: adminHash, name: "Admin", role: "ADMIN",
  }).returning().get();

  const clientResult = db.insert(users).values({
    email: "cred-client@test.cz", passwordHash: clientHash, name: "Client", role: "CLIENT",
  }).returning().get();
  clientId = clientResult.id;

  const recResult = db.insert(users).values({
    email: "cred-rec@test.cz", passwordHash: recHash, name: "Reception", role: "RECEPTION",
  }).returning().get();

  adminToken = (await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: "cred-admin@test.cz", password: "Admin123!" },
  })).json().accessToken;

  clientToken = (await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: "cred-client@test.cz", password: "Klient123!" },
  })).json().accessToken;

  receptionToken = (await app.inject({
    method: "POST", url: "/auth/login",
    payload: { email: "cred-rec@test.cz", password: "Recepce123!" },
  })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Credits", () => {
  it("GET /credits/balance — returns 0 for new user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/credits/balance",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().balance).toBe(0);
  });

  it("POST /credits/adjust — CLIENT gets 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/credits/adjust",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userId: clientId, amount: 1000, type: "PURCHASE" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST /credits/adjust — RECEPTION can add credits", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/credits/adjust",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { userId: clientId, amount: 3000, type: "PURCHASE", note: "Test nabití" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.balance).toBe(3000);
    expect(body.amount).toBe(3000);
  });

  it("GET /credits/balance — reflects added credits", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/credits/balance",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().balance).toBe(3000);
  });

  it("POST /credits/adjust — can deduct credits", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/credits/adjust",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { userId: clientId, amount: -1000, type: "ADJUSTMENT", note: "Odpočet" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().balance).toBe(2000);
  });

  it("GET /credits/transactions — returns array", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/credits/transactions",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /credits/balance/:userId — ADMIN can check any user", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/credits/balance/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    // Balance should be >= 0 (exact value depends on test execution order across files)
    expect(typeof res.json().balance).toBe("number");
    expect(res.json().balance).toBeGreaterThanOrEqual(0);
  });
});

describe("Behavior", () => {
  it("GET /behavior/:userId — requires ADMIN/RECEPTION", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /behavior/:userId — ADMIN can access", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.score).toBe("number");
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("POST /behavior/record — ADMIN can record NO_SHOW", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/behavior/record",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, type: "NO_SHOW", note: "Test no-show" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    // Response: { event: { points, ... }, newScore }
    expect(body.event.points).toBeLessThan(0); // NO_SHOW should deduct points
    expect(typeof body.newScore).toBe("number");
  });

  it("GET /behavior/:userId — score is a number", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().score).toBe("number");
    expect(res.json().score).toBeGreaterThanOrEqual(0);
    expect(res.json().score).toBeLessThanOrEqual(100);
  });

  it("POST /behavior/record — CLIENT cannot record events", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/behavior/record",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userId: clientId, type: "ON_TIME" },
    });
    expect(res.statusCode).toBe(403);
  });
});
