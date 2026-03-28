import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

/**
 * FT (fyzioterapie) voucher management per client.
 * Tracks insurance-issued voucher allowances (units), usage, and remaining limits.
 * When an insurance claim is created, the caller can auto-deduct from the active voucher.
 */
const insuranceVouchersRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure table exists
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS ft_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      insurance_company_id INTEGER NOT NULL REFERENCES insurance_companies(id),
      voucher_number TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      used_units INTEGER NOT NULL DEFAULT 0,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // GET /insurance/ft-vouchers — ADMIN/RECEPTION: all vouchers, filterable by ?clientId=
  fastify.get("/insurance/ft-vouchers", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { clientId?: string; page?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "50"), 1), 200);
    const page = Math.max(parseInt(q.page ?? "1"), 1);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.clientId) {
      conditions.push("v.client_id = ?");
      params.push(parseInt(q.clientId));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = (rawSqlite.prepare(`
      SELECT COUNT(*) as n FROM ft_vouchers v ${where}
    `).get(...params) as any).n;

    const rows = rawSqlite.prepare(`
      SELECT
        v.id,
        v.client_id AS clientId,
        u.name AS clientName,
        v.insurance_company_id AS insuranceCompanyId,
        ic.name AS insuranceCompanyName,
        v.voucher_number AS voucherNumber,
        v.total_units AS totalUnits,
        v.used_units AS usedUnits,
        (v.total_units - v.used_units) AS remainingUnits,
        v.valid_from AS validFrom,
        v.valid_to AS validTo,
        v.notes,
        v.created_at AS createdAt,
        v.updated_at AS updatedAt
      FROM ft_vouchers v
      JOIN users u ON u.id = v.client_id
      JOIN insurance_companies ic ON ic.id = v.insurance_company_id
      ${where}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      items: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit), hasMore: offset + limit < total },
    };
  });

  // GET /insurance/ft-vouchers/:clientId — ADMIN/RECEPTION/EMPLOYEE: vouchers for client
  fastify.get<{ Params: { clientId: string } }>(
    "/insurance/ft-vouchers/:clientId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const clientId = parseInt(request.params.clientId);
      const rows = rawSqlite.prepare(`
        SELECT
          v.id,
          v.client_id AS clientId,
          v.insurance_company_id AS insuranceCompanyId,
          ic.name AS insuranceCompanyName,
          v.voucher_number AS voucherNumber,
          v.total_units AS totalUnits,
          v.used_units AS usedUnits,
          (v.total_units - v.used_units) AS remainingUnits,
          v.valid_from AS validFrom,
          v.valid_to AS validTo,
          v.notes,
          v.created_at AS createdAt,
          v.updated_at AS updatedAt
        FROM ft_vouchers v
        JOIN insurance_companies ic ON ic.id = v.insurance_company_id
        WHERE v.client_id = ?
        ORDER BY v.valid_to DESC
      `).all(clientId);

      return rows;
    }
  );

  // GET /insurance/ft-vouchers/:clientId/limits — summary: total units, used, remaining, active vouchers
  fastify.get<{ Params: { clientId: string } }>(
    "/insurance/ft-vouchers/:clientId/limits",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const clientId = parseInt(request.params.clientId);
      const today = new Date().toISOString().slice(0, 10);

      const summary = rawSqlite.prepare(`
        SELECT
          COALESCE(SUM(total_units), 0) AS totalUnits,
          COALESCE(SUM(used_units), 0) AS usedUnits,
          COALESCE(SUM(total_units - used_units), 0) AS remainingUnits,
          COUNT(*) AS activeVouchers
        FROM ft_vouchers
        WHERE client_id = ?
          AND valid_from <= ?
          AND valid_to >= ?
      `).get(clientId, today, today) as any;

      return {
        clientId,
        totalUnits: summary.totalUnits,
        usedUnits: summary.usedUnits,
        remainingUnits: summary.remainingUnits,
        activeVouchers: summary.activeVouchers,
      };
    }
  );

  // POST /insurance/ft-vouchers — ADMIN/RECEPTION: create voucher
  fastify.post("/insurance/ft-vouchers", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      clientId: number;
      insuranceCompanyId: number;
      voucherNumber: string;
      totalUnits: number;
      validFrom: string;
      validTo: string;
      notes?: string;
    };

    if (!body.clientId || !body.insuranceCompanyId || !body.voucherNumber || !body.totalUnits || !body.validFrom || !body.validTo) {
      return reply.code(400).send({ error: "clientId, insuranceCompanyId, voucherNumber, totalUnits, validFrom, and validTo are required" });
    }

    const info = rawSqlite.prepare(`
      INSERT INTO ft_vouchers (client_id, insurance_company_id, voucher_number, total_units, valid_from, valid_to, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.clientId,
      body.insuranceCompanyId,
      body.voucherNumber,
      body.totalUnits,
      body.validFrom,
      body.validTo,
      body.notes ?? null,
    );

    const created = rawSqlite.prepare("SELECT * FROM ft_vouchers WHERE id = ?").get(info.lastInsertRowid);
    return reply.code(201).send(created);
  });

  // PATCH /insurance/ft-vouchers/:id — ADMIN/RECEPTION: update (usedUnits, notes, validTo)
  fastify.patch<{ Params: { id: string } }>(
    "/insurance/ft-vouchers/:id",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const id = parseInt(request.params.id);
      const body = request.body as Partial<{
        usedUnits: number;
        notes: string;
        validTo: string;
      }>;

      const existing = rawSqlite.prepare("SELECT * FROM ft_vouchers WHERE id = ?").get(id) as any;
      if (!existing) {
        return reply.code(404).send({ error: "Voucher not found" });
      }

      const sets: string[] = [];
      const params: unknown[] = [];

      if (body.usedUnits !== undefined) {
        sets.push("used_units = ?");
        params.push(body.usedUnits);
      }
      if (body.notes !== undefined) {
        sets.push("notes = ?");
        params.push(body.notes);
      }
      if (body.validTo !== undefined) {
        sets.push("valid_to = ?");
        params.push(body.validTo);
      }

      if (sets.length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      sets.push("updated_at = datetime('now')");
      params.push(id);

      rawSqlite.prepare(`UPDATE ft_vouchers SET ${sets.join(", ")} WHERE id = ?`).run(...params);

      const updated = rawSqlite.prepare("SELECT * FROM ft_vouchers WHERE id = ?").get(id);
      return updated;
    }
  );
};

export default insuranceVouchersRoutes;
