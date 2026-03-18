/**
 * Health Goals — NOC 15/5
 * Client rehabilitation goals, evaluated by therapists
 * POST /clients/:id/health-goals (RECEPTION/EMPLOYEE/ADMIN)
 * GET /clients/:id/health-goals (CLIENT: own; RECEPTION/EMPLOYEE/ADMIN: any)
 * PATCH /health-goals/:id (EMPLOYEE/ADMIN: status+notes; CLIENT: description own)
 * DELETE /health-goals/:id (ADMIN)
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { healthGoals, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { healthGoalSchemas } from "../utils/swagger-schemas.js";

const healthGoalsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /clients/:id/health-goals
  fastify.post<{ Params: { id: string } }>("/clients/:id/health-goals", { schema: healthGoalSchemas.create }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["RECEPTION", "EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const clientId = parseInt(request.params.id);
    const [client] = await db.select({ id: users.id }).from(users).where(eq(users.id, clientId)).limit(1);
    if (!client) return reply.code(404).send({ error: "Client not found" });

    const body = request.body as {
      title: string;
      description?: string;
      targetDate?: string;
    };
    if (!body.title) return reply.code(400).send({ error: "title is required" });

    const [goal] = await db.insert(healthGoals).values({
      clientId,
      title: body.title,
      description: body.description ?? null,
      targetDate: body.targetDate ?? null,
      status: "active",
    }).returning();

    reply.code(201);
    return goal;
  });

  // GET /clients/:id/health-goals
  fastify.get<{ Params: { id: string } }>("/clients/:id/health-goals", { schema: healthGoalSchemas.list }, async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const clientId = parseInt(request.params.id);

    if (role === "CLIENT" && clientId !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return db.select().from(healthGoals).where(eq(healthGoals.clientId, clientId));
  });

  // PATCH /health-goals/:id
  fastify.patch<{ Params: { id: string } }>("/health-goals/:id", { schema: healthGoalSchemas.update }, async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const goalId = parseInt(request.params.id);

    const [goal] = await db.select().from(healthGoals).where(eq(healthGoals.id, goalId)).limit(1);
    if (!goal) return reply.code(404).send({ error: "Goal not found" });

    const body = request.body as {
      status?: "active" | "achieved" | "abandoned";
      employeeNotes?: string;
      description?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (["EMPLOYEE", "ADMIN"].includes(role)) {
      if (body.status) updates.status = body.status;
      if (body.employeeNotes !== undefined) updates.employeeNotes = body.employeeNotes;
      if (body.description !== undefined) updates.description = body.description;
    } else if (role === "CLIENT") {
      if (goal.clientId !== userId) return reply.code(403).send({ error: "Forbidden" });
      if (body.description !== undefined) updates.description = body.description;
    } else {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const [updated] = await db.update(healthGoals)
      .set(updates as any)
      .where(eq(healthGoals.id, goalId))
      .returning();

    return updated;
  });

  // DELETE /health-goals/:id (ADMIN only)
  fastify.delete<{ Params: { id: string } }>("/health-goals/:id", { schema: healthGoalSchemas.delete }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const goalId = parseInt(request.params.id);
    const [goal] = await db.select().from(healthGoals).where(eq(healthGoals.id, goalId)).limit(1);
    if (!goal) return reply.code(404).send({ error: "Goal not found" });

    await db.delete(healthGoals).where(eq(healthGoals.id, goalId));
    return { ok: true };
  });
};

export default healthGoalsRoutes;
