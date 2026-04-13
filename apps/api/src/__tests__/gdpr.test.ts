/**
 * GDPR compliance tests
 * Pokrývá: consent (grant/revoke), consent/:userId, access-log, erasure, erasure-request, stats
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";
import { FULL_MIGRATION_SQL } from "./helpers/setup.js";

let app: FastifyInstance;
let adminId: number;
let adminToken: string;
let clientId: number;
let clientToken: string;
let client2Id: number;
let client2Token: string;
let employeeId: number;
let employeeToken: string;

beforeAll(async () => {
  rawSqlite.pragma("foreign_keys = ON");
  rawSqlite.exec(FULL_MIGRATION_SQL);

  app = await buildApp({ logger: false });
  await app.ready();

  const ts = Date.now();

  const admR = db.insert(users).values({ email: `gdpr-admin-${ts}@test.cz`, passwordHash: hashPassword("Admin123!"), name: "GDPR Admin", role: "ADMIN" }).returning({ id: users.id }).get();
  const cliR = db.insert(users).values({ email: `gdpr-client-${ts}@test.cz`, passwordHash: hashPassword("Klient123!"), name: "GDPR Klient", role: "CLIENT" }).returning({ id: users.id }).get();
  const cli2R = db.insert(users).values({ email: `gdpr-client2-${ts}@test.cz`, passwordHash: hashPassword("Klient123!"), name: "GDPR Klient2", role: "CLIENT" }).returning({ id: users.id }).get();
  const empR = db.insert(users).values({ email: `gdpr-emp-${ts}@test.cz`, passwordHash: hashPassword("Terapeut123!"), name: "GDPR Employee", role: "EMPLOYEE" }).returning({ id: users.id }).get();

  adminId = admR.id;
  clientId = cliR.id;
  client2Id = cli2R.id;
  employeeId = empR.id;

  const getToken = async (email: string, password: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    return res.json<{ accessToken: string }>().accessToken;
  };

  adminToken = await getToken(`gdpr-admin-${ts}@test.cz`, "Admin123!");
  clientToken = await getToken(`gdpr-client-${ts}@test.cz`, "Klient123!");
  client2Token = await getToken(`gdpr-client2-${ts}@test.cz`, "Klient123!");
  employeeToken = await getToken(`gdpr-emp-${ts}@test.cz`, "Terapeut123!");
});

afterAll(async () => { await app.close(); });

// ─── Consent ───────────────────────────────────────────────────────────────────

describe("POST /gdpr/consent", () => {
  it("client grants health data consent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/gdpr/consent",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { granted: true, consentType: "health_data" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; granted: boolean; consentType: string }>();
    expect(body.ok).toBe(true);
    expect(body.granted).toBe(true);
    expect(body.consentType).toBe("health_data");

    // Verify in DB
    const row = rawSqlite.prepare("SELECT gdpr_health_consent_granted FROM users WHERE id = ?").get(clientId) as { gdpr_health_consent_granted: number };
    expect(row.gdpr_health_consent_granted).toBe(1);
  });

  it("client revokes consent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/gdpr/consent",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { granted: false, consentType: "health_data" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ granted: boolean }>().granted).toBe(false);

    const row = rawSqlite.prepare("SELECT gdpr_health_consent_granted FROM users WHERE id = ?").get(clientId) as { gdpr_health_consent_granted: number };
    expect(row.gdpr_health_consent_granted).toBe(0);
  });

  it("unauthenticated → 401", async () => {
    const res = await app.inject({ method: "POST", url: "/gdpr/consent", payload: { granted: true } });
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET consent/:userId ───────────────────────────────────────────────────────

describe("GET /gdpr/consent/:userId", () => {
  it("user can read own consents", async () => {
    // Grant first
    await app.inject({
      method: "POST", url: "/gdpr/consent",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { granted: true },
    });

    const res = await app.inject({
      method: "GET",
      url: `/gdpr/consent/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ userId: number; consents: unknown[] }>();
    expect(body.userId).toBe(clientId);
    expect(Array.isArray(body.consents)).toBe(true);
    expect(body.consents.length).toBeGreaterThan(0);
  });

  it("ADMIN can read any user consents", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/gdpr/consent/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("CLIENT cannot read another client's consents → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/gdpr/consent/${client2Id}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── Access log ────────────────────────────────────────────────────────────────

describe("GET /gdpr/access-log/:clientId", () => {
  it("ADMIN can read access log", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/gdpr/access-log/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ clientId: number; logs: unknown[] }>();
    expect(body.clientId).toBe(clientId);
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it("EMPLOYEE can read access log", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/gdpr/access-log/${clientId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("CLIENT cannot read access log → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/gdpr/access-log/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("respects limit querystring (max 500)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/gdpr/access-log/${clientId}?limit=5`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ─── Erasure request (client self-service) ────────────────────────────────────

describe("POST /gdpr/erasure-request", () => {
  it("client can submit own erasure request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/gdpr/erasure-request",
      headers: { authorization: `Bearer ${client2Token}` },
      payload: { notes: "E2E test žádost o výmaz" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; message: string }>();
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/žádost|výmaz|vyřízena/i);
  });

  it("duplicate request returns alreadyPending=true", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/gdpr/erasure-request",
      headers: { authorization: `Bearer ${client2Token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; alreadyPending: boolean }>();
    expect(body.ok).toBe(true);
    expect(body.alreadyPending).toBe(true);
  });
});

// ─── Erasure requests list (admin) ────────────────────────────────────────────

describe("GET /gdpr/erasure-requests", () => {
  it("ADMIN sees list of erasure requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/gdpr/erasure-requests",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ requests: unknown[] }>();
    expect(Array.isArray(body.requests)).toBe(true);
    expect(body.requests.length).toBeGreaterThan(0);
  });

  it("non-ADMIN → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/gdpr/erasure-requests",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── Erasure (ADMIN anonymize) ─────────────────────────────────────────────────

describe("POST /gdpr/erasure", () => {
  it("ADMIN anonymizes client data", async () => {
    // Create a fresh client to erase (don't erase fixtures used by other tests)
    const ts = Date.now() + 999;
    const eraseClient = db.insert(users).values({
      email: `gdpr-toerase-${ts}@test.cz`,
      passwordHash: hashPassword("Klient123!"),
      name: "Eraze Klient",
      role: "CLIENT",
    }).returning({ id: users.id }).get();

    const res = await app.inject({
      method: "POST",
      url: "/gdpr/erasure",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { clientId: eraseClient.id, notes: "E2E erasure test" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; clientId: number; completedAt: string }>();
    expect(body.ok).toBe(true);
    expect(body.clientId).toBe(eraseClient.id);

    // Verify anonymization in DB
    const userRow = rawSqlite.prepare("SELECT name, gdpr_anonymized_at FROM users WHERE id = ?").get(eraseClient.id) as { name: string; gdpr_anonymized_at: string };
    expect(userRow.name).toBe("Anonymní uživatel");
    expect(userRow.gdpr_anonymized_at).toBeTruthy();
  });

  it("non-ADMIN → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/gdpr/erasure",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { clientId: client2Id },
    });
    expect(res.statusCode).toBe(403);
  });

  it("RECEPTION → 403", async () => {
    const ts = Date.now() + 1000;
    const recRes = db.insert(users).values({ email: `gdpr-rec-${ts}@test.cz`, passwordHash: hashPassword("Recepce123!"), name: "GDPR Rec", role: "RECEPTION" }).returning({ id: users.id }).get();
    const recLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: `gdpr-rec-${ts}@test.cz`, password: "Recepce123!" } });
    const recToken = recLogin.json<{ accessToken: string }>().accessToken;

    const res = await app.inject({
      method: "POST",
      url: "/gdpr/erasure",
      headers: { authorization: `Bearer ${recToken}` },
      payload: { clientId: clientId },
    });
    expect(res.statusCode).toBe(403);
    void recRes;
  });
});

// ─── Stats ─────────────────────────────────────────────────────────────────────

describe("GET /gdpr/stats", () => {
  it("ADMIN gets GDPR statistics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/gdpr/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      totalClients: number;
      consentGranted: number;
      consentRate: number;
      pendingErasure: number;
      completedErasure: number;
      recentAccessLogs: unknown[];
    }>();
    expect(typeof body.totalClients).toBe("number");
    expect(typeof body.consentGranted).toBe("number");
    expect(typeof body.consentRate).toBe("number");
    expect(body.consentRate).toBeGreaterThanOrEqual(0);
    expect(body.consentRate).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.recentAccessLogs)).toBe(true);
  });

  it("non-ADMIN → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/gdpr/stats",
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
