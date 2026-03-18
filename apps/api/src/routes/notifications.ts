import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

import { notificationSchemas } from "../utils/swagger-schemas.js";

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/notifications", { schema: notificationSchemas.list }, async (request) => {
    return db.select().from(notifications)
      .where(eq(notifications.userId, request.auth!.id));
  });

  // GET /notifications/unread-count — lightweight: returns { count: N }
  fastify.get("/notifications/unread-count", async (request) => {
    const all = await db.select().from(notifications)
      .where(and(eq(notifications.userId, request.auth!.id), eq(notifications.isRead, false)));
    return { count: all.length };
  });

  fastify.post<{ Params: { id: string } }>("/notifications/:id/read", async (request) => {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, parseInt(request.params.id)),
        eq(notifications.userId, request.auth!.id),
      ));
    return { ok: true };
  });

  fastify.post("/notifications/read-all", async (request) => {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, request.auth!.id));
    return { ok: true };
  });

  // POST /notifications — create notification (ADMIN/RECEPTION only)
  fastify.post("/notifications", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      userId: number;
      type: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    };

    const [notification] = await db.insert(notifications).values({
      userId: body.userId,
      type: body.type as any,
      title: body.title,
      message: body.message,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    }).returning();

    reply.code(201);
    return notification;
  });

  // POST /notifications/bulk — create multiple notifications at once (ADMIN/RECEPTION)
  fastify.post("/notifications/bulk", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      userIds: number[];
      type: string;
      title: string;
      message: string;
    };

    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      return reply.code(400).send({ error: "userIds must be a non-empty array" });
    }

    const created = [];
    for (const userId of body.userIds) {
      const [n] = await db.insert(notifications).values({
        userId,
        type: body.type as any,
        title: body.title,
        message: body.message,
      }).returning();
      created.push(n);
    }

    reply.code(201);
    return { sent: created.length, notifications: created };
  });

  // DELETE /notifications/clear-read — delete all read notifications for current user
  fastify.delete("/notifications/clear-read", async (request) => {
    const { id: userId } = request.auth!;
    await db.delete(notifications).where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, true))
    );
    return { ok: true };
  });

  // PATCH /notifications/mark-all-read — mark all as read for current user
  fastify.patch("/notifications/mark-all-read", async (request) => {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, request.auth!.id));
    return { ok: true };
  });

  // DELETE /notifications/:id — delete notification
  fastify.delete<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    const { id: userId } = request.auth!;
    const notifId = parseInt(request.params.id);

    const [notif] = await db.select().from(notifications)
      .where(eq(notifications.id, notifId)).limit(1);
    if (!notif) return reply.code(404).send({ error: "Not found" });
    const { role } = request.auth!;
    if (notif.userId !== userId && role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    await db.delete(notifications).where(eq(notifications.id, notifId));
    return { ok: true };
  });
};

export default notificationsRoutes;
