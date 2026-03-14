/**
 * Credit requests — clients submit requests for credit top-ups.
 * Reception/Admin can approve or reject them.
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { creditRequests, creditTransactions, users, notifications } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

const creditRequestRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /credit-requests — list (admin/reception: all; client: own)
  fastify.get("/credit-requests", async (request) => {
    const { id, role } = request.auth!;
    if (role === "CLIENT") {
      return db.select().from(creditRequests)
        .where(eq(creditRequests.clientId, id))
        .orderBy(desc(creditRequests.createdAt));
    }
    if (["ADMIN", "RECEPTION"].includes(role)) {
      const rows = await db.select().from(creditRequests).orderBy(desc(creditRequests.createdAt));
      // Join with users to get client names
      const withClients = await Promise.all(
        rows.map(async (r) => {
          const [client] = await db.select({ name: users.name, email: users.email })
            .from(users).where(eq(users.id, r.clientId)).limit(1);
          return { ...r, clientName: client?.name ?? "?", clientEmail: client?.email ?? "" };
        })
      );
      return withClients;
    }
    return [];
  });

  // POST /credit-requests — client submits a new request
  fastify.post("/credit-requests", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") return reply.code(403).send({ error: "Only clients can submit credit requests" });

    const body = request.body as { amount: number; note?: string };
    if (!body.amount || body.amount <= 0 || body.amount > 10_000) {
      return reply.code(400).send({ error: "Neplatná částka (1–10 000)" });
    }

    const [req] = await db.insert(creditRequests).values({
      clientId: id,
      amount: body.amount,
      note: body.note ?? null,
    }).returning();

    reply.code(201);
    return req;
  });

  // PATCH /credit-requests/:id — approve or reject (admin/reception only)
  fastify.patch<{ Params: { id: string } }>("/credit-requests/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const requestId = parseInt(request.params.id);
    const [creditReq] = await db.select().from(creditRequests)
      .where(eq(creditRequests.id, requestId)).limit(1);

    if (!creditReq) return reply.code(404).send({ error: "Not found" });
    if (creditReq.status !== "PENDING") {
      return reply.code(409).send({ error: "Request already processed" });
    }

    const body = request.body as { action: "APPROVED" | "REJECTED"; reviewNote?: string };
    if (!["APPROVED", "REJECTED"].includes(body.action)) {
      return reply.code(400).send({ error: "action must be APPROVED or REJECTED" });
    }

    const now = new Date().toISOString();

    // Update the request
    const [updated] = await db.update(creditRequests)
      .set({
        status: body.action,
        reviewedBy: userId,
        reviewNote: body.reviewNote ?? null,
        reviewedAt: now,
      })
      .where(eq(creditRequests.id, requestId))
      .returning();

    if (body.action === "APPROVED") {
      // Add credit transaction
      const [lastTx] = await db.select({ balance: creditTransactions.balance })
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, creditReq.clientId))
        .orderBy(desc(creditTransactions.id))
        .limit(1);

      const prevBalance = lastTx?.balance ?? 0;
      const newBalance = prevBalance + creditReq.amount;

      await db.insert(creditTransactions).values({
        userId: creditReq.clientId,
        type: "PURCHASE",
        amount: creditReq.amount,
        balance: newBalance,
        note: `Schválení žádosti o kredit #${requestId}${body.reviewNote ? `: ${body.reviewNote}` : ""}`,
      });

      // Notify client
      await db.insert(notifications).values({
        userId: creditReq.clientId,
        type: "GENERAL",
        title: "Kredit přidán",
        message: `Vaše žádost o ${creditReq.amount} kreditů byla schválena.`,
      });
    } else {
      // Notify client about rejection
      await db.insert(notifications).values({
        userId: creditReq.clientId,
        type: "GENERAL",
        title: "Žádost o kredit zamítnuta",
        message: `Vaše žádost o ${creditReq.amount} kreditů byla zamítnuta.${body.reviewNote ? ` Důvod: ${body.reviewNote}` : ""}`,
      });
    }

    return updated;
  });

  // DELETE /credit-requests/:id — client can cancel a PENDING request
  fastify.delete<{ Params: { id: string } }>("/credit-requests/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const requestId = parseInt(request.params.id);

    const [creditReq] = await db.select().from(creditRequests)
      .where(eq(creditRequests.id, requestId)).limit(1);

    if (!creditReq) return reply.code(404).send({ error: "Not found" });
    if (role === "CLIENT" && creditReq.clientId !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    if (creditReq.status !== "PENDING") {
      return reply.code(409).send({ error: "Can only cancel pending requests" });
    }

    await db.delete(creditRequests).where(eq(creditRequests.id, requestId));
    reply.code(204);
    return;
  });
};

export default creditRequestRoutes;
