import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { rooms } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { CreateRoomSchema, UpdateRoomSchema } from "@pristav/shared";

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/rooms", async () => {
    return db.select().from(rooms).where(eq(rooms.isActive, true));
  });

  fastify.post("/rooms", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const result = CreateRoomSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: result.error.flatten() });
    const [created] = await db.insert(rooms).values(result.data).returning();
    reply.code(201);
    return created;
  });

  fastify.patch<{ Params: { id: string } }>("/rooms/:id", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const result = UpdateRoomSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: result.error.flatten() });
    const [updated] = await db.update(rooms)
      .set({ ...result.data, updatedAt: new Date().toISOString() })
      .where(eq(rooms.id, parseInt(request.params.id)))
      .returning();
    return updated;
  });

  fastify.delete<{ Params: { id: string } }>("/rooms/:id", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    await db.update(rooms)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(rooms.id, parseInt(request.params.id)));
    return { ok: true };
  });
};

export default roomsRoutes;
