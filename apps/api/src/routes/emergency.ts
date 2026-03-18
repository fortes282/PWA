/**
 * Emergency (SOS) routes
 * GET  /emergency/contacts         — get emergency contacts (any authenticated user)
 * POST /emergency/sos              — log SOS activation + notify therapist/reception
 * GET  /emergency/sos-log          — ADMIN: get SOS activation log
 * POST /emergency/contacts         — ADMIN: add emergency contact
 * PUT  /emergency/contacts/:id     — ADMIN: update emergency contact
 * DELETE /emergency/contacts/:id   — ADMIN: delete emergency contact
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite, db } from "../db/index.js";
import { logAudit } from "./audit.js";

const emergencyRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /emergency/contacts — accessible by any authenticated user
  fastify.get("/emergency/contacts", async () => {
    const contacts = rawSqlite.prepare(
      `SELECT id, name, phone, description, sort_order FROM emergency_contacts WHERE is_active = 1 ORDER BY sort_order ASC`
    ).all();
    return { contacts };
  });

  // POST /emergency/sos — log SOS + notify therapist + reception
  fastify.post("/emergency/sos", async (request, reply) => {
    const { id: userId } = request.auth!;

    // Get user info to find their therapist
    const user = rawSqlite.prepare(`SELECT name, email FROM users WHERE id = ?`).get(userId) as any;

    // Log SOS activation
    const result = rawSqlite.prepare(`
      INSERT INTO sos_activations (user_id, ip_address, alerts_sent)
      VALUES (?, ?, 0)
    `).run(userId, request.ip);

    // Find linked therapists and reception staff
    const staff = rawSqlite.prepare(`
      SELECT u.id, u.name, u.email FROM users u
      WHERE u.is_active = 1 AND u.role IN ('EMPLOYEE', 'RECEPTION', 'ADMIN')
      LIMIT 10
    `).all() as any[];

    let alertsSent = 0;

    // Send in-app notifications to staff
    for (const s of staff) {
      try {
        rawSqlite.prepare(`
          INSERT INTO notifications (user_id, type, title, message, created_at)
          VALUES (?, 'SOS_ALERT', 'SOS ALERT!', ?, datetime('now'))
        `).run(s.id, `Klient ${user?.name ?? "Neznámý"} (ID: ${userId}) aktivoval SOS tlačítko. Zkontrolujte situaci.`);
        alertsSent++;
      } catch { /* ignore */ }
    }

    // Update alerts_sent count
    rawSqlite.prepare(`UPDATE sos_activations SET alerts_sent = ? WHERE id = ?`)
      .run(alertsSent, result.lastInsertRowid);

    // Audit log
    await logAudit(db, userId, "SOS_ACTIVATION", {
      targetId: Number(result.lastInsertRowid),
      targetType: "sos",
      details: JSON.stringify({ alertsSent }),
      ip: request.ip,
    });

    // Get emergency contacts for client-side display
    const contacts = rawSqlite.prepare(
      `SELECT name, phone, description FROM emergency_contacts WHERE is_active = 1 ORDER BY sort_order ASC`
    ).all();

    return {
      ok: true,
      activationId: result.lastInsertRowid,
      alertsSent,
      contacts,
    };
  });

  // GET /emergency/sos-log — ADMIN only
  fastify.get<{ Querystring: { limit?: string } }>(
    "/emergency/sos-log",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "EMPLOYEE"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const limit = Math.min(parseInt(request.query.limit ?? "50"), 500);
      const logs = rawSqlite.prepare(`
        SELECT s.*, u.name as user_name, u.email as user_email
        FROM sos_activations s
        LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC
        LIMIT ?
      `).all(limit) as any[];

      return { logs };
    }
  );

  // POST /emergency/contacts — ADMIN: add contact
  fastify.post<{ Body: { name: string; phone: string; description?: string; sortOrder?: number } }>(
    "/emergency/contacts",
    async (request, reply) => {
      const { role } = request.auth!;
      if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

      const { name, phone, description, sortOrder = 99 } = request.body;
      const result = rawSqlite.prepare(`
        INSERT INTO emergency_contacts (name, phone, description, sort_order) VALUES (?, ?, ?, ?)
      `).run(name, phone, description ?? null, sortOrder);

      return { ok: true, id: result.lastInsertRowid, name, phone };
    }
  );

  // PUT /emergency/contacts/:id — ADMIN: update contact
  fastify.put<{ Params: { id: string }; Body: { name?: string; phone?: string; description?: string; isActive?: boolean; sortOrder?: number } }>(
    "/emergency/contacts/:id",
    async (request, reply) => {
      const { role } = request.auth!;
      if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

      const id = parseInt(request.params.id);
      const { name, phone, description, isActive, sortOrder } = request.body;

      const existing = rawSqlite.prepare(`SELECT * FROM emergency_contacts WHERE id = ?`).get(id) as any;
      if (!existing) return reply.code(404).send({ error: "Not found" });

      rawSqlite.prepare(`
        UPDATE emergency_contacts SET
          name = ?, phone = ?, description = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      `).run(
        name ?? existing.name,
        phone ?? existing.phone,
        description !== undefined ? description : existing.description,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        sortOrder ?? existing.sort_order,
        id
      );

      return { ok: true };
    }
  );

  // DELETE /emergency/contacts/:id — ADMIN: soft-delete
  fastify.delete<{ Params: { id: string } }>(
    "/emergency/contacts/:id",
    async (request, reply) => {
      const { role } = request.auth!;
      if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

      rawSqlite.prepare(`UPDATE emergency_contacts SET is_active = 0 WHERE id = ?`)
        .run(parseInt(request.params.id));
      return { ok: true };
    }
  );
};

export default emergencyRoutes;
