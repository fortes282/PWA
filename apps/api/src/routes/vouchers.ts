import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { giftVouchers, creditTransactions } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateVoucherCode(): string {
  return randomBytes(6).toString("hex").toUpperCase().slice(0, 12);
}

const vouchersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /vouchers — list all (ADMIN/RECEPTION), with pagination
  fastify.get("/vouchers", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { page?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "50"), 1), 200);
    const page = Math.max(parseInt(q.page ?? "1"), 1);
    const offset = (page - 1) * limit;

    const all = await db.select().from(giftVouchers).orderBy(desc(giftVouchers.id));
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

  // POST /vouchers — create voucher (ADMIN/RECEPTION)
  fastify.post("/vouchers", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      amount: number;
      recipientName: string;
      recipientEmail?: string;
      message?: string;
      expiresAt?: string;
    };

    if (!body.amount || body.amount <= 0) {
      return reply.code(400).send({ error: "Amount must be positive" });
    }
    if (!body.recipientName) {
      return reply.code(400).send({ error: "recipientName is required" });
    }

    const code = generateVoucherCode();
    const expiresAt = body.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const [voucher] = await db.insert(giftVouchers).values({
      code,
      amount: body.amount,
      purchasedBy: id,
      recipientName: body.recipientName,
      recipientEmail: body.recipientEmail ?? null,
      message: body.message ?? null,
      expiresAt,
    }).returning();

    reply.code(201);
    return voucher;
  });

  // GET /vouchers/:id — detail (ADMIN/RECEPTION)
  fastify.get<{ Params: { id: string } }>("/vouchers/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const voucherId = parseInt(request.params.id);
    const [voucher] = await db.select().from(giftVouchers)
      .where(eq(giftVouchers.id, voucherId)).limit(1);

    if (!voucher) {
      return reply.code(404).send({ error: "Voucher not found" });
    }

    return voucher;
  });

  // POST /vouchers/:code/redeem — redeem voucher by code (CLIENT)
  fastify.post<{ Params: { code: string } }>("/vouchers/:code/redeem", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") {
      return reply.code(403).send({ error: "Only clients can redeem vouchers" });
    }

    const code = request.params.code;
    const [voucher] = await db.select().from(giftVouchers)
      .where(eq(giftVouchers.code, code)).limit(1);

    if (!voucher) {
      return reply.code(404).send({ error: "Voucher not found" });
    }
    if (voucher.status !== "ACTIVE") {
      return reply.code(400).send({ error: "Voucher is not active" });
    }
    if (new Date(voucher.expiresAt) < new Date()) {
      return reply.code(400).send({ error: "Voucher has expired" });
    }

    // Mark voucher as redeemed
    await db.update(giftVouchers)
      .set({ redeemedBy: id, redeemedAt: new Date().toISOString(), status: "REDEEMED" })
      .where(eq(giftVouchers.id, voucher.id));

    // Add credits to user
    const lastTx = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, id))
      .orderBy(desc(creditTransactions.id))
      .limit(1);
    const currentBalance = lastTx[0]?.balance ?? 0;

    await db.insert(creditTransactions).values({
      userId: id,
      type: "PURCHASE",
      amount: voucher.amount,
      balance: currentBalance + voucher.amount,
      note: `Voucher redeemed: ${code}`,
    });

    return { ok: true, credited: voucher.amount, newBalance: currentBalance + voucher.amount };
  });

  // GET /vouchers/check/:code — check if code is valid (PUBLIC — no auth required)
  fastify.get<{ Params: { code: string } }>("/vouchers/check/:code", async (request, reply) => {
    const code = request.params.code;
    const [voucher] = await db.select().from(giftVouchers)
      .where(eq(giftVouchers.code, code)).limit(1);

    if (!voucher) {
      return reply.code(404).send({ error: "Voucher not found", valid: false });
    }

    const expired = new Date(voucher.expiresAt) < new Date();
    const valid = voucher.status === "ACTIVE" && !expired;

    return {
      valid,
      code: voucher.code,
      amount: valid ? voucher.amount : undefined,
      currency: valid ? voucher.currency : undefined,
      status: voucher.status,
      expired,
    };
  });
};

export default vouchersRoutes;
