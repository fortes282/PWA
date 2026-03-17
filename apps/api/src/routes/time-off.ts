import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";

const timeOffRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /employees/:id/time-off — ADMIN/RECEPTION
  fastify.post<{ Params: { id: string } }>("/employees/:id/time-off", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const employeeId = parseInt(request.params.id);
    const body = request.body as {
      startDateTime: string;
      endDateTime: string;
      reason?: string;
    };

    if (!body.startDateTime || !body.endDateTime) {
      return reply.code(400).send({ error: "startDateTime and endDateTime are required" });
    }

    if (body.startDateTime >= body.endDateTime) {
      return reply.code(400).send({ error: "endDateTime must be after startDateTime" });
    }

    try {
      const result = rawSqlite.prepare(`
        INSERT INTO time_off_blocks (employee_id, start_date_time, end_date_time, reason, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(employeeId, body.startDateTime, body.endDateTime, body.reason ?? null, userId);

      reply.code(201);
      return rawSqlite.prepare("SELECT * FROM time_off_blocks WHERE id = ?").get(result.lastInsertRowid);
    } catch {
      return reply.code(500).send({ error: "Failed to create time-off block" });
    }
  });

  // GET /employees/:id/time-off?from=&to= — ADMIN/RECEPTION/EMPLOYEE (own)
  fastify.get<{ Params: { id: string } }>("/employees/:id/time-off", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const employeeId = parseInt(request.params.id);

    // EMPLOYEE can only see their own
    if (role === "EMPLOYEE" && userId !== employeeId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };

    try {
      let blocks = rawSqlite.prepare("SELECT * FROM time_off_blocks WHERE employee_id = ? ORDER BY start_date_time ASC").all(employeeId) as any[];

      if (q.from) blocks = blocks.filter((b: any) => b.end_date_time >= q.from!);
      if (q.to) blocks = blocks.filter((b: any) => b.start_date_time <= q.to!);

      return blocks;
    } catch {
      return [];
    }
  });

  // DELETE /employees/:id/time-off/:blockId — ADMIN/RECEPTION or owner
  fastify.delete<{ Params: { id: string; blockId: string } }>("/employees/:id/time-off/:blockId", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const employeeId = parseInt(request.params.id);
    const blockId = parseInt(request.params.blockId);

    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    try {
      const block = rawSqlite.prepare("SELECT * FROM time_off_blocks WHERE id = ?").get(blockId) as any;
      if (!block) return reply.code(404).send({ error: "Time-off block not found" });

      // EMPLOYEE can only delete their own
      if (role === "EMPLOYEE" && block.employee_id !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      rawSqlite.prepare("DELETE FROM time_off_blocks WHERE id = ?").run(blockId);
      return { ok: true };
    } catch {
      return reply.code(500).send({ error: "Failed to delete time-off block" });
    }
  });
};

export default timeOffRoutes;
