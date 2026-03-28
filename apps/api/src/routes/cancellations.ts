import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

/**
 * Unjustified cancellation records — tracks clients who cancel without valid reason.
 * Linked to appointments via appointmentId; also updates appointment status.
 */
const cancellationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure table exists
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS cancellations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT,
      is_unjustified INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // GET /cancellations — ADMIN/RECEPTION: list all, with pagination, filter by ?clientId=
  fastify.get("/cancellations", async (request, reply) => {
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
      conditions.push("c.client_id = ?");
      params.push(parseInt(q.clientId));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = (rawSqlite.prepare(`
      SELECT COUNT(*) as n FROM cancellations c ${where}
    `).get(...params) as any).n;

    const rows = rawSqlite.prepare(`
      SELECT
        c.id,
        c.appointment_id AS appointmentId,
        c.client_id AS clientId,
        u.name AS clientName,
        c.reason,
        c.is_unjustified AS isUnjustified,
        c.created_by AS createdBy,
        c.created_at AS createdAt,
        a.start_time AS appointmentStartTime,
        s.name AS serviceName
      FROM cancellations c
      JOIN users u ON u.id = c.client_id
      JOIN appointments a ON a.id = c.appointment_id
      LEFT JOIN services s ON s.id = a.service_id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      items: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit), hasMore: offset + limit < total },
    };
  });

  // GET /cancellations/client/:clientId — ADMIN/RECEPTION/EMPLOYEE: history for specific client
  fastify.get<{ Params: { clientId: string } }>(
    "/cancellations/client/:clientId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const clientId = parseInt(request.params.clientId);
      const rows = rawSqlite.prepare(`
        SELECT
          c.id,
          c.appointment_id AS appointmentId,
          c.client_id AS clientId,
          c.reason,
          c.is_unjustified AS isUnjustified,
          c.created_at AS createdAt,
          a.start_time AS appointmentStartTime,
          s.name AS serviceName
        FROM cancellations c
        JOIN appointments a ON a.id = c.appointment_id
        LEFT JOIN services s ON s.id = a.service_id
        WHERE c.client_id = ?
        ORDER BY c.created_at DESC
      `).all(clientId);

      return rows;
    }
  );

  // POST /cancellations — ADMIN/RECEPTION: create cancellation record
  // Body: { appointmentId, clientId, reason?, isUnjustified: true }
  fastify.post("/cancellations", async (request, reply) => {
    const { role, id: createdBy } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      appointmentId: number;
      clientId: number;
      reason?: string;
      isUnjustified: boolean;
    };

    if (!body.appointmentId || !body.clientId) {
      return reply.code(400).send({ error: "appointmentId and clientId are required" });
    }

    // Verify appointment exists
    const appointment = rawSqlite.prepare(
      "SELECT id, status FROM appointments WHERE id = ?"
    ).get(body.appointmentId) as any;

    if (!appointment) {
      return reply.code(404).send({ error: "Appointment not found" });
    }

    const result = rawSqlite.transaction(() => {
      // Insert cancellation record
      const info = rawSqlite.prepare(`
        INSERT INTO cancellations (appointment_id, client_id, reason, is_unjustified, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        body.appointmentId,
        body.clientId,
        body.reason ?? null,
        body.isUnjustified ? 1 : 0,
        createdBy,
      );

      // Update appointment status to UNJUSTIFIED_CANCEL
      if (body.isUnjustified) {
        rawSqlite.prepare(
          "UPDATE appointments SET status = 'UNJUSTIFIED_CANCEL', cancellation_reason = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(body.reason ?? null, body.appointmentId);
      }

      return rawSqlite.prepare("SELECT * FROM cancellations WHERE id = ?").get(info.lastInsertRowid);
    })();

    return reply.code(201).send(result);
  });
};

export default cancellationsRoutes;
