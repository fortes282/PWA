import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { waitlist, users, notifications } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { CreateWaitlistEntrySchema } from "@pristav/shared";
import { waitlistSchemas, waitlistExtSchemas } from "../utils/swagger-schemas.js";

const waitlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/waitlist", { schema: waitlistSchemas.list }, async (request) => {
    const { id, role } = request.auth!;
    if (role === "CLIENT") {
      return db.select().from(waitlist).where(eq(waitlist.clientId, id));
    }
    return db.select().from(waitlist);
  });

  fastify.post("/waitlist", { schema: waitlistSchemas.create }, async (request, reply) => {
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
  fastify.get("/waitlist/stats", { schema: waitlistExtSchemas.stats }, async (request, reply) => {
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
  fastify.get("/waitlist/suggestions", { schema: waitlistExtSchemas.suggestions }, async (request, reply) => {
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
  /**
   * POST /waitlist/:id/notify — notify waitlist client about available slot (RECEPTION/ADMIN)
   * Creates in-app notification + optionally sends email
   */
  fastify.post<{ Params: { id: string } }>("/waitlist/:id/notify", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const entryId = parseInt(request.params.id, 10);
    if (isNaN(entryId)) return reply.code(400).send({ error: "Neplatné ID" });

    const [entry] = await db.select().from(waitlist).where(eq(waitlist.id, entryId)).limit(1);
    if (!entry) return reply.code(404).send({ error: "Záznam na waitlistu nenalezen" });
    if (entry.status !== "WAITING") {
      return reply.code(400).send({ error: "Klient již není na čekacím listu (status: " + entry.status + ")" });
    }

    const [client] = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, entry.clientId)).limit(1);
    if (!client) return reply.code(404).send({ error: "Klient nenalezen" });

    // Create in-app notification
    await db.insert(notifications).values({
      userId: client.id,
      title: "Volný termín — waitlist",
      message: "Dobrá zpráva! Uvolnil se termín, který jste čekali. Přihlaste se prosím a rezervujte si místo.",
      type: "WAITLIST_AVAILABLE",
      isRead: false,
    });

    // Mark as NOTIFIED
    await db.update(waitlist).set({ status: "NOTIFIED" }).where(eq(waitlist.id, entryId));

    // Send email if configured
    try {
      const { sendEmail } = await import("../services/email.js");
      await sendEmail({
        to: client.email,
        subject: "Volný termín — Přístav Radosti",
        html: `<p>Dobrý den, ${client.name},</p><p>Uvolnil se termín, který jste čekali. Přihlaste se prosím do aplikace a rezervujte si místo.</p><p>S pozdravem,<br>Přístav Radosti</p>`,
        text: `Dobrý den, ${client.name},\n\nUvolnil se termín, který jste čekali.\n\nPřihlaste se prosím do aplikace.\n\nPřístav Radosti`,
      });
    } catch {
      // Email sending failure is non-critical
    }

    return { ok: true, clientName: client.name, status: "NOTIFIED" };
  });

  // POST /waitlist/auto-offer — SHOULD #10: manual trigger for auto-offer job
  fastify.post("/waitlist/auto-offer", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { runWaitlistAutoOffer } = await import("../services/waitlist-auto-offer.js");
    const logShim = {
      info: (m: string, d?: unknown) => fastify.log.info({ data: d }, m),
      error: (m: string, e?: unknown) => fastify.log.error({ err: e }, m),
    };

    const results = await runWaitlistAutoOffer(logShim);
    const notified = results.filter((r) => r.notifiedClientId !== null).length;

    return {
      ok: true,
      checked: results.length,
      notified,
      results,
    };
  });
};

export default waitlistRoutes;
