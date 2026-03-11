import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { medicalReports } from "../db/schema.js";
import { eq, and, or } from "drizzle-orm";

const medicalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/medical-reports", async (request) => {
    const { id, role } = request.auth!;
    if (role === "CLIENT") {
      return db.select().from(medicalReports).where(eq(medicalReports.clientId, id));
    }
    if (role === "EMPLOYEE") {
      return db.select().from(medicalReports).where(eq(medicalReports.employeeId, id));
    }
    return db.select().from(medicalReports);
  });

  fastify.get<{ Params: { id: string } }>("/medical-reports/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const reportId = parseInt(request.params.id);
    const [report] = await db.select().from(medicalReports).where(eq(medicalReports.id, reportId)).limit(1);
    if (!report) return reply.code(404).send({ error: "Not found" });

    if (role === "CLIENT" && report.clientId !== userId) return reply.code(403).send({ error: "Forbidden" });
    if (role === "EMPLOYEE" && report.employeeId !== userId) return reply.code(403).send({ error: "Forbidden" });

    return report;
  });

  fastify.post("/medical-reports", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      clientId: number;
      appointmentId?: number;
      title: string;
      content: string;
      diagnosis?: string;
      recommendations?: string;
    };

    const [report] = await db.insert(medicalReports).values({
      clientId: body.clientId,
      employeeId: id,
      appointmentId: body.appointmentId ?? null,
      title: body.title,
      content: body.content,
      diagnosis: body.diagnosis ?? null,
      recommendations: body.recommendations ?? null,
    }).returning();

    reply.code(201);
    return report;
  });

  fastify.patch<{ Params: { id: string } }>("/medical-reports/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const reportId = parseInt(request.params.id);

    const [report] = await db.select().from(medicalReports).where(eq(medicalReports.id, reportId)).limit(1);
    if (!report) return reply.code(404).send({ error: "Not found" });
    if (role === "EMPLOYEE" && report.employeeId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as Partial<{
      title: string;
      content: string;
      diagnosis: string;
      recommendations: string;
    }>;

    const [updated] = await db.update(medicalReports)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(medicalReports.id, reportId))
      .returning();

    return updated;
  });
};

export default medicalRoutes;
