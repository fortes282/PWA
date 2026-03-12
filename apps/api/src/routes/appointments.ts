import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, notifications, workingHours, services, users, rooms } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { CreateAppointmentSchema, UpdateAppointmentSchema } from "@pristav/shared";

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /appointments/available?serviceId=X&date=YYYY-MM-DD
  fastify.get("/appointments/available", async (request, reply) => {
    const q = request.query as { serviceId?: string; date?: string };
    if (!q.serviceId || !q.date) {
      return reply.code(400).send({ error: "serviceId and date are required" });
    }

    const serviceId = parseInt(q.serviceId);
    const date = q.date; // YYYY-MM-DD

    const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    if (!service) return reply.code(404).send({ error: "Service not found" });

    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    const wh = await db.select().from(workingHours).where(
      and(eq(workingHours.dayOfWeek, dayOfWeek), eq(workingHours.isActive, true))
    );
    if (wh.length === 0) return [];

    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const existingAppts = (await db.select().from(appointments))
      .filter((a) => a.startTime >= dayStart && a.startTime <= dayEnd && a.status !== "CANCELLED");

    const allRooms = await db.select().from(rooms).where(eq(rooms.isActive, true));

    const slots: Array<{
      startTime: string;
      endTime: string;
      employeeId: number;
      employeeName?: string;
      roomId: number | null;
    }> = [];

    for (const hours of wh) {
      const [emp] = await db.select().from(users).where(eq(users.id, hours.employeeId)).limit(1);

      const [startH, startM] = hours.startTime.split(":").map(Number);
      const [endH, endM] = hours.endTime.split(":").map(Number);
      const workStart = startH * 60 + startM;
      const workEnd = endH * 60 + endM;

      for (let min = workStart; min + service.durationMin <= workEnd; min += 30) {
        const slotStartH = String(Math.floor(min / 60)).padStart(2, "0");
        const slotStartM = String(min % 60).padStart(2, "0");
        const slotEnd = min + service.durationMin;
        const slotEndH = String(Math.floor(slotEnd / 60)).padStart(2, "0");
        const slotEndM = String(slotEnd % 60).padStart(2, "0");

        const startTime = `${date}T${slotStartH}:${slotStartM}:00.000Z`;
        const endTime = `${date}T${slotEndH}:${slotEndM}:00.000Z`;

        const conflict = existingAppts.some(
          (a) => a.employeeId === hours.employeeId && a.startTime < endTime && a.endTime > startTime
        );
        if (conflict) continue;

        const freeRoom = allRooms.find((r) => {
          return !existingAppts.some(
            (a) => a.roomId === r.id && a.startTime < endTime && a.endTime > startTime
          );
        });

        slots.push({
          startTime,
          endTime,
          employeeId: hours.employeeId,
          employeeName: emp?.name,
          roomId: freeRoom?.id ?? null,
        });
      }
    }

    return slots;
  });

  // GET /appointments
  fastify.get("/appointments", async (request, reply) => {
    const { id, role } = request.auth!;
    const q = request.query as {
      from?: string;
      to?: string;
      clientId?: string;
      employeeId?: string;
      status?: string;
    };

    let all = await db.select().from(appointments);

    // Role filtering
    if (role === "CLIENT") {
      all = all.filter((a) => a.clientId === id);
    } else if (role === "EMPLOYEE") {
      all = all.filter((a) => a.employeeId === id);
    }

    if (q.from) all = all.filter((a) => a.startTime >= q.from!);
    if (q.to) all = all.filter((a) => a.startTime <= q.to!);
    if (q.clientId && ["ADMIN", "RECEPTION"].includes(role)) {
      all = all.filter((a) => a.clientId === parseInt(q.clientId!));
    }
    if (q.employeeId) {
      all = all.filter((a) => a.employeeId === parseInt(q.employeeId!));
    }
    if (q.status) {
      all = all.filter((a) => a.status === q.status);
    }

    return all;
  });

  // GET /appointments/:id
  fastify.get<{ Params: { id: string } }>("/appointments/:id", async (request, reply) => {
    const apptId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    const [appt] = await db.select().from(appointments).where(eq(appointments.id, apptId)).limit(1);
    if (!appt) return reply.code(404).send({ error: "Appointment not found" });

    if (role === "CLIENT" && appt.clientId !== id) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    if (role === "EMPLOYEE" && appt.employeeId !== id) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return appt;
  });

  // POST /appointments
  fastify.post("/appointments", async (request, reply) => {
    const { id, role } = request.auth!;
    const result = CreateAppointmentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.flatten() });
    }

    const data = result.data;

    // Clients can only book for themselves
    if (role === "CLIENT") {
      data.clientId = id;
    }

    const [created] = await db.insert(appointments).values({
      ...data,
      price: data.price ?? null,
      status: "PENDING",
    }).returning();

    // Create notification
    await db.insert(notifications).values({
      userId: data.clientId,
      type: "APPOINTMENT_CONFIRMED",
      title: "Nový termín",
      message: `Váš termín byl naplánován na ${new Date(data.startTime).toLocaleString("cs-CZ")}.`,
    });

    reply.code(201);
    return created;
  });

  // PATCH /appointments/:id
  fastify.patch<{ Params: { id: string } }>("/appointments/:id", async (request, reply) => {
    const apptId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    const [appt] = await db.select().from(appointments).where(eq(appointments.id, apptId)).limit(1);
    if (!appt) return reply.code(404).send({ error: "Appointment not found" });

    if (role === "CLIENT" && appt.clientId !== id) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const result = UpdateAppointmentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.flatten() });
    }

    const [updated] = await db
      .update(appointments)
      .set({ ...result.data, updatedAt: new Date().toISOString() })
      .where(eq(appointments.id, apptId))
      .returning();

    // Notification on cancel
    if (result.data.status === "CANCELLED") {
      await db.insert(notifications).values({
        userId: appt.clientId,
        type: "APPOINTMENT_CANCELLED",
        title: "Termín zrušen",
        message: `Váš termín ${new Date(appt.startTime).toLocaleString("cs-CZ")} byl zrušen.`,
      });
    }

    return updated;
  });

  // DELETE /appointments/:id (cancel)
  fastify.delete<{ Params: { id: string } }>("/appointments/:id", async (request, reply) => {
    const apptId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    const [appt] = await db.select().from(appointments).where(eq(appointments.id, apptId)).limit(1);
    if (!appt) return reply.code(404).send({ error: "Not found" });

    if (role === "CLIENT" && appt.clientId !== id) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    await db.update(appointments)
      .set({ status: "CANCELLED", updatedAt: new Date().toISOString() })
      .where(eq(appointments.id, apptId));

    return { ok: true };
  });

  // POST /appointments/:id/activate — Reception/Admin
  fastify.post<{ Params: { id: string } }>("/appointments/:id/activate", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    await db.update(appointments)
      .set({ bookingActivated: true, status: "CONFIRMED", updatedAt: new Date().toISOString() })
      .where(eq(appointments.id, parseInt(request.params.id)));
    return { ok: true };
  });
};

export default appointmentsRoutes;
