import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { creditTransactions } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

import { logAudit } from "./audit.js";

const creditsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /credits/balance — current user balance (CLIENT only)
  fastify.get("/credits/balance", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (role !== "CLIENT") {
      return reply.code(403).send({ error: "Credits are only available for clients" });
    }
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

  // GET /credits/transactions (CLIENT: own, ADMIN/RECEPTION: any via ?userId=)
  fastify.get("/credits/transactions", async (request, reply) => {
    const { id, role } = request.auth!;
    const q = request.query as { userId?: string };

    let userId = id;
    if (q.userId && ["ADMIN", "RECEPTION"].includes(role)) {
      userId = parseInt(q.userId);
    } else if (role !== "CLIENT" && !q.userId) {
      return reply.code(403).send({ error: "Credits are only available for clients" });
    }

    return db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.id));
  });

  // GET /credits/history — paginated credit history (CLIENT: own, ADMIN/RECEPTION: any via ?userId=)
  fastify.get("/credits/history", async (request, reply) => {
    const { id, role } = request.auth!;
    const q = request.query as { userId?: string; page?: string; limit?: string };

    let userId = id;
    if (q.userId && ["ADMIN", "RECEPTION"].includes(role)) {
      userId = parseInt(q.userId);
    } else if (role !== "CLIENT" && !q.userId) {
      return reply.code(403).send({ error: "Credits are only available for clients" });
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
  // ── Bulk credit payment: preview ─────────────────────────────────────────
  fastify.get("/credits/bulk-pay/preview", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const q = request.query as { clientId?: string };
    if (!q.clientId) return reply.code(400).send({ error: "clientId query param required" });

    const clientId = parseInt(q.clientId);

    // Find COMPLETED appointments where paidAt IS NULL
    const unpaid = rawSqlite.prepare(`
      SELECT a.id, a.start_time, a.price, a.service_id,
             s.name AS service_name, s.price AS service_price
      FROM appointments a
      INNER JOIN services s ON s.id = a.service_id
      WHERE a.client_id = ? AND a.status = 'COMPLETED' AND a.paid_at IS NULL
      ORDER BY a.start_time ASC
    `).all(clientId) as any[];

    const totalAmount = unpaid.reduce((s: number, a: any) => s + (a.price ?? a.service_price), 0);

    // Get current credit balance
    const lastTx = rawSqlite.prepare(
      `SELECT balance FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
    ).get(clientId) as { balance: number } | undefined;
    const creditBalance = lastTx?.balance ?? 0;

    return {
      clientId,
      creditBalance,
      totalAmount,
      sufficientBalance: creditBalance >= totalAmount,
      appointments: unpaid.map((a: any) => ({
        id: a.id,
        startTime: a.start_time,
        serviceName: a.service_name,
        price: a.price ?? a.service_price,
      })),
    };
  });

  // ── Bulk credit payment: execute ───────────────────────────────────────────
  fastify.post("/credits/bulk-pay", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as { clientId?: number };

    // Determine which clients to process
    let clientIds: number[];
    if (body.clientId) {
      clientIds = [body.clientId];
    } else {
      const clients = rawSqlite.prepare(`
        SELECT DISTINCT client_id FROM appointments
        WHERE status = 'COMPLETED' AND paid_at IS NULL
      `).all() as { client_id: number }[];
      clientIds = clients.map((c) => c.client_id);
    }

    const results: any[] = [];
    const now = new Date().toISOString();

    const txn = rawSqlite.transaction(() => {
      for (const clientId of clientIds) {
        // Find unpaid completed appointments
        const unpaid = rawSqlite.prepare(`
          SELECT a.id, a.price, a.service_id, s.price AS service_price
          FROM appointments a
          INNER JOIN services s ON s.id = a.service_id
          WHERE a.client_id = ? AND a.status = 'COMPLETED' AND a.paid_at IS NULL
          ORDER BY a.start_time ASC
        `).all(clientId) as any[];

        if (unpaid.length === 0) continue;

        const totalAmount = unpaid.reduce((s: number, a: any) => s + (a.price ?? a.service_price), 0);

        // Get current balance
        const lastTx = rawSqlite.prepare(
          `SELECT balance FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
        ).get(clientId) as { balance: number } | undefined;
        const currentBalance = lastTx?.balance ?? 0;

        if (currentBalance < totalAmount) {
          results.push({
            clientId,
            error: `Insufficient balance: ${currentBalance} < ${totalAmount}`,
            paid: 0,
          });
          continue;
        }

        // Deduct from credit balance
        const newBalance = currentBalance - totalAmount;
        rawSqlite.prepare(`
          INSERT INTO credit_transactions (user_id, type, amount, balance, note, created_at)
          VALUES (?, 'USE', ?, ?, ?, ?)
        `).run(clientId, -totalAmount, newBalance, `Hromadná úhrada ${unpaid.length} terapií`, now);

        // Mark appointments as paid
        for (const a of unpaid) {
          rawSqlite.prepare(`
            UPDATE appointments SET paid_at = ?, payment_method = 'CREDIT', updated_at = ? WHERE id = ?
          `).run(now, now, a.id);
        }

        results.push({
          clientId,
          paid: unpaid.length,
          totalAmount,
          newBalance,
        });
      }
    });

    txn();

    logAudit(db, request.auth!.id, "BULK_CREDIT_PAYMENT", {
      details: JSON.stringify({ clientCount: results.length }),
    });

    return { results };
  });

  // GET /credits/stats — summary stats for current user's credit account (CLIENT only)
  fastify.get("/credits/stats", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (role !== "CLIENT") {
      return reply.code(403).send({ error: "Credits are only available for clients" });
    }
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
