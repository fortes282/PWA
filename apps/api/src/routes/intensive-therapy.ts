/**
 * Intensive therapy calendar blocks — recepce/admin plánuje vícehodinové bloky u terapeutů;
 * při pozdějším POST /slots/open se tyto hodiny nepřidají (viz booking-v2.ts).
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function rangesOverlapMins(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0;
}

/** Segment [s0,s1) vs hourly slot [h0,h0+60) */
function segmentOverlapsHour(s0: number, s1: number, hourStart: number): boolean {
  return rangesOverlapMins(s0, s1, hourStart, hourStart + 60);
}

const STAFF = ["RECEPTION", "ADMIN"];

const intensiveTherapyRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /intensive-therapy/plans
  fastify.post<{
    Body: {
      title: string;
      clientId?: number | null;
      notes?: string;
      segments: Array<{
        employeeId: number;
        serviceId?: number | null;
        date: string;
        startTime: string;
        endTime: string;
      }>;
    };
  }>("/intensive-therapy/plans", async (request, reply) => {
    const auth = request.auth;
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });
    if (!STAFF.includes(auth.role)) return reply.code(403).send({ error: "Forbidden" });

    const { title, clientId, notes, segments } = request.body;
    if (!title?.trim()) return reply.code(400).send({ error: "title is required" });
    if (!Array.isArray(segments) || segments.length === 0) {
      return reply.code(400).send({ error: "segments must be a non-empty array" });
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg.date || !seg.startTime || !seg.endTime || !seg.employeeId) {
        return reply.code(400).send({ error: `Segment ${i + 1}: date, employeeId, startTime, endTime are required` });
      }
      const s0 = timeToMins(seg.startTime);
      const s1 = timeToMins(seg.endTime);
      if (s1 <= s0) return reply.code(400).send({ error: `Segment ${i + 1}: endTime must be after startTime` });
    }

    if (clientId != null) {
      const u = rawSqlite.prepare("SELECT id, role FROM users WHERE id = ?").get(clientId) as
        | { id: number; role: string }
        | undefined;
      if (!u || u.role !== "CLIENT") return reply.code(400).send({ error: "Invalid clientId" });
    }

    // Pairwise overlap same employee + date (payload)
    const byEmpDate = new Map<string, Array<{ s0: number; s1: number; idx: number }>>();
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const key = `${seg.employeeId}:${seg.date}`;
      const s0 = timeToMins(seg.startTime);
      const s1 = timeToMins(seg.endTime);
      const list = byEmpDate.get(key) ?? [];
      for (const other of list) {
        if (rangesOverlapMins(s0, s1, other.s0, other.s1)) {
          return reply.code(400).send({ error: "Segments overlap for the same therapist on the same day" });
        }
      }
      list.push({ s0, s1, idx: i });
      byEmpDate.set(key, list);
    }

    const bookedHoursStmt = rawSqlite.prepare(
      `SELECT s.time FROM open_slots s
       INNER JOIN bookings_v2 b ON b.id = s.booking_id AND b.status = 'confirmed'
       WHERE s.employee_id = ? AND s.date = ? AND s.status = 'booked'`
    );

    const existingIntensiveStmt = rawSqlite.prepare(
      `SELECT its.start_time, its.end_time FROM intensive_therapy_segments its
       INNER JOIN intensive_therapy_plans p ON p.id = its.plan_id AND p.status = 'CONFIRMED'
       WHERE its.employee_id = ? AND its.date = ?`
    );

    for (const seg of segments) {
      const s0 = timeToMins(seg.startTime);
      const s1 = timeToMins(seg.endTime);

      const booked = bookedHoursStmt.all(seg.employeeId, seg.date) as Array<{ time: string }>;
      for (const row of booked) {
        const h = timeToMins(row.time);
        if (segmentOverlapsHour(s0, s1, h)) {
          return reply.code(409).send({
            error: "Conflict with an existing booking",
            detail: { date: seg.date, time: row.time },
          });
        }
      }

      const existing = existingIntensiveStmt.all(seg.employeeId, seg.date) as Array<{
        start_time: string;
        end_time: string;
      }>;
      for (const ex of existing) {
        const e0 = timeToMins(ex.start_time);
        const e1 = timeToMins(ex.end_time);
        if (rangesOverlapMins(s0, s1, e0, e1)) {
          return reply.code(409).send({
            error: "Overlaps an existing intensive therapy block",
            detail: { date: seg.date },
          });
        }
      }

      if (seg.serviceId != null) {
        const svc = rawSqlite.prepare("SELECT id FROM services WHERE id = ?").get(seg.serviceId) as { id: number } | undefined;
        if (!svc) return reply.code(400).send({ error: `Invalid serviceId for segment on ${seg.date}` });
      }
    }

    const insertPlan = rawSqlite.prepare(
      `INSERT INTO intensive_therapy_plans (title, client_id, status, notes, created_by_user_id, updated_at)
       VALUES (?, ?, 'CONFIRMED', ?, ?, datetime('now'))`
    );
    const insertSeg = rawSqlite.prepare(
      `INSERT INTO intensive_therapy_segments (plan_id, employee_id, service_id, date, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const run = rawSqlite.transaction(() => {
      const info = insertPlan.run(
        title.trim(),
        clientId ?? null,
        notes?.trim() ?? null,
        auth.id
      );
      const planId = Number(info.lastInsertRowid);
      for (const seg of segments) {
        insertSeg.run(
          planId,
          seg.employeeId,
          seg.serviceId ?? null,
          seg.date,
          seg.startTime,
          seg.endTime
        );
      }
      return planId;
    });

    let planId: number;
    try {
      planId = run();
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: "Failed to create plan" });
    }

    return { id: planId };
  });

  // GET /intensive-therapy/plans?from=&to=
  fastify.get<{ Querystring: { from?: string; to?: string } }>("/intensive-therapy/plans", async (request, reply) => {
    const auth = request.auth;
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });
    if (!STAFF.includes(auth.role)) return reply.code(403).send({ error: "Forbidden" });

    const { from, to } = request.query;
    if (!from || !to) return reply.code(400).send({ error: "from and to are required" });

    const planIds = rawSqlite
      .prepare(
        `SELECT p.id FROM intensive_therapy_plans p
         WHERE p.status = 'CONFIRMED' AND EXISTS (
           SELECT 1 FROM intensive_therapy_segments s
           WHERE s.plan_id = p.id AND s.date >= ? AND s.date <= ?
         )
         ORDER BY p.created_at DESC`
      )
      .all(from, to) as Array<{ id: number }>;

    const plans: unknown[] = [];
    const planRow = rawSqlite.prepare(
      `SELECT p.*, c.name as client_name FROM intensive_therapy_plans p
       LEFT JOIN users c ON c.id = p.client_id WHERE p.id = ?`
    );
    const segs = rawSqlite.prepare(
      `SELECT s.*, u.name as employee_name, sv.name as service_name
       FROM intensive_therapy_segments s
       JOIN users u ON u.id = s.employee_id
       LEFT JOIN services sv ON sv.id = s.service_id
       WHERE s.plan_id = ?
       ORDER BY s.date, s.start_time`
    );

    for (const { id } of planIds) {
      const p = planRow.get(id) as Record<string, unknown>;
      if (!p) continue;
      const segments = segs.all(id);
      plans.push({ ...p, segments });
    }

    return { plans };
  });

  // GET /intensive-therapy/segments?from=&to=&employeeId=
  fastify.get<{
    Querystring: { from?: string; to?: string; employeeId?: string };
  }>("/intensive-therapy/segments", async (request, reply) => {
    const auth = request.auth;
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });
    if (!STAFF.includes(auth.role)) return reply.code(403).send({ error: "Forbidden" });

    const { from, to, employeeId } = request.query;
    if (!from || !to) return reply.code(400).send({ error: "from and to are required" });

    let q = `
      SELECT s.id, s.plan_id, s.employee_id, s.service_id, s.date, s.start_time, s.end_time,
             p.title as plan_title, p.status as plan_status,
             u.name as employee_name, sv.name as service_name
      FROM intensive_therapy_segments s
      INNER JOIN intensive_therapy_plans p ON p.id = s.plan_id AND p.status = 'CONFIRMED'
      JOIN users u ON u.id = s.employee_id
      LEFT JOIN services sv ON sv.id = s.service_id
      WHERE s.date >= ? AND s.date <= ?
    `;
    const params: Array<string | number> = [from, to];
    if (employeeId) {
      q += " AND s.employee_id = ?";
      params.push(parseInt(employeeId, 10));
    }
    q += " ORDER BY s.date, s.start_time, u.name";

    const segments = rawSqlite.prepare(q).all(...params);
    return { segments };
  });

  // DELETE /intensive-therapy/plans/:id — soft cancel
  fastify.delete<{ Params: { id: string } }>("/intensive-therapy/plans/:id", async (request, reply) => {
    const auth = request.auth;
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });
    if (!STAFF.includes(auth.role)) return reply.code(403).send({ error: "Forbidden" });

    const id = parseInt(request.params.id, 10);
    if (Number.isNaN(id)) return reply.code(400).send({ error: "Invalid id" });

    const info = rawSqlite
      .prepare(
        `UPDATE intensive_therapy_plans SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ? AND status = 'CONFIRMED'`
      )
      .run(id);
    if (info.changes === 0) return reply.code(404).send({ error: "Plan not found or already cancelled" });
    return { ok: true };
  });
};

export default intensiveTherapyRoutes;
