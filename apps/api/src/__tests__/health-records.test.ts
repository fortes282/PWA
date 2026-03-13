/**
 * Integration tests for /health-records routes.
 * Uses in-memory SQLite (same pattern as auth.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users } from "../db/schema.js";
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
  CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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
    last_updated_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

let app: FastifyInstance;
let receptionToken: string;
let clientToken: string;
let clientId: number;
let receptionId: number;

beforeAll(async () => {
  rawSqlite.exec(MIGRATION_SQL);

  const [client] = await db.insert(users).values({
    email: "client-hr@test.com",
    passwordHash: await hashPassword("Test123!"),
    name: "Test Client",
    role: "CLIENT",
  }).returning();
  clientId = client.id;

  const [reception] = await db.insert(users).values({
    email: "reception-hr@test.com",
    passwordHash: await hashPassword("Test123!"),
    name: "Test Reception",
    role: "RECEPTION",
  }).returning();
  receptionId = reception.id;

  app = await buildApp();

  // Login reception
  const r1 = await app.inject({
    method: "POST",
    url: "/auth/login",
    body: { email: "reception-hr@test.com", password: "Test123!" },
  });
  receptionToken = r1.json().accessToken;

  // Login client
  const r2 = await app.inject({
    method: "POST",
    url: "/auth/login",
    body: { email: "client-hr@test.com", password: "Test123!" },
  });
  clientToken = r2.json().accessToken;
});

afterAll(async () => {
  await app.close();
});

describe("GET /health-records/:clientId — not found", () => {
  it("returns 404 when no record exists", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/health-records/${clientId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("CLIENT cannot access another client's record (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/health-records/${receptionId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PUT /health-records/:clientId — create", () => {
  it("RECEPTION can create a health record", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/health-records/${clientId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      body: {
        bloodType: "A+",
        allergies: "Penicilin",
        primaryDiagnosis: "CMP",
        emergencyContactName: "Jana Nováková",
        emergencyContactPhone: "+420 777 000 111",
        emergencyContactRelation: "Manželka",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.bloodType).toBe("A+");
    expect(body.allergies).toBe("Penicilin");
    expect(body.clientId).toBe(clientId);
  });

  it("CLIENT cannot create a health record (403)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/health-records/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      body: { bloodType: "B+" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /health-records/:clientId — fetch existing", () => {
  it("returns the record after creation", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/health-records/${clientId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bloodType).toBe("A+");
    expect(body.primaryDiagnosis).toBe("CMP");
  });

  it("CLIENT can access their own record", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/health-records/${clientId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("PUT /health-records/:clientId — update (upsert)", () => {
  it("RECEPTION can update an existing record", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/health-records/${clientId}`,
      headers: { authorization: `Bearer ${receptionToken}` },
      body: {
        bloodType: "A+",
        allergies: "Penicilin, Aspirin",
        primaryDiagnosis: "CMP stadium II",
        rehabGoals: "Obnova chůze a jemné motoriky",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.allergies).toBe("Penicilin, Aspirin");
    expect(body.rehabGoals).toBe("Obnova chůze a jemné motoriky");
  });
});

describe("GET /health-records — list all (RECEPTION only)", () => {
  it("RECEPTION gets a list of all records", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health-records",
      headers: { authorization: `Bearer ${receptionToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("CLIENT cannot list all records (403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health-records",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
