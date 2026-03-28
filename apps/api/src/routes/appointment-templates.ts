/**
 * Appointment Templates — NOC 15/4
 * Admin defines preset combinations: service + employee + room + duration
 * POST /appointment-templates (ADMIN)
 * GET /appointment-templates (ADMIN/RECEPTION)
 * DELETE /appointment-templates/:id (ADMIN)
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointmentTemplates, services, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { appointmentTemplateSchemas } from "../utils/swagger-schemas.js";

const appointmentTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /appointment-templates
  fastify.post("/appointment-templates", { schema: appointmentTemplateSchemas.create }, async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as {
      name: string;
      serviceId: number;
      employeeId?: number;
      durationMinutes?: number;
      notes?: string;
    };

    if (!body.name || !body.serviceId) {
      return reply.code(400).send({ error: "name and serviceId are required" });
    }

    const [tmpl] = await db.insert(appointmentTemplates).values({
      name: body.name,
      serviceId: body.serviceId,
      employeeId: body.employeeId ?? null,
      durationMinutes: body.durationMinutes ?? 60,
      notes: body.notes ?? null,
      createdBy: id,
    }).returning();

    reply.code(201);
    return tmpl;
  });

  // GET /appointment-templates
  fastify.get("/appointment-templates", { schema: appointmentTemplateSchemas.list }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const templates = await db.select().from(appointmentTemplates);

    // Enrich with names
    const allServices = await db.select({ id: services.id, name: services.name }).from(services);
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);

    const svcMap = Object.fromEntries(allServices.map((s) => [s.id, s.name]));
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

    return templates.map((t) => ({
      ...t,
      serviceName: svcMap[t.serviceId] ?? null,
      employeeName: t.employeeId ? (userMap[t.employeeId] ?? null) : null,
    }));
  });

  // DELETE /appointment-templates/:id
  fastify.delete<{ Params: { id: string } }>("/appointment-templates/:id", { schema: appointmentTemplateSchemas.delete }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const tmplId = parseInt(request.params.id);
    const [tmpl] = await db.select().from(appointmentTemplates).where(eq(appointmentTemplates.id, tmplId)).limit(1);
    if (!tmpl) return reply.code(404).send({ error: "Template not found" });

    await db.delete(appointmentTemplates).where(eq(appointmentTemplates.id, tmplId));
    return { ok: true };
  });
};

export default appointmentTemplatesRoutes;
