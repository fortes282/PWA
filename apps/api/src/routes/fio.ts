/**
 * FIO Bank matching — správa bankovních transakcí a párování s fakturami.
 * V produkci by se zde volala FIO API (GET /v1/rest/last/{token}/transactions.json).
 * Tato route poskytuje CRUD pro manuální import + párování.
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { fioTransactions, invoices, users } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";

const fioRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /fio/transactions — list all FIO transactions
  fastify.get("/fio/transactions", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { unmatched?: string };
    let all = await db.select().from(fioTransactions).orderBy(fioTransactions.transactionDate);

    if (q.unmatched === "true") {
      all = all.filter((t) => !t.isMatched);
    }

    // Enrich with matched invoice/client info
    const allInvoices = await db.select().from(invoices);
    const allUsers_ = await db.select({ id: users.id, name: users.name }).from(users);

    const invMap = Object.fromEntries(allInvoices.map((i) => [i.id, i]));
    const userMap = Object.fromEntries(allUsers_.map((u) => [u.id, u.name]));

    return all.map((t) => ({
      ...t,
      matchedInvoice: t.matchedInvoiceId ? invMap[t.matchedInvoiceId] : null,
      matchedClientName: t.matchedClientId ? userMap[t.matchedClientId] : null,
    }));
  });

  // POST /fio/transactions — manually add FIO transaction
  fastify.post("/fio/transactions", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      fioId: string;
      amount: number;
      currency?: string;
      variableSymbol?: string;
      note?: string;
      counterAccount?: string;
      counterName?: string;
      transactionDate: string;
    };

    // Check duplicate
    const existing = await db.select().from(fioTransactions)
      .where(eq(fioTransactions.fioId, body.fioId)).limit(1);
    if (existing.length > 0) {
      return reply.code(409).send({ error: "Transaction already exists" });
    }

    const [tx] = await db.insert(fioTransactions).values({
      fioId: body.fioId,
      amount: body.amount,
      currency: body.currency ?? "CZK",
      variableSymbol: body.variableSymbol ?? null,
      note: body.note ?? null,
      counterAccount: body.counterAccount ?? null,
      counterName: body.counterName ?? null,
      transactionDate: body.transactionDate,
    }).returning();

    // Auto-match by variable symbol (invoice number suffix)
    if (body.variableSymbol) {
      const matchedInvoice = (await db.select().from(invoices)).find(
        (i) => i.invoiceNumber.endsWith(body.variableSymbol!) || i.invoiceNumber === body.variableSymbol
      );
      if (matchedInvoice) {
        await db.update(fioTransactions).set({
          matchedInvoiceId: matchedInvoice.id,
          matchedClientId: matchedInvoice.clientId,
          isMatched: true,
        }).where(eq(fioTransactions.id, tx.id));

        // Mark invoice as paid if amount matches
        if (Math.abs(tx.amount - matchedInvoice.total) < 1) {
          await db.update(invoices).set({
            status: "PAID",
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).where(eq(invoices.id, matchedInvoice.id));
        }
      }
    }

    reply.code(201);
    return tx;
  });

  // PATCH /fio/transactions/:id/match — manual match
  fastify.patch<{ Params: { id: string } }>("/fio/transactions/:id/match", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const txId = parseInt(request.params.id);
    const { invoiceId } = request.body as { invoiceId: number };

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!invoice) return reply.code(404).send({ error: "Invoice not found" });

    await db.update(fioTransactions).set({
      matchedInvoiceId: invoiceId,
      matchedClientId: invoice.clientId,
      isMatched: true,
    }).where(eq(fioTransactions.id, txId));

    const [tx] = await db.select().from(fioTransactions)
      .where(eq(fioTransactions.id, txId)).limit(1);
    return tx;
  });

  // PATCH /fio/transactions/:id/unmatch
  fastify.patch<{ Params: { id: string } }>("/fio/transactions/:id/unmatch", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    await db.update(fioTransactions).set({
      matchedInvoiceId: null,
      matchedClientId: null,
      isMatched: false,
    } as any).where(eq(fioTransactions.id, parseInt(request.params.id)));

    return { ok: true };
  });

  // GET /fio/summary — stats for admin dashboard
  fastify.get("/fio/summary", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const all = await db.select().from(fioTransactions);
    const total = all.reduce((s, t) => s + t.amount, 0);
    const matched = all.filter((t) => t.isMatched);
    const unmatched = all.filter((t) => !t.isMatched);

    return {
      totalTransactions: all.length,
      totalAmount: total,
      matchedCount: matched.length,
      matchedAmount: matched.reduce((s, t) => s + t.amount, 0),
      unmatchedCount: unmatched.length,
      unmatchedAmount: unmatched.reduce((s, t) => s + t.amount, 0),
    };
  });
};

export default fioRoutes;
