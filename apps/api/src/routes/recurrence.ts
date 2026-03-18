import type { FastifyPluginAsync } from "fastify";
import { rawSqlite, db } from "../db/index.js";
import { appointments } from "../db/schema.js";
import { eq } from "drizzle-orm";

const recurrenceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /appointments/:id/recurrence — create recurring series from existing appointment
  fastify.post("/appointments/:id/recurrence", async (request, reply) => {
    const { role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt((request.params as { id: string }).id);
    const body = request.body as { rule: string; endDate?: string; count?: number };

    if (!["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(body.rule)) {
      return reply.code(400).send({ error: "rule must be WEEKLY, BIWEEKLY, or MONTHLY" });
    }

    const [parent] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (!parent) return reply.code(404).send({ error: "Appointment not found" });

    const maxCount = Math.min(body.count ?? 52, 52);
    const endDate = body.endDate ? new Date(body.endDate) : null;

    const intervalDays = body.rule === "WEEKLY" ? 7 : body.rule === "BIWEEKLY" ? 14 : 0; // 0 = monthly
    const isMonthly = body.rule === "MONTHLY";

    const created: number[] = [];
    const baseStart = new Date(parent.startTime);
    const baseEnd = new Date(parent.endTime);

    // Update parent with recurrence info using raw SQL (columns added by migration)
    rawSqlite.prepare(`UPDATE appointments SET recurrence_rule = ?, recurrence_end_date = ? WHERE id = ?`)
      .run(body.rule, body.endDate ?? null, id);

    for (let i = 1; i <= maxCount; i++) {
      let nextStart: Date;
      let nextEnd: Date;

      if (isMonthly) {
        nextStart = new Date(baseStart);
        nextStart.setMonth(nextStart.getMonth() + i);
        const diff = new Date(parent.endTime).getTime() - new Date(parent.startTime).getTime();
        nextEnd = new Date(nextStart.getTime() + diff);
      } else {
        nextStart = new Date(baseStart.getTime() + intervalDays * i * 24 * 60 * 60 * 1000);
        nextEnd = new Date(baseEnd.getTime() + intervalDays * i * 24 * 60 * 60 * 1000);
      }

      if (endDate && nextStart > endDate) break;

      const result = rawSqlite.prepare(`
        INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, notes, price, booking_activated, cancellation_reason, client_note, recurrence_rule, recurrence_end_date, recurrence_parent_id)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, 0, NULL, ?, ?, ?, ?)
      `).run(
        parent.clientId,
        parent.employeeId,
        parent.serviceId,
        parent.roomId ?? null,
        nextStart.toISOString(),
        nextEnd.toISOString(),
        parent.notes ?? null,
        parent.price ?? null,
        parent.clientNote ?? null,
        body.rule,
        body.endDate ?? null,
        id,
      );
      created.push(result.lastInsertRowid as number);
    }

    return reply.code(201).send({ created: created.length, parentId: id, appointments: created });
  });

  // DELETE /appointments/:id/recurrence — cancel all future appointments in this series
  fastify.delete("/appointments/:id/recurrence", async (request, reply) => {
    const { role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt((request.params as { id: string }).id);
    const [parent] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (!parent) return reply.code(404).send({ error: "Appointment not found" });

    const now = new Date().toISOString();

    // Cancel all future appointments that belong to this series (parent_id = id or id itself)
    const result = rawSqlite.prepare(`
      UPDATE appointments
      SET status = 'CANCELLED', cancellation_reason = 'Recurring series cancelled'
      WHERE recurrence_parent_id = ? AND start_time > ? AND status NOT IN ('CANCELLED', 'COMPLETED')
    `).run(id, now);

    return { ok: true, cancelledAppointments: result.changes };
  });
};

export default recurrenceRoutes;
