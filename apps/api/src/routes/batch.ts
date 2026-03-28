/**
 * Batch operations for bulk updates (ADMIN/RECEPTION only).
 *
 * POST /batch/appointments/status — bulk status update for multiple appointments
 * POST /batch/notifications — send notification to multiple users by filter
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, notifications, users } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { batchSchemas } from "../utils/swagger-schemas.js";

const batchRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /batch/appointments/status — set same status on multiple appointments
  fastify.post("/batch/appointments/status", { schema: batchSchemas.appointmentStatus }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as { ids: number[]; status: string };

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.code(400).send({ error: "ids must be a non-empty array" });
    }
    if (body.ids.length > 100) {
      return reply.code(400).send({ error: "Maximum 100 appointments per batch" });
    }

    const validStatuses = ["CONFIRMED", "CANCELLED", "COMPLETED", "UNJUSTIFIED_CANCEL", "PENDING"];
    if (!validStatuses.includes(body.status)) {
      return reply.code(400).send({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const updated = await db
      .update(appointments)
      .set({ status: body.status as any, updatedAt: new Date().toISOString() })
      .where(inArray(appointments.id, body.ids))
      .returning();

    return {
      updated: updated.length,
      ids: updated.map((a) => a.id),
    };
  });

  // POST /batch/notifications — send notification to users by role or specific ids
  fastify.post("/batch/notifications", { schema: batchSchemas.notifications }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      userIds?: number[];
      roles?: string[];
      type: string;
      title: string;
      message: string;
    };

    if (!body.title || !body.message || !body.type) {
      return reply.code(400).send({ error: "type, title and message are required" });
    }

    let targetUserIds: number[] = [];

    if (body.userIds && body.userIds.length > 0) {
      targetUserIds = body.userIds;
    } else if (body.roles && body.roles.length > 0) {
      const matchedUsers = await db.select({ id: users.id }).from(users);
      targetUserIds = matchedUsers
        .filter((u) => body.roles!.includes((u as any).role))
        .map((u) => u.id);
    } else {
      return reply.code(400).send({ error: "Provide userIds or roles" });
    }

    if (targetUserIds.length === 0) {
      return { sent: 0 };
    }
    if (targetUserIds.length > 500) {
      return reply.code(400).send({ error: "Maximum 500 recipients per batch" });
    }

    const rows = targetUserIds.map((userId) => ({
      userId,
      type: body.type as any,
      title: body.title,
      message: body.message,
    }));

    await db.insert(notifications).values(rows);

    return { sent: rows.length };
  });
  /**
   * POST /batch/users/active — bulk (de)activate users (ADMIN only)
   * Body: { ids: number[], isActive: boolean }
   */
  fastify.post("/batch/users/active", { schema: batchSchemas.usersActive }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as { ids: number[]; isActive: boolean };

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return reply.code(400).send({ error: "ids must be a non-empty array" });
    }
    if (body.ids.length > 200) {
      return reply.code(400).send({ error: "Maximum 200 users per batch" });
    }
    if (typeof body.isActive !== "boolean") {
      return reply.code(400).send({ error: "isActive must be a boolean" });
    }

    const updated = await db
      .update(users)
      .set({ isActive: body.isActive, updatedAt: new Date().toISOString() })
      .where(inArray(users.id, body.ids))
      .returning({ id: users.id, isActive: users.isActive });

    return { updated: updated.length, isActive: body.isActive };
  });
};

export default batchRoutes;
