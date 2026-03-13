import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { creditTransactions } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

const creditsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /credits/balance — current user balance
  fastify.get("/credits/balance", async (request) => {
    const userId = request.auth!.id;
    const transactions = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id))
      .limit(1);
    return { balance: transactions[0]?.balance ?? 0 };
  });

  // GET /credits/balance/:userId — admin/reception only
  fastify.get<{ Params: { userId: string } }>("/credits/balance/:userId", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const userId = parseInt(request.params.userId);
    const transactions = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id))
      .limit(1);
    return { userId, balance: transactions[0]?.balance ?? 0 };
  });

  // GET /credits/transactions
  fastify.get("/credits/transactions", async (request) => {
    const { id, role } = request.auth!;
    const q = request.query as { userId?: string };

    let userId = id;
    if (q.userId && ["ADMIN", "RECEPTION"].includes(role)) {
      userId = parseInt(q.userId);
    }

    return db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id));
  });

  // GET /credits/history — alias for /credits/transactions
  fastify.get("/credits/history", async (request) => {
    const { id, role } = request.auth!;
    const q = request.query as { userId?: string };

    let userId = id;
    if (q.userId && ["ADMIN", "RECEPTION"].includes(role)) {
      userId = parseInt(q.userId);
    }

    return db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id));
  });

  // POST /credits/request — Client requests credit topup
  fastify.post("/credits/request", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") return reply.code(403).send({ error: "Only clients can request topup" });

    const { amount, label } = request.body as { amount: number; label: string };

    // Get current user info
    const { users } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    // Create notification for reception/admin
    const { notifications } = await import("../db/schema.js");
    const receptionUsers = await db.select().from(users).where(eq(users.role, "RECEPTION" as any));
    const adminUsers = await db.select().from(users).where(eq(users.role, "ADMIN" as any));

    for (const staff of [...receptionUsers, ...adminUsers]) {
      await db.insert(notifications).values({
        userId: staff.id,
        type: "GENERAL",
        title: "Žádost o nabití kreditů",
        message: `${user?.name ?? `Klient #${id}`} žádá o nabití kreditů: ${label} (${amount} Kč)`,
      });
    }

    reply.code(201);
    return { ok: true };
  });

  // POST /credits/adjust — Admin/Reception only
  fastify.post("/credits/adjust", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { userId, amount, type, note } = request.body as {
      userId: number;
      amount: number;
      type: "PURCHASE" | "REFUND" | "ADJUSTMENT";
      note?: string;
    };

    // Get current balance
    const [last] = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id))
      .limit(1);

    const balance = (last?.balance ?? 0) + amount;

    const [tx] = await db.insert(creditTransactions).values({
      userId,
      type,
      amount,
      balance,
      note: note ?? null,
    }).returning();

    reply.code(201);
    return tx;
  });
};

export default creditsRoutes;
