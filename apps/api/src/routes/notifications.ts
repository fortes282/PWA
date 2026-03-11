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
};

export default notificationsRoutes;
