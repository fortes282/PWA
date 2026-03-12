import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/notifications", async (request) => {
    return db.select().from(notifications)
      .where(eq(notifications.userId, request.auth!.id));
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

  // DELETE /notifications/:id — delete notification
  fastify.delete<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    const { id: userId } = request.auth!;
    const notifId = parseInt(request.params.id);

    const [notif] = await db.select().from(notifications)
      .where(eq(notifications.id, notifId)).limit(1);
    if (!notif) return reply.code(404).send({ error: "Not found" });
    if (notif.userId !== userId) return reply.code(403).send({ error: "Forbidden" });

    await db.delete(notifications).where(eq(notifications.id, notifId));
    return { ok: true };
  });
};

export default notificationsRoutes;
