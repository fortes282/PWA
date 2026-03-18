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
    recurrence_rule TEXT,
    recurrence_end_date TEXT,
    recurrence_parent_id INTEGER,
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
`;

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;
let clientId: number;
let employeeId: number;
let serviceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-reports-new-test-suite-min64chars!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-reports-new-test-suite-min64chars!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const adminHash = await hashPassword("Admin123!");
  const cliHash = await hashPassword("Klient1!");
  const empHash = await hashPassword("Emp12345!");

  db.insert(users).values({ email: "repnew-admin@test.cz", passwordHash: adminHash, name: "Admin", role: "ADMIN" }).returning().get();
  const cli = db.insert(users).values({ email: "repnew-client@test.cz", passwordHash: cliHash, name: "Klient", role: "CLIENT" }).returning().get();
  const emp = db.insert(users).values({ email: "repnew-emp@test.cz", passwordHash: empHash, name: "Terapeut", role: "EMPLOYEE" }).returning().get();
  clientId = cli.id;
  employeeId = emp.id;

  const svc = db.insert(services).values({ name: "Masáž", durationMin: 60, price: 1000, isActive: true }).returning().get();
  serviceId = svc.id;

  // Create some appointments in 2026
  rawSqlite.prepare(`
    INSERT INTO appointments (client_id, employee_id, service_id, start_time, end_time, status, price, booking_activated)
    VALUES (?, ?, ?, ?, ?, 'COMPLETED', 1000, 1)
  `).run(clientId, employeeId, serviceId, "2026-03-10T10:00:00.000Z", "2026-03-10T11:00:00.000Z");

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "repnew-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "repnew-client@test.cz", password: "Klient1!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("New reports routes", () => {
  it("revenue-monthly returns correct structure with 12 months", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/revenue-monthly?year=2026",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.year).toBe(2026);
    expect(body.months).toHaveLength(12);
    expect(body.months[0]).toHaveProperty("month");
    expect(body.months[0]).toHaveProperty("totalRevenue");
    expect(body.months[0]).toHaveProperty("completedAppointments");
    // March (index 2) should have data
    expect(body.months[2].completedAppointments).toBe(1);
    expect(body.months[2].totalRevenue).toBe(1000);
  });

  it("occupancy-weekly returns correct structure", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/occupancy-weekly?from=2026-03-01&to=2026-03-31",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("from");
    expect(body).toHaveProperty("to");
    expect(body).toHaveProperty("weeks");
    expect(Array.isArray(body.weeks)).toBe(true);
    if (body.weeks.length > 0) {
      expect(body.weeks[0]).toHaveProperty("week");
      expect(body.weeks[0]).toHaveProperty("occupancyRate");
    }
  });

  it("revenue-monthly CLIENT gets 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/reports/revenue-monthly?year=2026",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
