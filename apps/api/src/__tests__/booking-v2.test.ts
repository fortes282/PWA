/**
 * Booking v2 tests — open slots, bookings, work schedule
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, creditTransactions } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";
import { FULL_MIGRATION_SQL } from "./helpers/setup.js";

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let clientToken: string;
let employeeId: number;
let clientId: number;
let serviceId: number;

beforeAll(async () => {
  rawSqlite.pragma("foreign_keys = ON");
  rawSqlite.exec(FULL_MIGRATION_SQL);

  app = await buildApp({ logger: false });
  await app.ready();

  const ts = Date.now();

  const admR = db.insert(users).values({ email: `bv2-admin-${ts}@test.cz`, passwordHash: hashPassword("Admin123!"), name: "BV2 Admin", role: "ADMIN" }).returning({ id: users.id }).get();
  const recR = db.insert(users).values({ email: `bv2-rec-${ts}@test.cz`, passwordHash: hashPassword("Recepce123!"), name: "BV2 Reception", role: "RECEPTION" }).returning({ id: users.id }).get();
  const empR = db.insert(users).values({ email: `bv2-emp-${ts}@test.cz`, passwordHash: hashPassword("Terapeut123!"), name: "BV2 Employee", role: "EMPLOYEE" }).returning({ id: users.id }).get();
  const cliR = db.insert(users).values({ email: `bv2-client-${ts}@test.cz`, passwordHash: hashPassword("Klient123!"), name: "BV2 Klient", role: "CLIENT" }).returning({ id: users.id }).get();

  employeeId = empR.id;
  clientId = cliR.id;

  const svcR = db.insert(services).values({ name: "BV2 Terapie", durationMin: 60, price: 1000 }).returning({ id: services.id }).get();
  serviceId = svcR.id;

  // Give client credits
  rawSqlite.prepare("INSERT INTO credit_transactions (user_id, type, amount, balance, note) VALUES (?, 'PURCHASE', 5000, 5000, 'Test credit')").run(clientId);

  const getToken = async (email: string, pass: string) => {
    const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: pass } });
    return r.json<{ accessToken: string }>().accessToken;
  };
  adminToken = await getToken(`bv2-admin-${ts}@test.cz`, "Admin123!");
  receptionToken = await getToken(`bv2-rec-${ts}@test.cz`, "Recepce123!");
  clientToken = await getToken(`bv2-client-${ts}@test.cz`, "Klient123!");

  void admR.id; void recR.id;
});

afterAll(async () => { await app.close(); });

// ─── Work schedule ────────────────────────────────────────────────────────────

describe("PUT /work-schedule/:employeeId", () => {
  it("RECEPTION saves work schedule for employee", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/work-schedule/${employeeId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: [
        { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 4, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 5, startTime: "08:00", endTime: "16:00" },
      ],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; updated: number }>();
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(5);
  });

  it("CLIENT cannot set work schedule → 403", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/work-schedule/${employeeId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /work-schedule/:employeeId", () => {
  it("RECEPTION can see work schedule", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/work-schedule/${employeeId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─── Open slots ───────────────────────────────────────────────────────────────

describe("POST /slots/open", () => {
  it("RECEPTION opens slots from work schedule", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

    const res = await app.inject({
      method: "POST",
      url: "/slots/open",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { employeeId, from: today, to: nextWeek },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ preview: number; created: number; skipped: number }>();
    expect(typeof body.created).toBe("number");
    expect(body.created).toBeGreaterThanOrEqual(0);
  });

  it("missing from/to → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/slots/open",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { employeeId },
    });
    expect(res.statusCode).toBe(400);
  });

  it("CLIENT cannot open slots → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/slots/open",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { employeeId, from: "2026-06-01", to: "2026-06-07" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── Available slots ──────────────────────────────────────────────────────────

describe("GET /slots/available", () => {
  it("returns open slots for a date", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await app.inject({
      method: "GET",
      url: `/slots/available?date=${today}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
  });

  it("missing date → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/slots/available",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Bookings v2 ─────────────────────────────────────────────────────────────

describe("POST /bookings-v2", () => {
  let openSlotId: number;

  beforeAll(() => {
    // Ručně vložit open slot pro testování
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const result = rawSqlite.prepare(
      "INSERT INTO open_slots (employee_id, date, time, status) VALUES (?, ?, '10:00', 'open')"
    ).run(employeeId, tomorrow);
    openSlotId = Number(result.lastInsertRowid);
  });

  it("CLIENT books open slot — slot status changes to booked", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bookings-v2",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { slotId: openSlotId, serviceId },
    });
    // May be 200 or 201
    expect([200, 201]).toContain(res.statusCode);

    // Slot must be booked now
    const slot = rawSqlite.prepare("SELECT status FROM open_slots WHERE id = ?").get(openSlotId) as { status: string };
    expect(slot.status).toBe("booked");
  });

  it("same slot cannot be booked again → 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bookings-v2",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { slotId: openSlotId, serviceId },
    });
    expect(res.statusCode).toBe(409);
  });

  it("non-existent slot → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/bookings-v2",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { slotId: 999999, serviceId },
    });
    expect(res.statusCode).toBe(404);
  });

  it("EMPLOYEE cannot book → 403", async () => {
    // Create another open slot
    const d = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    const r = rawSqlite.prepare("INSERT INTO open_slots (employee_id, date, time, status) VALUES (?, ?, '11:00', 'open')").run(employeeId, d);
    const newSlotId = Number(r.lastInsertRowid);

    const ts2 = Date.now() + 1;
    db.insert(users).values({ email: `bv2-emp2-${ts2}@test.cz`, passwordHash: hashPassword("Terapeut123!"), name: "BV2 Emp2", role: "EMPLOYEE" }).run();
    const empLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: `bv2-emp2-${ts2}@test.cz`, password: "Terapeut123!" } });
    const empToken2 = empLogin.json<{ accessToken: string }>().accessToken;

    const res = await app.inject({
      method: "POST",
      url: "/bookings-v2",
      headers: { authorization: `Bearer ${empToken2}` },
      payload: { slotId: newSlotId, serviceId },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── My bookings ──────────────────────────────────────────────────────────────

describe("GET /bookings-v2/my", () => {
  it("CLIENT sees own bookings", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/bookings-v2/my",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─── Slots calendar ───────────────────────────────────────────────────────────

describe("GET /slots/months", () => {
  it("returns monthly slot data", async () => {
    const now = new Date();
    const res = await app.inject({
      method: "GET",
      url: `/slots/months?year=${now.getFullYear()}&month=${now.getMonth() + 1}&employeeId=${employeeId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
  });

  it("missing year/month → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/slots/months",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Time off v2 ──────────────────────────────────────────────────────────────

describe("POST /time-off-v2", () => {
  it("RECEPTION creates time off for employee", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/time-off-v2",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { employeeId, dateFrom: "2027-01-10", dateTo: "2027-01-14", type: "vacation", note: "Dovolená" },
    });
    expect([200, 201]).toContain(res.statusCode);
    const body = res.json<Record<string, unknown>>();
    // Route returns { ok: true, timeOffId, slotsAffected, bookingsAffected } or similar
    expect(body.error).toBeUndefined();
    expect(body.ok === true || typeof body.timeOffId === "number" || Object.keys(body).length > 0).toBe(true);
  });

  it("dateFrom > dateTo → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/time-off-v2",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { employeeId, dateFrom: "2027-01-20", dateTo: "2027-01-10" },
    });
    expect(res.statusCode).toBe(400);
  });
});
