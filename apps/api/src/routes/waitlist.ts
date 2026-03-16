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

  fastify.patch<{ Params: { id: string } }>("/waitlist/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const entryId = parseInt(request.params.id);

    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, entryId)).limit(1);
    if (!entry) return reply.code(404).send({ error: "Not found" });
    if (role === "CLIENT" && entry.clientId !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as Partial<{ status: string; notifiedAt: string }>;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.status) updates.status = body.status;
    if (body.status === "NOTIFIED" && !body.notifiedAt) {
      updates.notifiedAt = new Date().toISOString();
    }

    const [updated] = await db.update(waitlist)
      .set(updates as any)
      .where(eq(waitlist.id, entryId))
      .returning();

    return updated;
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

  // GET /waitlist/stats — waitlist statistics (ADMIN/RECEPTION)
  fastify.get("/waitlist/stats", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const all = await db.select().from(waitlist);

    return {
      total: all.length,
      waiting: all.filter((w) => w.status === "WAITING").length,
      notified: all.filter((w) => w.status === "NOTIFIED").length,
      booked: all.filter((w) => w.status === "BOOKED").length,
      cancelled: all.filter((w) => w.status === "CANCELLED").length,
      byService: Object.fromEntries(
        Object.entries(
          all.reduce((acc: Record<number, number>, w) => {
            acc[w.serviceId] = (acc[w.serviceId] ?? 0) + 1;
            return acc;
          }, {})
        ).sort(([, a], [, b]) => b - a)
      ),
    };
  });
};

export default waitlistRoutes;
