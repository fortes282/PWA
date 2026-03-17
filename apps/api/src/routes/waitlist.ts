import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { waitlist, users } from "../db/schema.js";
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

  // GET /waitlist/suggestions?serviceId=N — top waiting clients for a given service
  fastify.get("/waitlist/suggestions", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { serviceId?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "10"), 1), 50);

    let all = await db.select().from(waitlist);
    all = all.filter((w) => w.status === "WAITING");
    if (q.serviceId) {
      all = all.filter((w) => w.serviceId === parseInt(q.serviceId!));
    }

    // Sort by waiting longest (oldest first)
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const top = all.slice(0, limit);

    // Enrich with client names
    const clientIds = [...new Set(top.map((w) => w.clientId))];
    const clientList = clientIds.length > 0
      ? await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
          .from(users)
          .where(eq(users.id, clientIds[0])) // drizzle inArray not available, iterate
      : [];

    // Simple enrichment
    const clientMap: Record<number, any> = {};
    for (const cid of clientIds) {
      const [c] = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
        .from(users).where(eq(users.id, cid)).limit(1);
      if (c) clientMap[cid] = c;
    }

    return top.map((w) => ({
      ...w,
      clientName: clientMap[w.clientId]?.name,
      clientEmail: clientMap[w.clientId]?.email,
      clientPhone: clientMap[w.clientId]?.phone,
    }));
  });
};

export default waitlistRoutes;
