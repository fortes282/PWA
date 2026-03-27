/**
 * Corporate — B2B Corporate Wellness
 * Companies, company employees, and credit management.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

function ensureCorporateTables() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ico TEXT,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      address TEXT,
      credit_balance INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS company_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_company_employees_company ON company_employees(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_employees_user ON company_employees(user_id);
  `);
}

const corporateRoutes: FastifyPluginAsync = async (fastify) => {
  ensureCorporateTables();

  // GET /corporate/companies — list all companies (ADMIN)
  fastify.get("/corporate/companies", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const rows = rawSqlite.prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM company_employees ce WHERE ce.company_id = c.id) as employee_count
       FROM companies c
       WHERE c.is_active = 1
       ORDER BY c.name ASC`
    ).all();
    return rows;
  });

  // POST /corporate/companies — create company (ADMIN)
  fastify.post("/corporate/companies", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as any;
    const { name, ico, contactEmail, contactPhone, address, notes } = body;

    if (!name || !contactEmail) {
      return reply.code(400).send({ error: "name and contactEmail are required" });
    }

    const result = rawSqlite.prepare(
      `INSERT INTO companies (name, ico, contact_email, contact_phone, address, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).get(name, ico || null, contactEmail, contactPhone || null, address || null, notes || null);

    return reply.code(201).send(result);
  });

  // GET /corporate/companies/:id — detail with employees (ADMIN)
  fastify.get<{ Params: { id: string } }>("/corporate/companies/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const id = parseInt(request.params.id);
    const company = rawSqlite.prepare(
      "SELECT * FROM companies WHERE id = ? AND is_active = 1"
    ).get(id) as any;

    if (!company) return reply.code(404).send({ error: "Company not found" });

    const employees = rawSqlite.prepare(
      `SELECT ce.id, ce.role, ce.joined_at, u.id as user_id, u.name, u.email
       FROM company_employees ce
       JOIN users u ON u.id = ce.user_id
       WHERE ce.company_id = ?
       ORDER BY u.name ASC`
    ).all(id);

    return { ...company, employees };
  });

  // PATCH /corporate/companies/:id — update company (ADMIN)
  fastify.patch<{ Params: { id: string } }>("/corporate/companies/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const id = parseInt(request.params.id);
    const existing = rawSqlite.prepare("SELECT * FROM companies WHERE id = ?").get(id);
    if (!existing) return reply.code(404).send({ error: "Company not found" });

    const body = request.body as any;
    const updates: string[] = [];
    const values: any[] = [];

    for (const [jsKey, dbKey] of [
      ["name", "name"], ["ico", "ico"], ["contactEmail", "contact_email"],
      ["contactPhone", "contact_phone"], ["address", "address"], ["notes", "notes"],
      ["isActive", "is_active"],
    ] as const) {
      if (body[jsKey] !== undefined) {
        updates.push(`${dbKey} = ?`);
        values.push(body[jsKey]);
      }
    }

    if (updates.length === 0) return reply.code(400).send({ error: "No fields to update" });

    values.push(id);
    const row = rawSqlite.prepare(
      `UPDATE companies SET ${updates.join(", ")} WHERE id = ? RETURNING *`
    ).get(...values);

    return row;
  });

  // POST /corporate/companies/:id/employees — add user to company (ADMIN)
  fastify.post<{ Params: { id: string } }>("/corporate/companies/:id/employees", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const companyId = parseInt(request.params.id);
    const company = rawSqlite.prepare("SELECT id FROM companies WHERE id = ? AND is_active = 1").get(companyId);
    if (!company) return reply.code(404).send({ error: "Company not found" });

    const body = request.body as any;
    const { userId, role: empRole } = body;

    if (!userId || !empRole) {
      return reply.code(400).send({ error: "userId and role are required" });
    }

    // Check user exists
    const user = rawSqlite.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) return reply.code(404).send({ error: "User not found" });

    // Check not already in this company
    const existing = rawSqlite.prepare(
      "SELECT id FROM company_employees WHERE company_id = ? AND user_id = ?"
    ).get(companyId, userId);
    if (existing) return reply.code(409).send({ error: "User already belongs to this company" });

    const now = new Date().toISOString();
    const result = rawSqlite.prepare(
      `INSERT INTO company_employees (company_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)
       RETURNING *`
    ).get(companyId, userId, empRole, now);

    return reply.code(201).send(result);
  });

  // DELETE /corporate/companies/:companyId/employees/:userId — remove user (ADMIN)
  fastify.delete<{ Params: { companyId: string; userId: string } }>(
    "/corporate/companies/:companyId/employees/:userId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

      const companyId = parseInt(request.params.companyId);
      const userId = parseInt(request.params.userId);

      const existing = rawSqlite.prepare(
        "SELECT id FROM company_employees WHERE company_id = ? AND user_id = ?"
      ).get(companyId, userId);
      if (!existing) return reply.code(404).send({ error: "Employee not found in company" });

      rawSqlite.prepare(
        "DELETE FROM company_employees WHERE company_id = ? AND user_id = ?"
      ).run(companyId, userId);

      return { success: true };
    }
  );

  // POST /corporate/companies/:id/credit — add credits to company (ADMIN)
  fastify.post<{ Params: { id: string } }>("/corporate/companies/:id/credit", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const companyId = parseInt(request.params.id);
    const company = rawSqlite.prepare("SELECT * FROM companies WHERE id = ? AND is_active = 1").get(companyId) as any;
    if (!company) return reply.code(404).send({ error: "Company not found" });

    const { amount, note } = request.body as any;
    if (amount === undefined || typeof amount !== "number") {
      return reply.code(400).send({ error: "amount (number) is required" });
    }

    const newBalance = company.credit_balance + amount;
    rawSqlite.prepare(
      "UPDATE companies SET credit_balance = ? WHERE id = ?"
    ).run(newBalance, companyId);

    return { companyId, previousBalance: company.credit_balance, added: amount, newBalance, note: note || null };
  });
};

export default corporateRoutes;
