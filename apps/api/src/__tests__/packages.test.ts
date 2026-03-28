// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services } from "../db/schema.js";
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
    cancellation_reason TEXT,
    client_note TEXT,
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
  CREATE TABLE IF NOT EXISTS appointment_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES users(id),
    client_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    room_id INTEGER REFERENCES rooms(id),
    start_time TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'WEEKLY',
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS time_off_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES users(id),
    start_date_time TEXT NOT NULL,
    end_date_time TEXT NOT NULL,
    reason TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS service_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    service_id INTEGER REFERENCES services(id),
    sessions_count INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS client_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id INTEGER NOT NULL REFERENCES service_packages(id),
    sessions_total INTEGER NOT NULL,
    sessions_used INTEGER NOT NULL DEFAULT 0,
    purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
  );
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let clientId: number;
let packageId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-packages-test-suite-min64chars!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-packages-test-suite-min64chars!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const adminHash = await hashPassword("Admin123!");
  const cliHash = await hashPassword("Klient1!");

  db.insert(users).values({ email: "pkg-admin@test.cz", passwordHash: adminHash, name: "Admin", role: "ADMIN" }).returning().get();
  const cli = db.insert(users).values({ email: "pkg-client@test.cz", passwordHash: cliHash, name: "Klient", role: "CLIENT" }).returning().get();
  clientId = cli.id;

  db.insert(services).values({ name: "Masáž", durationMin: 60, price: 1000, isActive: true }).returning().get();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "pkg-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "pkg-client@test.cz", password: "Klient1!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe.skip("Service Packages — CRUD", () => {
  it("ADMIN může vytvořit balíček", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/packages",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Startovací balíček", sessionsCount: 5, price: 4500 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe("Startovací balíček");
    expect(body.sessionsCount).toBe(5);
    packageId = body.id;
  });

  it("CLIENT nemůže vytvořit balíček", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/packages",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { name: "Hack", sessionsCount: 1, price: 0 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /packages vrátí aktivní balíčky", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/packages",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("ADMIN může deaktivovat balíček", async () => {
    // Create another package to deactivate
    const createRes = await app.inject({
      method: "POST",
      url: "/packages",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Ke zrušení", sessionsCount: 2, price: 1800 },
    });
    const pkgId = createRes.json().id;

    const res = await app.inject({
      method: "DELETE",
      url: `/packages/${pkgId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message).toMatch(/deaktiv/i);
  });
});

describe.skip("Service Packages — Purchase", () => {
  it("klient může koupit balíček", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/packages/${packageId}/purchase`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message).toMatch(/zakoupen/i);
    expect(body.clientPackage.sessionsTotal).toBe(5);
    expect(body.clientPackage.sessionsUsed).toBe(0);
  });

  it("GET /clients/:id/packages vrátí správná data", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/packages`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("sessions_remaining");
    expect(body[0].sessions_remaining).toBe(5);
  });

  it("klient nemůže číst balíčky jiného klienta", async () => {
    // Create second client
    const { hashPassword: hp } = await import("../utils/hash.js");
    const hash2 = await hp("Klient2!");
    const { rawSqlite: rs } = await import("../db/index.js");
    const other = rs.prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'CLIENT') RETURNING id"
    ).get("pkg-other@test.cz", hash2, "Other") as { id: number };

    const res = await app.inject({
      method: "GET",
      url: `/clients/${other.id}/packages`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
