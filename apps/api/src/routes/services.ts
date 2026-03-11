import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { services } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { CreateServiceSchema, UpdateServiceSchema } from "@pristav/shared";

const servicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/services", async () => {
    return db.select().from(services).where(eq(services.isActive, true));
  });

  fastify.get<{ Params: { id: string } }>("/services/:id", async (request, reply) => {
    const [s] = await db.select().from(services).where(eq(services.id, parseInt(request.params.id))).limit(1);
    if (!s) return reply.code(404).send({ error: "Not found" });
    return s;
  });

  fastify.post("/services", async (request, reply) => {
    if (!["ADMIN"].includes(request.auth!.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const result = CreateServiceSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: result.error.flatten() });
    const [created] = await db.insert(services).values(result.data).returning();
    reply.code(201);
    return created;
  });

  fastify.patch<{ Params: { id: string } }>("/services/:id", async (request, reply) => {
    if (!["ADMIN"].includes(request.auth!.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const result = UpdateServiceSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: result.error.flatten() });
    const [updated] = await db.update(services)
      .set({ ...result.data, updatedAt: new Date().toISOString() })
      .where(eq(services.id, parseInt(request.params.id)))
      .returning();
    return updated;
  });

  fastify.delete<{ Params: { id: string } }>("/services/:id", async (request, reply) => {
    if (!["ADMIN"].includes(request.auth!.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    await db.update(services)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(services.id, parseInt(request.params.id)));
    return { ok: true };
  });
};

export default servicesRoutes;
