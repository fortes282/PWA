import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { appointments, users, services } from "../db/schema.js";
import { eq } from "drizzle-orm";

const appointmentSeriesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /appointments/series — ADMIN/RECEPTION
  fastify.post("/appointments/series", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      employeeId: number;
      clientId: number;
      serviceId: number;
      roomId?: number;
      startTime: string; // HH:MM
      dayOfWeek: number; // 0-6
      frequency: "WEEKLY" | "BIWEEKLY";
      startDate: string; // YYYY-MM-DD
      endDate?: string; // YYYY-MM-DD optional
      notes?: string;
    };

    if (!body.employeeId || !body.clientId || !body.serviceId || !body.startTime || body.dayOfWeek === undefined || !body.frequency || !body.startDate) {
      return reply.code(400).send({ error: "Missing required fields" });
    }

    // Verify service exists and get duration
    const [svc] = await db.select().from(services).where(eq(services.id, body.serviceId)).limit(1);
    if (!svc) return reply.code(404).send({ error: "Service not found" });

    // Insert series
    const seriesResult = rawSqlite.prepare(`
      INSERT INTO appointment_series (employee_id, client_id, service_id, room_id, start_time, day_of_week, frequency, start_date, end_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(
      body.employeeId,
      body.clientId,
      body.serviceId,
      body.roomId ?? null,
      body.startTime,
      body.dayOfWeek,
      body.frequency,
      body.startDate,
      body.endDate ?? null,
      body.notes ?? null
    );
    const seriesId = seriesResult.lastInsertRowid as number;

    // Generate appointments for 8 weeks (or until endDate)
    const [startH, startM] = body.startTime.split(":").map(Number);
    const durationMs = svc.durationMin * 60 * 1000;
    const stepDays = body.frequency === "WEEKLY" ? 7 : 14;
    const maxWeeks = 8;

    let appointmentsCreated = 0;
    const startDateObj = new Date(body.startDate + "T12:00:00");
    const endDateObj = body.endDate ? new Date(body.endDate + "T23:59:59") : new Date(startDateObj.getTime() + maxWeeks * 7 * 24 * 60 * 60 * 1000);

    // Find first occurrence on or after startDate with matching dayOfWeek
    let current = new Date(startDateObj);
    while (current.getDay() !== body.dayOfWeek) {
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    const limit = maxWeeks * (body.frequency === "WEEKLY" ? 8 : 4) + 5; // safety limit
    let count = 0;

    while (current <= endDateObj && count < limit) {
      count++;
      const dateStr = current.toISOString().slice(0, 10);
      const startTime = `${dateStr}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00.000Z`;
      const endTime = new Date(new Date(startTime).getTime() + durationMs).toISOString();

      // Skip if conflict exists
      const existing = await db.select().from(appointments);
      const conflict = existing.some(a =>
        a.status !== "CANCELLED" &&
        a.employeeId === body.employeeId &&
        a.startTime < endTime &&
        a.endTime > startTime
      );

      if (!conflict) {
        await db.insert(appointments).values({
          clientId: body.clientId,
          employeeId: body.employeeId,
          serviceId: body.serviceId,
          roomId: body.roomId ?? null,
          startTime,
          endTime,
          status: "PENDING",
          notes: body.notes ? `[Série #${seriesId}] ${body.notes}` : `[Série #${seriesId}]`,
          price: svc.price,
        });
        appointmentsCreated++;
      }

      current = new Date(current.getTime() + stepDays * 24 * 60 * 60 * 1000);
    }

    reply.code(201);
    return { seriesId, appointmentsCreated };
  });

  // GET /appointments/series — ADMIN/RECEPTION
  fastify.get("/appointments/series", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    try {
      const series = rawSqlite.prepare("SELECT * FROM appointment_series ORDER BY created_at DESC").all();
      return series;
    } catch {
      return [];
    }
  });

  // DELETE /appointments/series/:id — ADMIN/RECEPTION
  fastify.delete<{ Params: { id: string } }>("/appointments/series/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const seriesId = parseInt(request.params.id);

    // Check series exists
    const series = rawSqlite.prepare("SELECT * FROM appointment_series WHERE id = ?").get(seriesId) as any;
    if (!series) return reply.code(404).send({ error: "Series not found" });

    // Cancel series
    rawSqlite.prepare("UPDATE appointment_series SET status = 'CANCELLED' WHERE id = ?").run(seriesId);

    // Cancel future appointments from this series
    const now = new Date().toISOString();
    const notesPattern = `[Série #${seriesId}]`;
    const allAppts = await db.select().from(appointments);
    let cancelledCount = 0;

    for (const a of allAppts) {
      if (
        a.notes?.includes(notesPattern) &&
        a.status !== "CANCELLED" &&
        a.startTime > now
      ) {
        await db.update(appointments)
          .set({ status: "CANCELLED", updatedAt: new Date().toISOString() })
          .where(eq(appointments.id, a.id));
        cancelledCount++;
      }
    }

    return { ok: true, cancelledAppointments: cancelledCount };
  });
};

export default appointmentSeriesRoutes;
