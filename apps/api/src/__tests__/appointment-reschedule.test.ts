/**
 * Integration tests — PATCH /appointments/:id/reschedule
 * Tests: RBAC, validation, conflict detection, successful reschedule, notification
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
  CREATE TABLE IF NOT EXISTS open_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id),
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
    client_id INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    slot_id INTEGER REFERENCES open_slots(id),
    is_out_of_slot INTEGER NOT NULL DEFAULT 0,
    room_id INTEGER REFERENCES rooms(id),
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
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id),
    invoice_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    note TEXT,
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
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES users(id),
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
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id),
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    points REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
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
    contraindications TEXT,
    medications TEXT,
    chronic_conditions TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    primary_diagnosis TEXT,
    functional_status TEXT,
    rehab_goals TEXT,
    notes TEXT,
    last_updated_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  CREATE TABLE IF NOT EXISTS medical_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    appointment_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    diagnosis TEXT,
    recommendations TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cancellations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    is_unjustified INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL REFERENCES users(id),
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
let clientId: number;
let employeeId: number;
let serviceId: number;

// Helper: create an appointment directly in DB
function insertAppointment(opts: {
  clientId: number;
  employeeId: number;
  serviceId: number;
  startTime: string;
  endTime: string;
  status?: string;
  roomId?: number | null;
}): number {
  const result = rawSqlite
    .prepare(
      `INSERT INTO appointments (client_id, employee_id, service_id, start_time, end_time, status, room_id)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .get(
      opts.clientId,
      opts.employeeId,
      opts.serviceId,
      opts.startTime,
      opts.endTime,
      opts.status ?? "CONFIRMED",
      opts.roomId ?? null
    ) as { id: number };
  return result.id;
}

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-reschedule-suite-min64chars!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-reschedule-suite-min64chars!!!!!!!!!!!!!";
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

  db.insert(users).values({ email: `rs-admin-${ts}@test.cz`, passwordHash: admHash, name: "Admin RS", role: "ADMIN" }).returning().get();
  db.insert(users).values({ email: `rs-rec-${ts}@test.cz`, passwordHash: recHash, name: "Recepce RS", role: "RECEPTION" }).returning().get();
  const empRes = db.insert(users).values({ email: `rs-emp-${ts}@test.cz`, passwordHash: empHash, name: "Terapeut RS", role: "EMPLOYEE" }).returning().get();
  employeeId = empRes.id;
  const cliRes = db.insert(users).values({ email: `rs-client-${ts}@test.cz`, passwordHash: cliHash, name: "Klient RS", role: "CLIENT" }).returning().get();
  clientId = cliRes.id;

  const svcRes = db.insert(services).values({ name: "Terapie RS 60min", durationMin: 60, price: 1000, isActive: true }).returning().get();
  serviceId = svcRes.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `rs-admin-${ts}@test.cz`, password: "Admin123!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `rs-rec-${ts}@test.cz`, password: "Recepce1!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `rs-emp-${ts}@test.cz`, password: "Terapeut123!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: `rs-client-${ts}@test.cz`, password: "Klient123!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("PATCH /appointments/:id/reschedule — RBAC", () => {
  it("client cannot reschedule (403)", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-06-01T10:00:00.000Z",
      endTime: "2027-06-01T11:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { startTime: "2027-06-02T10:00:00.000Z", endTime: "2027-06-02T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/Forbidden/i);
  });

  it("employee cannot reschedule (403)", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-06-01T12:00:00.000Z",
      endTime: "2027-06-01T13:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { startTime: "2027-06-02T12:00:00.000Z", endTime: "2027-06-02T13:00:00.000Z" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("reception can reschedule an appointment", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-06-03T09:00:00.000Z",
      endTime: "2027-06-03T10:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-06-05T09:00:00.000Z", endTime: "2027-06-05T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(200);
    // Route returns raw SQLite RETURNING * (snake_case column names)
    const body = res.json();
    expect(body.start_time ?? body.startTime).toBe("2027-06-05T09:00:00.000Z");
    expect(body.previousStartTime ?? body.previous_start_time).toBe("2027-06-03T09:00:00.000Z");
  });

  it("admin can reschedule an appointment", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-07-01T08:00:00.000Z",
      endTime: "2027-07-01T09:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { startTime: "2027-07-02T08:00:00.000Z", endTime: "2027-07-02T09:00:00.000Z" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rescheduledBy).toBeDefined();
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/appointments/1/reschedule",
      payload: { startTime: "2027-06-10T10:00:00.000Z", endTime: "2027-06-10T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("PATCH /appointments/:id/reschedule — validation", () => {
  it("returns 400 when startTime is missing", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-08-01T10:00:00.000Z",
      endTime: "2027-08-01T11:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { endTime: "2027-08-02T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/startTime/);
  });

  it("returns 400 when endTime is missing", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-08-02T10:00:00.000Z",
      endTime: "2027-08-02T11:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-08-03T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/endTime/);
  });

  it("returns 400 when startTime >= endTime", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-08-05T10:00:00.000Z",
      endTime: "2027-08-05T11:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-08-06T11:00:00.000Z", endTime: "2027-08-06T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/startTime must be before endTime/i);
  });

  it("returns 400 for invalid date format", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-08-10T10:00:00.000Z",
      endTime: "2027-08-10T11:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "not-a-date", endTime: "2027-08-11T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Invalid date/i);
  });

  it("returns 404 for non-existent appointment", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/appointments/999999/reschedule",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-09-01T10:00:00.000Z", endTime: "2027-09-01T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/not found/i);
  });
});

describe("PATCH /appointments/:id/reschedule — status checks", () => {
  it("cannot reschedule a CANCELLED appointment", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-09-10T10:00:00.000Z",
      endTime: "2027-09-10T11:00:00.000Z",
      status: "CANCELLED",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-09-11T10:00:00.000Z", endTime: "2027-09-11T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/CANCELLED/);
  });

  it("cannot reschedule a COMPLETED appointment", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-09-12T10:00:00.000Z",
      endTime: "2027-09-12T11:00:00.000Z",
      status: "COMPLETED",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-09-13T10:00:00.000Z", endTime: "2027-09-13T11:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/COMPLETED/);
  });
});

describe("PATCH /appointments/:id/reschedule — conflict detection", () => {
  it("returns 409 when employee has a conflicting appointment", async () => {
    // Existing appointment occupying the target slot
    insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-10-01T09:00:00.000Z",
      endTime: "2027-10-01T10:00:00.000Z",
    });

    // Appointment to reschedule (different slot currently, different client)
    const cliHash2 = await hashPassword("Klient2!");
    const cli2 = db.insert(users).values({ email: `rs-cli2-${ts}@test.cz`, passwordHash: cliHash2, name: "Klient2 RS", role: "CLIENT" }).returning().get();
    const apptId = insertAppointment({
      clientId: cli2.id, employeeId, serviceId,
      startTime: "2027-10-02T09:00:00.000Z",
      endTime: "2027-10-02T10:00:00.000Z",
    });

    // Reschedule into conflicting slot
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-10-01T09:30:00.000Z", endTime: "2027-10-01T10:30:00.000Z" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/conflict/i);
  });

  it("response includes previousStartTime, previousEndTime, previousRoomId", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-11-01T14:00:00.000Z",
      endTime: "2027-11-01T15:00:00.000Z",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-11-03T14:00:00.000Z", endTime: "2027-11-03T15:00:00.000Z" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("previousStartTime");
    expect(res.json()).toHaveProperty("previousEndTime");
    expect(res.json()).toHaveProperty("previousRoomId");
  });

  it("creates a notification for the client after reschedule", async () => {
    const apptId = insertAppointment({
      clientId, employeeId, serviceId,
      startTime: "2027-12-01T10:00:00.000Z",
      endTime: "2027-12-01T11:00:00.000Z",
    });

    await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}/reschedule`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { startTime: "2027-12-05T10:00:00.000Z", endTime: "2027-12-05T11:00:00.000Z" },
    });

    const notification = rawSqlite
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'APPOINTMENT_UPDATED' ORDER BY id DESC LIMIT 1")
      .get(clientId) as { title: string; message: string } | undefined;

    expect(notification).toBeDefined();
    expect(notification?.title).toBe("Přesunutý termín");
  });
});
