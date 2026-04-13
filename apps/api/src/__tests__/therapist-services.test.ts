/**
 * Integration tests — /therapist-services
 * Tests: list all, list by employee, PUT assignment, RBAC, validation
 */
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
    category TEXT,
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
    employee_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS open_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    service_id INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'open',
    max_bookings INTEGER NOT NULL DEFAULT 1,
    current_bookings INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    slot_id INTEGER,
    is_out_of_slot INTEGER NOT NULL DEFAULT 0,
    room_id INTEGER,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    cancellation_reason TEXT,
    price REAL,
    paid_at TEXT,
    payment_method TEXT,
    booking_activated INTEGER NOT NULL DEFAULT 0,
    client_note TEXT,
    is_online INTEGER NOT NULL DEFAULT 0,
    cancellation_risk_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    appointment_id INTEGER,
    invoice_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
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
    client_id INTEGER NOT NULL,
    invoice_type TEXT NOT NULL DEFAULT 'GENERAL',
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
    invoice_id INTEGER NOT NULL,
    appointment_id INTEGER,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    employee_id INTEGER,
    preferred_dates TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING',
    notified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS medical_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    appointment_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    points REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    target_id INTEGER,
    target_type TEXT,
    details TEXT,
    ip TEXT,
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
    matched_invoice_id INTEGER,
    matched_client_id INTEGER,
    is_matched INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE,
    blood_type TEXT,
    allergies TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cancellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    reason TEXT,
    is_unjustified INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS profile_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    changed_by INTEGER NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS credit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewed_by INTEGER,
    review_note TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const ts = Date.now();

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let employeeToken: string;
let clientToken: string;
let employeeId: number;
let serviceId1: number;
let serviceId2: number;
let serviceId3: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-therapist-svcs-suite-min64chars!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-therapist-svcs-suite-min64chars!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";
  process.env.RATE_LIMIT_MAX = "1000000";

  app = await buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const admHash = await hashPassword("Admin123!");
  const recHash = await hashPassword("Recepce1!");
  const empHash = await hashPassword("Terapeut123!");
  const cliHash = await hashPassword("Klient123!");

  db.insert(users).values({ email: `ts-admin-${ts}@test.cz`, passwordHash: admHash, name: "Admin TS", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: `ts-rec-${ts}@test.cz`, passwordHash: recHash, name: "Recepce TS", role: "RECEPTION" }).returning().get();
  const empRes = db.insert(users).values({ email: `ts-emp-${ts}@test.cz`, passwordHash: empHash, name: "Terapeut TS", role: "EMPLOYEE" }).returning().get();
  employeeId = empRes.id;
  db.insert(users).values({ email: `ts-client-${ts}@test.cz`, passwordHash: cliHash, name: "Klient TS", role: "CLIENT" }).returning().get();

  const svc1 = db.insert(services).values({ name: "Fyzioterapie", durationMin: 60, price: 1200, isActive: true }).returning().get();
  serviceId1 = svc1.id;
  const svc2 = db.insert(services).values({ name: "Masáž", durationMin: 45, price: 800, isActive: true }).returning().get();
  serviceId2 = svc2.id;
  const svc3 = db.insert(services).values({ name: "Elektroterapie", durationMin: 30, price: 600, isActive: true }).returning().get();
  serviceId3 = svc3.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ts-admin-${ts}@test.cz`, password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ts-rec-${ts}@test.cz`, password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ts-emp-${ts}@test.cz`, password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `ts-client-${ts}@test.cz`, password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /therapist-services — list all assignments (ADMIN/RECEPTION)", () => {
  it("admin can list all therapist-service assignments", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/therapist-services",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("reception can list all therapist-service assignments", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/therapist-services",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("employee cannot list all assignments (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/therapist-services",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot list all assignments (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/therapist-services",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/therapist-services" });
    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /therapist-services/:employeeId — assign services", () => {
  it("admin can assign services to a therapist", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [serviceId1, serviceId2] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { serviceId: number }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    const svcIds = body.map((r) => r.serviceId);
    expect(svcIds).toContain(serviceId1);
    expect(svcIds).toContain(serviceId2);
  });

  it("reception can assign services to a therapist", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { serviceIds: [serviceId3] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { serviceId: number }[];
    expect(body).toHaveLength(1);
    expect(body[0].serviceId).toBe(serviceId3);
  });

  it("PUT replaces all assignments (idempotent)", async () => {
    // Assign 3 services first
    await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [serviceId1, serviceId2, serviceId3] },
    });

    // Then replace with just 1
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [serviceId1] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect((res.json() as { serviceId: number }[])[0].serviceId).toBe(serviceId1);
  });

  it("can clear all services by passing empty array", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it("returns 404 when employee does not exist", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/therapist-services/999999",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [serviceId1] },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/not found/i);
  });

  it("returns 404 when target user is not EMPLOYEE role", async () => {
    // clientId is a CLIENT, not EMPLOYEE
    const cliRes = rawSqlite.prepare("SELECT id FROM users WHERE role = 'CLIENT' LIMIT 1").get() as { id: number };
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${cliRes.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [serviceId1] },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when serviceIds is not an array", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: "not-an-array" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/serviceIds/);
  });

  it("employee cannot assign services (403)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { serviceIds: [serviceId1] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("client cannot assign services (403)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { serviceIds: [serviceId1] },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /therapist-services/:employeeId — services for specific therapist", () => {
  beforeAll(async () => {
    // Assign services before reading
    await app.inject({
      method: "PUT",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { serviceIds: [serviceId1, serviceId2] },
    });
  });

  it("admin can view services for a specific therapist", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { serviceId: number; serviceName: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0]).toHaveProperty("serviceName");
    expect(body[0]).toHaveProperty("durationMin");
    expect(body[0]).toHaveProperty("price");
  });

  it("reception can view services for a specific therapist", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("employee can view services for a therapist", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("client can view services for a therapist", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/therapist-services/${employeeId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("returns empty array for therapist with no assignments", async () => {
    const newEmpHash = await hashPassword("NoSvc123!");
    const newEmp = db.insert(users).values({ email: `ts-nosvc-${ts}@test.cz`, passwordHash: newEmpHash, name: "No Services Emp", role: "EMPLOYEE" }).returning().get();

    const res = await app.inject({
      method: "GET",
      url: `/therapist-services/${newEmp.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it("list all assignments includes correct employeeName and serviceName", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/therapist-services",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as { employeeName: string; serviceName: string; employeeId: number }[];
    const myRows = rows.filter((r) => r.employeeId === employeeId);
    expect(myRows.length).toBeGreaterThan(0);
    expect(typeof myRows[0].employeeName).toBe("string");
    expect(typeof myRows[0].serviceName).toBe("string");
  });
});
