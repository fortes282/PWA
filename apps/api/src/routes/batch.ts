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

const batchRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /batch/appointments/status — set same status on multiple appointments
  fastify.post("/batch/appointments/status", async (request, reply) => {
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

    const validStatuses = ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW", "PENDING"];
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
  fastify.post("/batch/notifications", async (request, reply) => {
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
};

export default batchRoutes;
