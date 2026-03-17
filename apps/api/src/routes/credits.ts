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

  // GET /credits/history — paginated credit history (page/limit query params)
  fastify.get("/credits/history", async (request) => {
    const { id, role } = request.auth!;
    const q = request.query as { userId?: string; page?: string; limit?: string };

    let userId = id;
    if (q.userId && ["ADMIN", "RECEPTION"].includes(role)) {
      userId = parseInt(q.userId);
    }

    const limit = Math.min(Math.max(parseInt(q.limit ?? "50"), 1), 200);
    const page = Math.max(parseInt(q.page ?? "1"), 1);
    const offset = (page - 1) * limit;

    // Count total for pagination metadata
    const all = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id));

    const total = all.length;
    const items = all.slice(offset, offset + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    };
  });

  // GET /credits/summary/:userId — admin/reception: complete credit summary
  fastify.get<{ Params: { userId: string } }>("/credits/summary/:userId", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const userId = parseInt(request.params.userId);
    const txns = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id));

    const balance = txns[0]?.balance ?? 0;
    const totalPurchased = txns.filter((t) => t.type === "PURCHASE").reduce((s, t) => s + t.amount, 0);
    const totalUsed = Math.abs(txns.filter((t) => t.type === "USE").reduce((s, t) => s + t.amount, 0));
    const totalRefunded = txns.filter((t) => t.type === "REFUND").reduce((s, t) => s + t.amount, 0);
    const totalAdjusted = txns.filter((t) => t.type === "ADJUSTMENT").reduce((s, t) => s + t.amount, 0);

    return {
      userId,
      balance,
      totalTransactions: txns.length,
      totalPurchased,
      totalUsed,
      totalRefunded,
      totalAdjusted,
      recentTransactions: txns.slice(0, 10),
    };
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
  // GET /credits/stats — summary stats for current user's credit account
  fastify.get("/credits/stats", async (request) => {
    const { id: userId } = request.auth!;
    const txs = await db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId));

    const totalIn = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = txs.length > 0 ? txs.sort((a, b) => b.id - a.id)[0].balance : 0;

    return {
      balance,
      totalIn,
      totalOut,
      transactionCount: txs.length,
    };
  });
};

export default creditsRoutes;
