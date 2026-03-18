import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { therapyReports, therapyTemplates, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const therapyReportsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /report-templates — list all active therapy templates
  fastify.get("/report-templates", async (request, reply) => {
    const { role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const templates = await db
      .select()
      .from(therapyTemplates)
      .where(eq(therapyTemplates.isActive, true));
    return templates.map((t) => ({
      ...t,
      structure: JSON.parse(t.structure),
    }));
  });

  // GET /reports/therapy — list therapy reports for current therapist (or all for ADMIN)
  fastify.get("/reports/therapy", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const allReports = await db.select().from(therapyReports);
    const filtered = role === "ADMIN" ? allReports : allReports.filter((r) => r.therapistId === userId);

    const allUsers = await db.select().from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
    const allTemplates = await db.select().from(therapyTemplates);
    const tplMap = Object.fromEntries(allTemplates.map((t) => [t.id, t]));

    return filtered.map((r) => ({
      ...r,
      data: JSON.parse(r.data),
      client: userMap[r.clientId] ? { id: r.clientId, name: userMap[r.clientId].name } : null,
      therapist: userMap[r.therapistId] ? { id: r.therapistId, name: userMap[r.therapistId].name } : null,
      template: r.templateId && tplMap[r.templateId] ? {
        id: r.templateId,
        name: tplMap[r.templateId].name,
        category: tplMap[r.templateId].category,
        structure: JSON.parse(tplMap[r.templateId].structure),
      } : null,
    }));
  });

  // GET /reports/therapy/:id — get single therapy report
  fastify.get("/reports/therapy/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { id } = request.params as { id: string };
    const [report] = await db
      .select()
      .from(therapyReports)
      .where(eq(therapyReports.id, parseInt(id)));

    if (!report) return reply.code(404).send({ error: "Not found" });
    if (role === "EMPLOYEE" && report.therapistId !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const [client] = await db.select().from(users).where(eq(users.id, report.clientId));
    const [therapist] = await db.select().from(users).where(eq(users.id, report.therapistId));
    let template = null;
    if (report.templateId) {
      const [tpl] = await db.select().from(therapyTemplates).where(eq(therapyTemplates.id, report.templateId));
      if (tpl) {
        template = { ...tpl, structure: JSON.parse(tpl.structure) };
      }
    }

    return {
      ...report,
      data: JSON.parse(report.data),
      client: client ? { id: client.id, name: client.name, phone: client.phone } : null,
      therapist: therapist ? { id: therapist.id, name: therapist.name } : null,
      template,
    };
  });

  // POST /reports/therapy — create new therapy report
  fastify.post("/reports/therapy", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      templateId?: number;
      clientId: number;
      appointmentId?: number;
      title: string;
      data: Record<string, unknown>;
      status?: "DRAFT" | "FINAL";
    };

    if (!body.clientId || !body.title || !body.data) {
      return reply.code(400).send({ error: "clientId, title, and data are required" });
    }

    const [created] = await db
      .insert(therapyReports)
      .values({
        templateId: body.templateId ?? null,
        clientId: body.clientId,
        therapistId: userId,
        appointmentId: body.appointmentId ?? null,
        title: body.title,
        data: JSON.stringify(body.data),
        status: body.status ?? "DRAFT",
      })
      .returning();

    return reply.code(201).send({ ...created, data: JSON.parse(created.data) });
  });

  // PATCH /reports/therapy/:id — update therapy report
  fastify.patch("/reports/therapy/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { id } = request.params as { id: string };
    const [existing] = await db
      .select()
      .from(therapyReports)
      .where(eq(therapyReports.id, parseInt(id)));

    if (!existing) return reply.code(404).send({ error: "Not found" });
    if (role === "EMPLOYEE" && existing.therapistId !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      title?: string;
      data?: Record<string, unknown>;
      status?: "DRAFT" | "FINAL";
    };

    const [updated] = await db
      .update(therapyReports)
      .set({
        title: body.title ?? existing.title,
        data: body.data ? JSON.stringify(body.data) : existing.data,
        status: body.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(therapyReports.id, parseInt(id)))
      .returning();

    return { ...updated, data: JSON.parse(updated.data) };
  });
};

export default therapyReportsRoutes;
