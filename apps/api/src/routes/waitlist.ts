import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { waitlist } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { CreateWaitlistEntrySchema } from "@pristav/shared";

const waitlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/waitlist", async (request) => {
    const { id, role } = request.auth!;
    if (role === "CLIENT") {
      return db.select().from(waitlist).where(eq(waitlist.clientId, id));
    }
    return db.select().from(waitlist);
  });

  fastify.post("/waitlist", async (request, reply) => {
    const { id, role } = request.auth!;
    const result = CreateWaitlistEntrySchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: result.error.flatten() });

    const clientId = role === "CLIENT" ? id : (request.body as any).clientId ?? id;
    const [entry] = await db.insert(waitlist).values({
      clientId,
      serviceId: result.data.serviceId,
      employeeId: result.data.employeeId ?? null,
      preferredDates: result.data.preferredDates ? JSON.stringify(result.data.preferredDates) : null,
    }).returning();

    reply.code(201);
    return entry;
  });

  fastify.delete<{ Params: { id: string } }>("/waitlist/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const entryId = parseInt(request.params.id);

    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, entryId)).limit(1);
    if (!entry) return reply.code(404).send({ error: "Not found" });
    if (role === "CLIENT" && entry.clientId !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    await db.update(waitlist)
      .set({ status: "CANCELLED", updatedAt: new Date().toISOString() })
      .where(eq(waitlist.id, entryId));

    return { ok: true };
  });
};

export default waitlistRoutes;
