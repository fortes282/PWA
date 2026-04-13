/**
 * Cancellations tests
 * Pokrývá: GET /cancellations, GET /cancellations/client/:id, POST /cancellations
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, services, appointments } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";
import { FULL_MIGRATION_SQL } from "./helpers/setup.js";

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let employeeToken: string;
let clientToken: string;
let clientId: number;
let employeeId: number;
let serviceId: number;
let appointmentId: number;
let appointment2Id: number;

beforeAll(async () => {
  rawSqlite.pragma("foreign_keys = ON");
  rawSqlite.exec(FULL_MIGRATION_SQL);

  app = await buildApp({ logger: false });
  await app.ready();

  const ts = Date.now();

  // Seed users
  const admR = db.insert(users).values({ email: `cancel-admin-${ts}@test.cz`, passwordHash: hashPassword("Admin123!"), name: "Cancel Admin", role: "ADMIN" }).returning({ id: users.id }).get();
  const recR = db.insert(users).values({ email: `cancel-rec-${ts}@test.cz`, passwordHash: hashPassword("Recepce123!"), name: "Cancel Rec", role: "RECEPTION" }).returning({ id: users.id }).get();
  const empR = db.insert(users).values({ email: `cancel-emp-${ts}@test.cz`, passwordHash: hashPassword("Terapeut123!"), name: "Cancel Emp", role: "EMPLOYEE" }).returning({ id: users.id }).get();
  const cliR = db.insert(users).values({ email: `cancel-client-${ts}@test.cz`, passwordHash: hashPassword("Klient123!"), name: "Cancel Klient", role: "CLIENT" }).returning({ id: users.id }).get();

  clientId = cliR.id;
  employeeId = empR.id;

  // Seed service
  const svcR = db.insert(services).values({ name: "Testovací služba", durationMin: 60, price: 1000 }).returning({ id: services.id }).get();
  serviceId = svcR.id;

  // Seed appointments
  const appt1R = db.insert(appointments).values({
    clientId: clientId,
    employeeId: employeeId,
    serviceId: serviceId,
    startTime: new Date(Date.now() + 3600_000).toISOString(),
    endTime: new Date(Date.now() + 7200_000).toISOString(),
    status: "CONFIRMED",
    price: 1000,
  }).returning({ id: appointments.id }).get();
  appointmentId = appt1R.id;

  const appt2R = db.insert(appointments).values({
    clientId: clientId,
    employeeId: employeeId,
    serviceId: serviceId,
    startTime: new Date(Date.now() + 7200_000).toISOString(),
    endTime: new Date(Date.now() + 10800_000).toISOString(),
    status: "CONFIRMED",
    price: 1000,
  }).returning({ id: appointments.id }).get();
  appointment2Id = appt2R.id;

  const getToken = async (email: string, password: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    return res.json<{ accessToken: string }>().accessToken;
  };

  adminToken = await getToken(`cancel-admin-${ts}@test.cz`, "Admin123!");
  receptionToken = await getToken(`cancel-rec-${ts}@test.cz`, "Recepce123!");
  employeeToken = await getToken(`cancel-emp-${ts}@test.cz`, "Terapeut123!");
  clientToken = await getToken(`cancel-client-${ts}@test.cz`, "Klient123!");

  void admR.id;
  void recR.id;
});

afterAll(async () => { await app.close(); });

// ─── POST /cancellations ───────────────────────────────────────────────────────

describe("POST /cancellations", () => {
  it("RECEPTION creates cancellation record → appointment becomes CANCELLED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cancellations",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: {
        appointmentId,
        clientId,
        reason: "Klient se omluvil",
        isUnjustified: false,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: number; appointment_id: number; client_id: number }>();
    expect(body.appointment_id).toBe(appointmentId);
    expect(body.client_id).toBe(clientId);

    // Verify appointment status changed to CANCELLED
    const appt = rawSqlite.prepare("SELECT status FROM appointments WHERE id = ?").get(appointmentId) as { status: string };
    expect(appt.status).toBe("CANCELLED");
  });

  it("ADMIN creates cancellation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cancellations",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        appointmentId: appointment2Id,
        clientId,
        isUnjustified: true,
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("CLIENT cannot create cancellation → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cancellations",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { appointmentId, clientId, isUnjustified: false },
    });
    expect(res.statusCode).toBe(403);
  });

  it("EMPLOYEE cannot create cancellation → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cancellations",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { appointmentId, clientId, isUnjustified: false },
    });
    expect(res.statusCode).toBe(403);
  });

  it("missing appointmentId → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cancellations",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { clientId, isUnjustified: false },
    });
    expect(res.statusCode).toBe(400);
  });

  it("non-existent appointmentId → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/cancellations",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { appointmentId: 999999, clientId, isUnjustified: false },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ─── GET /cancellations ────────────────────────────────────────────────────────

describe("GET /cancellations", () => {
  it("ADMIN sees paginated list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cancellations",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[]; pagination: { total: number; page: number; limit: number } }>();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it("RECEPTION can list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cancellations",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("CLIENT cannot list → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cancellations",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("EMPLOYEE cannot list → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cancellations",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("filter by clientId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/cancellations?clientId=${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: Array<{ clientId: number }> }>();
    body.items.forEach(item => expect(item.clientId).toBe(clientId));
  });

  it("pagination: page=1&limit=1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cancellations?page=1&limit=1",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[]; pagination: { limit: number; page: number; hasMore: boolean } }>();
    expect(body.items).toHaveLength(1);
    expect(body.pagination.limit).toBe(1);
    expect(body.pagination.page).toBe(1);
  });
});

// ─── GET /cancellations/client/:clientId ──────────────────────────────────────

describe("GET /cancellations/client/:clientId", () => {
  it("ADMIN sees client cancellation history", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/cancellations/client/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ clientId: number }>>();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("RECEPTION sees client history", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/cancellations/client/${clientId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("EMPLOYEE sees client history", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/cancellations/client/${clientId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("CLIENT cannot see history → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/cancellations/client/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
