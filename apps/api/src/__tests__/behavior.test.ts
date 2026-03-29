/**
 * Integration tests — /behavior routes
 * Tests: GET /behavior/:userId, POST /behavior/record, RBAC
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS behavior_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, points REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let adminToken: string;
let receptionToken: string;
let employeeToken: string;
let clientToken: string;
let clientId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-behavior-suite-min64chars!!!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-behavior-suite-min64chars!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  db.insert(users).values({ email: "beh-admin@test.cz", passwordHash: h, name: "Admin Beh", role: "ADMIN" }).run();
  db.insert(users).values({ email: "beh-rec@test.cz", passwordHash: h, name: "Reception Beh", role: "RECEPTION" }).run();
  db.insert(users).values({ email: "beh-emp@test.cz", passwordHash: h, name: "Employee Beh", role: "EMPLOYEE" }).run();
  const clientResult = db.insert(users).values({ email: "beh-client@test.cz", passwordHash: h, name: "Client Beh", role: "CLIENT" }).returning({ id: users.id }).get();
  clientId = clientResult.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "beh-admin@test.cz", password: "Test1234!" } })).json().accessToken;
  receptionToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "beh-rec@test.cz", password: "Test1234!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "beh-emp@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "beh-client@test.cz", password: "Test1234!" } })).json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /behavior/:userId", () => {
  it("admin can get behavior for any user", async () => {
    const res = await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe(clientId);
    expect(typeof body.score).toBe("number");
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("reception can get behavior", async () => {
    const res = await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().score).toBe(100); // default score
  });

  it("employee can get behavior", async () => {
    const res = await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client cannot get behavior (403)", async () => {
    const res = await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: `/behavior/${clientId}` });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /behavior/record", () => {
  it("admin can record a behavior event (ON_TIME +5)", async () => {
    const res = await app.inject({
      method: "POST", url: "/behavior/record",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, type: "ON_TIME", note: "Arrived early" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.event.type).toBe("ON_TIME");
    expect(body.event.points).toBe(5);
    expect(body.newScore).toBe(100); // already at 100, capped
  });

  it("reception can record LATE_CANCEL (-10)", async () => {
    const res = await app.inject({
      method: "POST", url: "/behavior/record",
      headers: { authorization: `Bearer ${receptionToken}` },
      payload: { userId: clientId, type: "LATE_CANCEL" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.event.points).toBe(-10);
    expect(body.newScore).toBeLessThanOrEqual(100);
    expect(body.newScore).toBeGreaterThanOrEqual(0);
  });

  it("employee can record LATE_CANCEL (-10)", async () => {
    const res = await app.inject({
      method: "POST", url: "/behavior/record",
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: { userId: clientId, type: "LATE_CANCEL", note: "Cancelled 2h before" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().event.points).toBe(-10);
  });

  it("client cannot record behavior events (403)", async () => {
    const res = await app.inject({
      method: "POST", url: "/behavior/record",
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { userId: clientId, type: "ON_TIME" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("score does not go below 0", async () => {
    // Record many LATE_CANCEL events to drive score to 0
    for (let i = 0; i < 12; i++) {
      await app.inject({
        method: "POST", url: "/behavior/record",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { userId: clientId, type: "LATE_CANCEL" },
      });
    }
    const res = await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.json().score).toBeGreaterThanOrEqual(0);
  });

  it("behavior events appear in GET after recording", async () => {
    const before = (await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })).json();
    const countBefore = before.events.length;

    await app.inject({
      method: "POST", url: "/behavior/record",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: clientId, type: "POSITIVE_FEEDBACK", note: "Great session" },
    });

    const after = (await app.inject({
      method: "GET", url: `/behavior/${clientId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })).json();
    expect(after.events.length).toBe(countBefore + 1);
    expect(after.events.some((e: any) => e.type === "POSITIVE_FEEDBACK")).toBe(true);
  });
});
