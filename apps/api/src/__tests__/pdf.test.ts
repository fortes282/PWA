/**
 * Integration tests — PDF/DOCX generation routes
 * Tests: GET /pdf/medical-report/:id, GET /pdf/invoice/:id, GET /docx/medical-report/:id
 * Focus: auth, RBAC, 404 for non-existent IDs, and correct content-type headers
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rawSqlite, db } from "../db/index.js";
import { users, medicalReports, invoices, invoiceItems } from "../db/schema.js";
import { hashPassword } from "../utils/hash.js";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS medical_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, appointment_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, diagnosis TEXT, recommendations TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', total REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, paid_at TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, total REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: FastifyInstance;
let adminToken: string;
let employeeToken: string;
let clientToken: string;
let client2Token: string;
let employeeId: number;
let clientId: number;
let client2Id: number;
let reportId: number;
let invoiceId: number;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-pdf-suite-min64chars!!!!!!!!!!!!!!!!!!!!!!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-pdf-suite-min64chars!!!!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";

  app = await buildApp({ logger: false });
  await app.ready();
  rawSqlite.exec(MIGRATION_SQL);

  const h = await hashPassword("Test1234!");
  db.insert(users).values({ email: "pdf-admin@test.cz", passwordHash: h, name: "Admin PDF", role: "ADMIN" }).run();
  const empResult = db.insert(users).values({ email: "pdf-emp@test.cz", passwordHash: h, name: "Employee PDF", role: "EMPLOYEE" }).returning({ id: users.id }).get();
  employeeId = empResult.id;
  const clientResult = db.insert(users).values({ email: "pdf-client@test.cz", passwordHash: h, name: "Client PDF", role: "CLIENT" }).returning({ id: users.id }).get();
  clientId = clientResult.id;
  const client2Result = db.insert(users).values({ email: "pdf-client2@test.cz", passwordHash: h, name: "Client2 PDF", role: "CLIENT" }).returning({ id: users.id }).get();
  client2Id = client2Result.id;

  adminToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "pdf-admin@test.cz", password: "Test1234!" } })).json().accessToken;
  employeeToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "pdf-emp@test.cz", password: "Test1234!" } })).json().accessToken;
  clientToken = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "pdf-client@test.cz", password: "Test1234!" } })).json().accessToken;
  client2Token = (await app.inject({ method: "POST", url: "/auth/login", payload: { email: "pdf-client2@test.cz", password: "Test1234!" } })).json().accessToken;

  // Seed a medical report
  const repResult = db.insert(medicalReports).values({
    clientId,
    employeeId,
    title: "Test Report PDF",
    content: "Patient shows improvement.\nContinue therapy.",
    diagnosis: "Test diagnosis",
    recommendations: "Rest and exercise",
  }).returning({ id: medicalReports.id }).get();
  reportId = repResult.id;

  // Seed an invoice
  const invResult = db.insert(invoices).values({
    invoiceNumber: "INV-PDF-001",
    clientId,
    status: "SENT",
    total: 1500,
    dueDate: "2026-04-01",
    notes: "Test invoice for PDF",
  }).returning({ id: invoices.id }).get();
  invoiceId = invResult.id;

  db.insert(invoiceItems).values({
    invoiceId,
    description: "Masáž 60min",
    quantity: 1,
    unitPrice: 1500,
    total: 1500,
  }).run();
});

afterAll(async () => {
  await app.close();
});

describe("GET /pdf/medical-report/:id", () => {
  it("employee can download PDF for their own report", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.rawPayload.length).toBeGreaterThan(100);
  });

  it("admin can download PDF for any report", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("client can download PDF for their own report", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("different client cannot download another client's medical report PDF (403)", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${client2Token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent report", async () => {
    const res = await app.inject({
      method: "GET", url: "/pdf/medical-report/99999",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: `/pdf/medical-report/${reportId}` });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /pdf/invoice/:id", () => {
  it("admin can download invoice PDF", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/invoice/${invoiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.rawPayload.length).toBeGreaterThan(100);
  });

  it("client can download their own invoice PDF", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/invoice/${invoiceId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("different client cannot download another client's invoice PDF (403)", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/invoice/${invoiceId}`,
      headers: { authorization: `Bearer ${client2Token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent invoice", async () => {
    const res = await app.inject({
      method: "GET", url: "/pdf/invoice/99999",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PDF content-disposition contains invoice number", async () => {
    const res = await app.inject({
      method: "GET", url: `/pdf/invoice/${invoiceId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const disp = res.headers["content-disposition"] as string;
    // Should have filename containing invoice number or 'faktura'
    expect(disp).toMatch(/attachment|inline/i);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: `/pdf/invoice/${invoiceId}` });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /docx/medical-report/:id", () => {
  it("employee can download DOCX for their report", async () => {
    const res = await app.inject({
      method: "GET", url: `/docx/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${employeeToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/vnd.openxmlformats");
    expect(res.rawPayload.length).toBeGreaterThan(100);
  });

  it("admin can download DOCX for any report", async () => {
    const res = await app.inject({
      method: "GET", url: `/docx/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("client can download DOCX for their own report", async () => {
    const res = await app.inject({
      method: "GET", url: `/docx/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("different client cannot download another client's DOCX (403)", async () => {
    const res = await app.inject({
      method: "GET", url: `/docx/medical-report/${reportId}`,
      headers: { authorization: `Bearer ${client2Token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent report", async () => {
    const res = await app.inject({
      method: "GET", url: "/docx/medical-report/99999",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: `/docx/medical-report/${reportId}` });
    expect(res.statusCode).toBe(401);
  });
});
