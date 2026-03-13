/**
 * Integration tests for appointment lifecycle:
 * - Create appointment
 * - Activate booking
 * - Status transitions (CONFIRMED → COMPLETED / NO_SHOW)
 * - Credit auto-deduction on COMPLETED
 * - Behavior score updates (ON_TIME, NO_SHOW, LATE_CANCEL, TIMELY_CANCEL)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, creditTransactions, rooms } from "../db/schema.js";
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
let employeeToken: string;
let receptionToken: string;
let clientId: number;
let employeeId: number;
let serviceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-for-appointments-test-suite-min64chars!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-appts-test-suite-min64chars!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const adminHash = await hashPassword("Admin123!");
  const clientHash = await hashPassword("Klient123!");
  const empHash = await hashPassword("Emp123456!");
  const recHash = await hashPassword("Recepce1!");

  db.insert(users).values({ email: "appt-admin@test.cz", passwordHash: adminHash, name: "Admin", role: "ADMIN" }).returning().get();
  const clientRes = db.insert(users).values({ email: "appt-client@test.cz", passwordHash: clientHash, name: "Klient Apolinář", role: "CLIENT" }).returning().get();
  clientId = clientRes.id;
  const empRes = db.insert(users).values({ email: "appt-emp@test.cz", passwordHash: empHash, name: "Terapeut Tomáš", role: "EMPLOYEE" }).returning().get();
  employeeId = empRes.id;
  db.insert(users).values({ email: "appt-rec@test.cz", passwordHash: recHash, name: "Recepce Radka", role: "RECEPTION" }).returning().get();

  const svcRes = db.insert(services).values({ name: "Masáž 60min", durationMin: 60, price: 1200, isActive: true }).returning().get();
  serviceId = svcRes.id;

  // Seed initial credit balance: 5000 Kč
  db.insert(creditTransactions).values({ userId: clientId, type: "PURCHASE", amount: 5000, balance: 5000, note: "Počáteční kredit" }).run();

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "appt-admin@test.cz", password: "Admin123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "appt-client@test.cz", password: "Klient123!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "appt-emp@test.cz", password: "Emp123456!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "appt-rec@test.cz", password: "Recepce1!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("Appointment lifecycle", () => {
  let apptId: number;

  it("reception can create appointment", async () => {
    const startTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 1200 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe("PENDING");
    apptId = res.json().id;
  });

  it("reception can activate appointment booking", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/appointments/${apptId}/activate`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // Verify appointment is now CONFIRMED
    const apptRes = await app.inject({
      method: "GET",
      url: "/appointments",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const found = apptRes.json().find((a: any) => a.id === apptId);
    expect(found?.status).toBe("CONFIRMED");
    expect(found?.bookingActivated).toBe(true);
  });

  it("client can view their appointment", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const appts = res.json();
    expect(appts.some((a: any) => a.id === apptId)).toBe(true);
  });

  it("employee marks appointment as COMPLETED → credit deducted", async () => {
    // Verify appointment has price set
    const apptListRes = await app.inject({
      method: "GET",
      url: "/appointments",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const thisAppt = apptListRes.json().find((a: any) => a.id === apptId);
    expect(thisAppt?.price).toBe(1200);

    const balanceBefore = await app.inject({
      method: "GET",
      url: "/credits/balance",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const beforeBalance = balanceBefore.json().balance;
    expect(beforeBalance).toBe(5000);

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { status: "COMPLETED" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("COMPLETED");

    // Check credit balance was deducted
    const balanceAfter = await app.inject({
      method: "GET",
      url: "/credits/balance",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(balanceAfter.json().balance).toBe(5000 - 1200);
  });

  it("behavior score increases (ON_TIME) after COMPLETED", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    // Behavior score should be 100 (default) + 5 (ON_TIME) = 105, capped at 100
    expect(res.json().behaviorScore).toBe(100);
  });
});

describe("Appointment cancellation behavior", () => {
  let appt2Id: number;

  it("creates a new appointment for cancellation test", async () => {
    // Appointment > 24h from now → TIMELY_CANCEL
    const startTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 800 },
    });
    expect(res.statusCode).toBe(201);
    appt2Id = res.json().id;
  });

  it("client cancels > 24h ahead → TIMELY_CANCEL, score -3", async () => {
    // Get initial score
    const before = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const scoreBeforeCancel = before.json().behaviorScore;

    await app.inject({
      method: "PATCH",
      url: `/appointments/${appt2Id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { status: "CANCELLED" },
    });

    const after = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(after.json().behaviorScore).toBe(Math.min(100, Math.max(0, scoreBeforeCancel - 3)));
  });
});

describe("Auto-invoice on negative credit balance", () => {
  let apptInvoiceId: number;

  it("creates appointment with price > available credits", async () => {
    // Client has 3800 after the first COMPLETED test, create appointment for 5000 (will go negative)
    const startTime = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 5000 },
    });
    expect(res.statusCode).toBe(201);
    apptInvoiceId = res.json().id;

    // Activate it
    await app.inject({
      method: "POST",
      url: `/appointments/${apptInvoiceId}/activate`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
  });

  it("COMPLETED with insufficient credits → invoice auto-created", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptInvoiceId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { status: "COMPLETED" },
    });
    expect(res.statusCode).toBe(200);

    // Check that balance is now negative (3800 - 5000 = -1200)
    const balanceRes = await app.inject({
      method: "GET",
      url: "/credits/balance",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(balanceRes.json().balance).toBe(3800 - 5000);

    // Check invoice was created
    const invoicesRes = await app.inject({
      method: "GET",
      url: "/invoices",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    const clientInvoices = invoicesRes.json().filter((i: any) => i.clientId === clientId);
    expect(clientInvoices.length).toBeGreaterThan(0);
    const autoInvoice = clientInvoices.find((i: any) => i.status === "SENT" && i.total > 0);
    expect(autoInvoice).toBeTruthy();
    expect(autoInvoice.total).toBe(1200); // amount short
  });
});

describe("NO_SHOW behavior", () => {
  let appt3Id: number;

  it("creates appointment for NO_SHOW test", async () => {
    const startTime = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 1000 },
    });
    expect(res.statusCode).toBe(201);
    appt3Id = res.json().id;
  });

  it("reception marks NO_SHOW → score -20, notification sent", async () => {
    const before = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const scoreBefore = before.json().behaviorScore;

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${appt3Id}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { status: "NO_SHOW" },
    });
    expect(res.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: `/users/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(after.json().behaviorScore).toBe(Math.min(100, Math.max(0, scoreBefore - 20)));
  });
});
