import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, notifications } from "../db/schema.js";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { CreateAppointmentSchema, UpdateAppointmentSchema } from "@pristav/shared";

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
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
