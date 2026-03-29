/**
 * Integration tests for appointment lifecycle:
 * - Create appointment
 * - Activate booking
 * - Status transitions (CONFIRMED → COMPLETED / CANCELLED)
 * - Credit auto-deduction on COMPLETED
 * - Behavior score updates (ON_TIME, LATE_CANCEL, TIMELY_CANCEL)
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, creditTransactions } from "../db/schema.js";
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
    booking_activated INTEGER NOT NULL DEFAULT 0, cancellation_reason TEXT,
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
  process.env.RATE_LIMIT_MAX = "1000000";

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

describe("Appointments — double-booking conflict (409)", () => {
  it("rejects employee double-booking at overlapping time", async () => {
    // Create a confirmed appointment
    const base = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const startTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0).toISOString();
    const endTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 0, 0).toISOString();

    const r1 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 800 },
    });
    expect(r1.statusCode).toBe(201);

    // Try to book same employee in overlapping time (different client)
    const r2 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: clientId + 999, employeeId, serviceId, startTime, endTime, price: 800 },
    });
    // Should be 409 — employee conflict
    expect(r2.statusCode).toBe(409);
  });

  it("PATCH with cancellationReason stores the reason", async () => {
    const startTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();
    const cr = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 900 },
    });
    const crId = cr.json().id;

    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${crId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { status: "CANCELLED", cancellationReason: "Terapeut onemocněl" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cancellationReason).toBe("Terapeut onemocněl");
    expect(res.json().status).toBe("CANCELLED");
  });

  it("rejects client double-booking at overlapping time", async () => {
    const base = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000);
    const startTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 14, 0, 0).toISOString();
    const endTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 15, 0, 0).toISOString();

    const r1 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 800 },
    });
    expect(r1.statusCode).toBe(201);

    // Try to book same client at overlapping time (different employee id)
    const r2 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId: employeeId + 999, serviceId, startTime, endTime, price: 800 },
    });
    // Should be 409 — client conflict
    expect(r2.statusCode).toBe(409);
  });
});

describe("GET /appointments/:id — enriched response", () => {
  let enrichedApptId: number;

  it("creates appointment for enriched get test", async () => {
    const startTime = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 1200 },
    });
    expect(res.statusCode).toBe(201);
    enrichedApptId = res.json().id;
  });

  it("returns enriched appointment with clientName, employeeName, serviceName", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/appointments/${enrichedApptId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(enrichedApptId);
    expect(typeof body.clientName).toBe("string");
    expect(typeof body.employeeName).toBe("string");
    expect(typeof body.serviceName).toBe("string");
    expect(typeof body.serviceDuration).toBe("number");
  });
});

describe("PATCH /appointments/:id/notes", () => {
  let notesApptId: number;

  it("creates appointment for notes test", async () => {
    const startTime = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 1000 },
    });
    expect(res.statusCode).toBe(201);
    notesApptId = res.json().id;
  });

  it("reception can update appointment notes", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${notesApptId}/notes`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { notes: "Klient přijede o 5 minut dříve. Přinese dokumentaci." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().notes).toBe("Klient přijede o 5 minut dříve. Přinese dokumentaci.");
  });

  it("client cannot update appointment notes (403)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${notesApptId}/notes`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { notes: "Hack" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 when notes is not a string", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/appointments/${notesApptId}/notes`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { notes: 12345 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /appointments/calendar", () => {
  it("reception can access calendar endpoint", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const res = await app.inject({
      method: "GET",
      url: `/appointments/calendar?from=${today}&to=${in14}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("calendar response includes enriched names", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const res = await app.inject({
      method: "GET",
      url: `/appointments/calendar?from=${today}&to=${in30}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    if (items.length > 0) {
      const first = items[0];
      // Should have enriched fields
      expect(Object.prototype.hasOwnProperty.call(first, "clientName")).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(first, "employeeName")).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(first, "serviceName")).toBe(true);
    }
  });

  it("client cannot access calendar (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments/calendar",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("calendar excludes CANCELLED appointments by default", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments/calendar",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.every((a: any) => a.status !== "CANCELLED")).toBe(true);
  });
});

describe("GET /appointments — filters and pagination", () => {
  it("?status=PENDING filters by single status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments?status=PENDING",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // May return array (no limit) or paginated
    const items = Array.isArray(body) ? body : body.items;
    expect(items.every((a: any) => a.status === "PENDING")).toBe(true);
  });

  it("?status=CONFIRMED,PENDING filters by multiple statuses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments?status=CONFIRMED,PENDING",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const items = Array.isArray(body) ? body : body.items;
    items.forEach((a: any) => {
      expect(["CONFIRMED", "PENDING"]).toContain(a.status);
    });
  });

  it("?limit=2 returns paginated response", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments?limit=2",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("pagination");
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.pagination.limit).toBe(2);
  });

  it("?search= filters by notes substring", async () => {
    // Create a fresh appointment and set its notes
    const startTime = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();
    const created = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 1000 },
    });
    const searchApptId = created.json().id;

    await app.inject({
      method: "PATCH",
      url: `/appointments/${searchApptId}/notes`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { notes: "Vyhledatelná poznámka XYZ-TEST-42" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/appointments?search=XYZ-TEST-42",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const items = Array.isArray(body) ? body : body.items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.every((a: any) => (a.notes ?? "").includes("XYZ-TEST-42"))).toBe(true);
  });
});

describe("GET /appointments/upcoming", () => {
  let upcomingApptId: number;
  let upcomingClientToken: string;
  let upcomingClientId: number;
  let upcomingEmpId: number;

  it("sets up dedicated client/employee for upcoming tests", async () => {
    const h = await hashPassword("Upcoming123!");
    const uc = db.insert(users).values({ email: "upcoming-client@test.cz", passwordHash: h, name: "Upcoming Client", role: "CLIENT" }).returning({ id: users.id }).get();
    upcomingClientId = uc.id;
    const ue = db.insert(users).values({ email: "upcoming-emp@test.cz", passwordHash: h, name: "Upcoming Emp", role: "EMPLOYEE" }).returning({ id: users.id }).get();
    upcomingEmpId = ue.id;
    upcomingClientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "upcoming-client@test.cz", password: "Upcoming123!" } })).json().accessToken;
    expect(upcomingClientId).toBeGreaterThan(0);
  });

  it("creates a future appointment for upcoming test", async () => {
    const startDt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    const res = await app.inject({
      method: "POST", url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: {
        clientId: upcomingClientId,
        employeeId: upcomingEmpId,
        serviceId: serviceId,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        notes: "upcoming test appt",
        price: 800,
      },
    });
    expect(res.statusCode).toBe(201);
    upcomingApptId = res.json().id;
  });

  it("client sees their own upcoming appointments", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/upcoming",
      headers: { authorization: `Bearer ${upcomingClientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().some((a: any) => a.id === upcomingApptId)).toBe(true);
  });

  it("upcoming appointments are sorted chronologically", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/upcoming",
      headers: { authorization: `Bearer ${upcomingClientToken}` },
    });
    const items = res.json();
    if (items.length > 1) {
      for (let i = 1; i < items.length; i++) {
        expect(items[i].startTime >= items[i - 1].startTime).toBe(true);
      }
    }
    expect(true).toBe(true); // pass if 0 or 1 items
  });

  it("upcoming does not include cancelled appointments", async () => {
    await app.inject({
      method: "PATCH", url: `/appointments/${upcomingApptId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { status: "CANCELLED" },
    });
    const res = await app.inject({
      method: "GET", url: "/appointments/upcoming",
      headers: { authorization: `Bearer ${upcomingClientToken}` },
    });
    expect(res.json().some((a: any) => a.id === upcomingApptId)).toBe(false);
  });

  it("admin sees all upcoming appointments", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/upcoming",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/appointments/upcoming" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /appointments/history", () => {
  it("returns paginated structure", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/history",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.total).toBe("number");
    expect(typeof body.pagination.page).toBe("number");
  });

  it("client only sees their own history", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/history",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const items = res.json().items;
    // All items should belong to clientId
    items.forEach((a: any) => expect(a.clientId).toBe(clientId));
  });

  it("history contains only past completed/cancelled", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/history",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const items = res.json().items;
    items.forEach((a: any) => {
      expect(["COMPLETED", "CANCELLED"]).toContain(a.status);
    });
  });

  it("admin sees all history with pagination", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/history?page=1&limit=5",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeLessThanOrEqual(5);
    expect(body.pagination.limit).toBe(5);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/appointments/history" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /appointments/today", () => {
  it("reception gets today's appointments", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/today",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    // All items should be today's
    const today = new Date().toISOString().slice(0, 10);
    res.json().forEach((a: any) => {
      expect(a.startTime.startsWith(today)).toBe(true);
      expect(a.status).not.toBe("CANCELLED");
    });
  });

  it("admin gets today's appointments", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/today",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("client cannot access today's appointments (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/today",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/appointments/today" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /appointments/stats", () => {
  it("client gets their own appointment stats", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/stats",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.total).toBe("number");
    expect(typeof body.confirmed).toBe("number");
    expect(typeof body.completed).toBe("number");
    expect(typeof body.cancelled).toBe("number");
    expect(typeof body.pending).toBe("number");
    expect(typeof body.upcoming).toBe("number");
  });

  it("total equals sum of all statuses", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/stats",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    const b = res.json();
    expect(b.total).toBe(b.confirmed + b.completed + b.cancelled + b.pending);
  });

  it("admin gets all appointments stats", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    // Admin total should be >= client total
    const clientRes = await app.inject({
      method: "GET", url: "/appointments/stats",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.json().total).toBeGreaterThanOrEqual(clientRes.json().total);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/appointments/stats" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /appointments/:id/confirm", () => {
  let confirmApptId: number;

  it("creates PENDING appointment to confirm", async () => {
    const startDt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    const newClient = db.insert(users).values({ email: "confirm-client@test.cz", passwordHash: "x", name: "Confirm Client", role: "CLIENT" }).returning({ id: users.id }).get();
    const newEmp = db.insert(users).values({ email: "confirm-emp@test.cz", passwordHash: "x", name: "Confirm Emp", role: "EMPLOYEE" }).returning({ id: users.id }).get();
    const res = await app.inject({
      method: "POST", url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: {
        clientId: newClient.id,
        employeeId: newEmp.id,
        serviceId: serviceId,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        notes: "confirm test",
        price: 500,
      },
    });
    expect(res.statusCode).toBe(201);
    confirmApptId = res.json().id;
  });

  it("reception can confirm a PENDING appointment", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${confirmApptId}/confirm`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("CONFIRMED");
  });

  it("cannot confirm already-confirmed appointment (400)", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${confirmApptId}/confirm`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("client cannot confirm (403)", async () => {
    const res = await app.inject({
      method: "POST", url: `/appointments/${confirmApptId}/confirm`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent appointment", async () => {
    const res = await app.inject({
      method: "POST", url: "/appointments/99999/confirm",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /appointments/pending-activation", () => {
  it("reception gets pending-activation list", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/pending-activation",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(Array.isArray(items)).toBe(true);
    items.forEach((a: any) => {
      expect(a.status).toBe("PENDING");
      // bookingActivated is stored as 0/1 in SQLite (falsy)
      expect(a.bookingActivated).toBeFalsy();
    });
  });

  it("client cannot access pending activation (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/pending-activation",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/appointments/pending-activation" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /appointments/export/csv", () => {
  it("admin gets CSV export", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/export/csv",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("appointments-");
    // Check CSV structure
    const lines = res.body.replace(/^\uFEFF/, "").split("\n");
    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("Klient");
    expect(lines[0]).toContain("Status");
  });

  it("reception gets CSV export", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/export/csv",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client cannot export CSV (403)", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/export/csv",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("CSV export respects status filter", async () => {
    const res = await app.inject({
      method: "GET", url: "/appointments/export/csv?status=COMPLETED",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    // All data rows should have COMPLETED status
    const lines = res.body.replace(/^\uFEFF/, "").split("\n").filter(Boolean);
    for (const line of lines.slice(1)) {
      // Status is in 7th column (index 6)
      const cols = line.split(",");
      if (cols.length > 6) {
        expect(cols[6]).toBe("COMPLETED");
      }
    }
  });
});

describe("Conflict detection", () => {
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const conflictStart = new Date(future.getFullYear(), future.getMonth(), future.getDate(), 10, 0, 0).toISOString();
  const conflictEnd = new Date(future.getFullYear(), future.getMonth(), future.getDate(), 11, 0, 0).toISOString();
  const noConflictStart = new Date(future.getFullYear(), future.getMonth(), future.getDate(), 14, 0, 0).toISOString();
  const noConflictEnd = new Date(future.getFullYear(), future.getMonth(), future.getDate(), 15, 0, 0).toISOString();

  it("employee conflict returns 409 with CONFLICT error", async () => {
    // Create first appointment
    const res1 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime: conflictStart, endTime: conflictEnd, price: 1200 },
    });
    expect(res1.statusCode).toBe(201);

    // Try to create overlapping appointment for same employee with different client
    const empHash = await hashPassword("Other123!");
    const otherClient = db.insert(users).values({ email: "conflict-client@test.cz", passwordHash: empHash, name: "Other Client", role: "CLIENT" }).returning().get();

    const res2 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: otherClient.id, employeeId, serviceId, startTime: conflictStart, endTime: conflictEnd, price: 1200 },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error).toBe("CONFLICT");
    expect(res2.json().message).toBe("Terapeut má v tomto čase jiný termín");
  });

  it("client conflict returns 409 with CONFLICT error", async () => {
    // Create second employee to use
    const empHash2 = await hashPassword("Emp2222!");
    const emp2 = db.insert(users).values({ email: "emp2-conflict@test.cz", passwordHash: empHash2, name: "Terapeut Druhý", role: "EMPLOYEE" }).returning().get();

    // Client tries to book at same time with different employee
    const res = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId: emp2.id, serviceId, startTime: conflictStart, endTime: conflictEnd, price: 1200 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("CONFLICT");
    expect(res.json().message).toBe("Klient má v tomto čase jiný termín");
  });

  it("cancelled appointment doesn't cause conflict", async () => {
    // Create an appointment and cancel it
    const cancelStart = new Date(future.getFullYear(), future.getMonth(), future.getDate(), 16, 0, 0).toISOString();
    const cancelEnd = new Date(future.getFullYear(), future.getMonth(), future.getDate(), 17, 0, 0).toISOString();

    const empHash3 = await hashPassword("Emp3333!");
    const emp3 = db.insert(users).values({ email: "emp3-conflict@test.cz", passwordHash: empHash3, name: "Terapeut Třetí", role: "EMPLOYEE" }).returning().get();
    const clientHash3 = await hashPassword("Cli3333!");
    const cli3 = db.insert(users).values({ email: "cli3-conflict@test.cz", passwordHash: clientHash3, name: "Klient Třetí", role: "CLIENT" }).returning().get();

    const res1 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli3.id, employeeId: emp3.id, serviceId, startTime: cancelStart, endTime: cancelEnd, price: 1200 },
    });
    expect(res1.statusCode).toBe(201);
    const apptId = res1.json().id;

    // Cancel it
    await app.inject({
      method: "PATCH",
      url: `/appointments/${apptId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { status: "CANCELLED" },
    });

    // Should be able to book same slot again
    const res2 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli3.id, employeeId: emp3.id, serviceId, startTime: cancelStart, endTime: cancelEnd, price: 1200 },
    });
    expect(res2.statusCode).toBe(201);
  });

  it("non-overlapping appointments don't conflict", async () => {
    const empHash4 = await hashPassword("Emp4444!");
    const emp4 = db.insert(users).values({ email: "emp4-conflict@test.cz", passwordHash: empHash4, name: "Terapeut Čtvrtý", role: "EMPLOYEE" }).returning().get();
    const clientHash4 = await hashPassword("Cli4444!");
    const cli4 = db.insert(users).values({ email: "cli4-conflict@test.cz", passwordHash: clientHash4, name: "Klient Čtvrtý", role: "CLIENT" }).returning().get();

    const slot1Start = new Date(future.getFullYear(), future.getMonth(), future.getDate() + 1, 9, 0, 0).toISOString();
    const slot1End = new Date(future.getFullYear(), future.getMonth(), future.getDate() + 1, 10, 0, 0).toISOString();
    const slot2Start = new Date(future.getFullYear(), future.getMonth(), future.getDate() + 1, 10, 0, 0).toISOString();
    const slot2End = new Date(future.getFullYear(), future.getMonth(), future.getDate() + 1, 11, 0, 0).toISOString();

    const res1 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli4.id, employeeId: emp4.id, serviceId, startTime: slot1Start, endTime: slot1End, price: 1200 },
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli4.id, employeeId: emp4.id, serviceId, startTime: slot2Start, endTime: slot2End, price: 1200 },
    });
    expect(res2.statusCode).toBe(201);
  });

  it("exact boundary (one ends when other starts) doesn't conflict", async () => {
    const empHash5 = await hashPassword("Emp5555!");
    const emp5 = db.insert(users).values({ email: "emp5-conflict@test.cz", passwordHash: empHash5, name: "Terapeut Pátý", role: "EMPLOYEE" }).returning().get();
    const clientHash5 = await hashPassword("Cli5555!");
    const cli5 = db.insert(users).values({ email: "cli5-conflict@test.cz", passwordHash: clientHash5, name: "Klient Pátý", role: "CLIENT" }).returning().get();

    const day = future.getDate() + 2;
    const s1 = new Date(future.getFullYear(), future.getMonth(), day, 9, 0, 0).toISOString();
    const e1 = new Date(future.getFullYear(), future.getMonth(), day, 10, 0, 0).toISOString();
    const s2 = new Date(future.getFullYear(), future.getMonth(), day, 10, 0, 0).toISOString();
    const e2 = new Date(future.getFullYear(), future.getMonth(), day, 11, 0, 0).toISOString();

    const res1 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli5.id, employeeId: emp5.id, serviceId, startTime: s1, endTime: e1, price: 1200 },
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli5.id, employeeId: emp5.id, serviceId, startTime: s2, endTime: e2, price: 1200 },
    });
    expect(res2.statusCode).toBe(201);
  });

  it("availability endpoint requires employeeId and date", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/appointments/availability",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBeTruthy();
  });

  it("availability endpoint returns booked slots", async () => {
    const empHash6 = await hashPassword("Emp6666!");
    const emp6 = db.insert(users).values({ email: "emp6-avail@test.cz", passwordHash: empHash6, name: "Terapeut Šestý", role: "EMPLOYEE" }).returning().get();
    const clientHash6 = await hashPassword("Cli6666!");
    const cli6 = db.insert(users).values({ email: "cli6-avail@test.cz", passwordHash: clientHash6, name: "Klient Šestý", role: "CLIENT" }).returning().get();

    // Use a fixed future date: 2026-04-06 (Monday, dayOfWeek=1)
    const dateStr = "2026-04-06";
    const dayOfWeek = new Date("2026-04-06T12:00:00").getDay(); // should be 1 (Monday)
    rawSqlite.prepare("INSERT INTO working_hours (employee_id, day_of_week, start_time, end_time, is_active) VALUES (?, ?, ?, ?, 1)").run(emp6.id, dayOfWeek, "09:00", "17:00");

    // Create appointment for that employee on that date
    const bookedStart = `${dateStr}T09:00:00.000Z`;
    const bookedEnd = `${dateStr}T10:00:00.000Z`;
    const apptRes = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId: cli6.id, employeeId: emp6.id, serviceId, startTime: bookedStart, endTime: bookedEnd, price: 1200 },
    });
    expect(apptRes.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: `/appointments/availability?employeeId=${emp6.id}&date=${dateStr}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().booked).toBeDefined();
    expect(res.json().available).toBeDefined();
    // Should have booked slots
    expect(res.json().booked.length).toBeGreaterThan(0);
  });

  it("availability endpoint returns available slots", async () => {
    const empHash7 = await hashPassword("Emp7777!");
    const emp7 = db.insert(users).values({ email: "emp7-avail@test.cz", passwordHash: empHash7, name: "Terapeut Sedmý", role: "EMPLOYEE" }).returning().get();

    // Use a fixed future date: 2026-04-07 (Tuesday, dayOfWeek=2)
    const dateStr = "2026-04-07";
    const dayOfWeek = new Date("2026-04-07T12:00:00").getDay(); // should be 2 (Tuesday)
    rawSqlite.prepare("INSERT INTO working_hours (employee_id, day_of_week, start_time, end_time, is_active) VALUES (?, ?, ?, ?, 1)").run(emp7.id, dayOfWeek, "09:00", "12:00");

    const res = await app.inject({
      method: "GET",
      url: `/appointments/availability?employeeId=${emp7.id}&date=${dateStr}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().available.length).toBeGreaterThan(0);
    expect(res.json().booked.length).toBe(0);
  });
});

describe("CLIENT self-cancel policy (system_settings + API)", () => {
  /** Nesplývající sloty (posun o 3 h / volání) — stejný klient jako v celém souboru. */
  let policySlotIdx = 0;

  function slotHoursFromNow(hoursUntilDesired: number) {
    policySlotIdx += 1;
    const totalHours = hoursUntilDesired + policySlotIdx * 3;
    const start = new Date(Date.now() + totalHours * 3600 * 1000);
    const end = new Date(start.getTime() + 3600 * 1000);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  afterEach(() => {
    rawSqlite
      .prepare(
        "DELETE FROM system_settings WHERE key IN ('clientSelfCancelAllowed','clientSelfCancelMinHours','clientSelfCancelLateReasonHours')"
      )
      .run();
  });

  it("POST /appointments/:id/cancel returns 403 when inside default 48h window (no settings rows)", async () => {
    const { startTime, endTime } = slotHoursFromNow(36);
    const cre = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 500 },
    });
    expect(cre.statusCode).toBe(201);
    const id = cre.json().id as number;

    const cancel = await app.inject({
      method: "POST",
      url: `/appointments/${id}/cancel`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(403);
  });

  it("POST /appointments/:id/cancel returns 403 when less than minHours before start", async () => {
    rawSqlite
      .prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelMinHours', '48', datetime('now'))")
      .run();
    rawSqlite
      .prepare(
        "INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelLateReasonHours', '24', datetime('now'))"
      )
      .run();

    const { startTime, endTime } = slotHoursFromNow(36);
    const cre = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 500 },
    });
    expect(cre.statusCode).toBe(201);
    const id = cre.json().id as number;

    const cancel = await app.inject({
      method: "POST",
      url: `/appointments/${id}/cancel`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(403);
    expect(String(cancel.json().error)).toMatch(/48|online|recepce/i);
  });

  it("POST /appointments/:id/cancel succeeds when beyond minHours", async () => {
    rawSqlite
      .prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelMinHours', '48', datetime('now'))")
      .run();

    const { startTime, endTime } = slotHoursFromNow(72);
    const cre = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 500 },
    });
    expect(cre.statusCode).toBe(201);
    const id = cre.json().id as number;

    const cancel = await app.inject({
      method: "POST",
      url: `/appointments/${id}/cancel`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().ok).toBe(true);
  });

  it("POST /appointments/:id/cancel returns 403 when clientSelfCancelAllowed is false", async () => {
    rawSqlite
      .prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelAllowed', 'false', datetime('now'))")
      .run();

    const { startTime, endTime } = slotHoursFromNow(96);
    const cre = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 500 },
    });
    expect(cre.statusCode).toBe(201);
    const id = cre.json().id as number;

    const cancel = await app.inject({
      method: "POST",
      url: `/appointments/${id}/cancel`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {},
    });
    expect(cancel.statusCode).toBe(403);
  });

  it("PATCH /appointments/:id with status CANCELLED enforces same minHours for CLIENT", async () => {
    rawSqlite
      .prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelMinHours', '48', datetime('now'))")
      .run();

    const { startTime, endTime } = slotHoursFromNow(30);
    const cre = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 500 },
    });
    expect(cre.statusCode).toBe(201);
    const id = cre.json().id as number;

    const patch = await app.inject({
      method: "PATCH",
      url: `/appointments/${id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { status: "CANCELLED" },
    });
    expect(patch.statusCode).toBe(403);
  });

  it("PATCH client cancel requires long reason inside lateReasonWithinHours window", async () => {
    rawSqlite
      .prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelMinHours', '0', datetime('now'))")
      .run();
    rawSqlite
      .prepare(
        "INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelLateReasonHours', '72', datetime('now'))"
      )
      .run();

    const { startTime, endTime } = slotHoursFromNow(48);
    const cre = await app.inject({
      method: "POST",
      url: "/appointments",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, employeeId, serviceId, startTime, endTime, price: 500 },
    });
    expect(cre.statusCode).toBe(201);
    const id = cre.json().id as number;

    const bad = await app.inject({
      method: "PATCH",
      url: `/appointments/${id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { status: "CANCELLED" },
    });
    expect(bad.statusCode).toBe(400);

    const good = await app.inject({
      method: "PATCH",
      url: `/appointments/${id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { status: "CANCELLED", cancellationReason: "akutní zdravotní indispozice delší popis" },
    });
    expect(good.statusCode).toBe(200);
  });

  it("GET /system-settings/public exposes cancel policy keys for clients", async () => {
    rawSqlite
      .prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('clientSelfCancelMinHours', '48', datetime('now'))")
      .run();
    const res = await app.inject({
      method: "GET",
      url: "/system-settings/public",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const j = res.json() as Record<string, string>;
    expect(j.clientSelfCancelMinHours).toBe("48");
  });
});
