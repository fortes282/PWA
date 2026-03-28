/**
 * FIO Bank matching — správa bankovních transakcí a párování s fakturami.
 * V produkci by se zde volala FIO API (GET /v1/rest/last/{token}/transactions.json).
 * Tato route poskytuje CRUD pro manuální import + párování.
 */
import type { FastifyPluginAsync } from "fastify";
import { fioSchemas } from "../utils/swagger-schemas.js";
import { db, rawSqlite } from "../db/index.js";
import { fioTransactions, invoices, users, insuranceBatches, insuranceClaims } from "../db/schema.js";
import { eq, and, isNull, inArray } from "drizzle-orm";

const fioRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /fio/transactions — list all FIO transactions
  fastify.get("/fio/transactions", { schema: fioSchemas.list }, async (request, reply) => {
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
  fastify.post("/fio/transactions", { schema: fioSchemas.create }, async (request, reply) => {
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
      const allInvoices = await db.select().from(invoices);
      const matchedInvoice = allInvoices.find(
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
          const now = new Date().toISOString();
          await db.update(invoices).set({
            status: "PAID",
            paidAt: now,
            updatedAt: now,
          }).where(eq(invoices.id, matchedInvoice.id));

          // Foundation invoice auto-credit: notify staff + create credit
          if (matchedInvoice.invoiceType === "FOUNDATION_INVOICE" && matchedInvoice.status !== "PAID") {
            const message = `Faktura z nadace ${matchedInvoice.invoiceNumber} byla proplacena (${matchedInvoice.total} Kč). Připište kredit klientovi.`;

            // Notify RECEPTION users
            const receptionUsers = rawSqlite.prepare(
              `SELECT id FROM users WHERE role = 'RECEPTION' AND is_active = 1`
            ).all() as { id: number }[];
            for (const u of receptionUsers) {
              rawSqlite.prepare(`
                INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
                VALUES (?, 'INVOICE', ?, ?, 0, ?)
              `).run(u.id, "Faktura z nadace proplacena", message, now);
            }

            // Notify ADMIN users
            const adminUsers = rawSqlite.prepare(
              `SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1`
            ).all() as { id: number }[];
            for (const u of adminUsers) {
              rawSqlite.prepare(`
                INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
                VALUES (?, 'INVOICE', ?, ?, 0, ?)
              `).run(u.id, "Faktura z nadace proplacena", message, now);
            }

            // Create credit_transactions entry
            const lastTx = rawSqlite.prepare(
              `SELECT balance FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
            ).get(matchedInvoice.clientId) as { balance: number } | undefined;
            const currentBalance = lastTx?.balance ?? 0;
            const newBalance = currentBalance + matchedInvoice.total;

            rawSqlite.prepare(`
              INSERT INTO credit_transactions (user_id, invoice_id, type, amount, balance, note, created_at)
              VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?)
            `).run(
              matchedInvoice.clientId, matchedInvoice.id, matchedInvoice.total, newBalance,
              `Kredit z nadační faktury ${matchedInvoice.invoiceNumber}`, now
            );

            // Set foundationNotifiedAt
            rawSqlite.prepare(`
              UPDATE invoices SET foundation_notified_at = ? WHERE id = ?
            `).run(now, matchedInvoice.id);
          }
        }
      } else {
        // SHOULD #11: Try to match insurance batch by variable symbol (batch ID or period pattern)
        const allBatches = await db.select().from(insuranceBatches);
        const matchedBatch = allBatches.find(
          (b) =>
            body.variableSymbol === String(b.id) ||
            body.variableSymbol === `INS-${b.period}-${b.id}` ||
            (body.note && body.note.toLowerCase().includes(`davka ${b.id}`))
        );
        if (matchedBatch && matchedBatch.status === "SENT") {
          // Mark batch as PAID
          await db.update(insuranceBatches).set({
            status: "PAID",
            updatedAt: new Date().toISOString(),
          }).where(eq(insuranceBatches.id, matchedBatch.id));
          // Mark all claims in batch as PAID
          await db.update(insuranceClaims).set({
            status: "PAID",
            updatedAt: new Date().toISOString(),
          }).where(eq(insuranceClaims.batchId, matchedBatch.id));
          await db.update(fioTransactions).set({ isMatched: true }).where(eq(fioTransactions.id, tx.id));
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
  fastify.get("/fio/summary", { schema: fioSchemas.summary }, async (request, reply) => {
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

  // GET /fio/export/csv — export FIO transactions as CSV (ADMIN/RECEPTION)
  fastify.get("/fio/export/csv", { schema: fioSchemas.exportCsv }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string; unmatched?: string };
    let all = await db.select().from(fioTransactions).orderBy(fioTransactions.transactionDate);

    if (q.from) all = all.filter((t) => t.transactionDate >= q.from!);
    if (q.to) all = all.filter((t) => t.transactionDate <= q.to!);
    if (q.unmatched === "true") all = all.filter((t) => !t.isMatched);

    const allInvoices = await db.select().from(invoices);
    const allUsersData = await db.select({ id: users.id, name: users.name }).from(users);
    const invMap = Object.fromEntries(allInvoices.map((i) => [i.id, i]));
    const userMap = Object.fromEntries(allUsersData.map((u) => [u.id, u.name]));

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = ["ID", "FIO ID", "Datum", "Částka", "Měna", "Variabilní symbol",
      "Poznámka", "Protiúčet", "Jméno protiúčtu", "Spárováno", "Faktura č.", "Klient"].join(",");

    const rows = all.map((t) => {
      const inv = t.matchedInvoiceId ? invMap[t.matchedInvoiceId] : null;
      const clientName = t.matchedClientId ? userMap[t.matchedClientId] : "";
      return [
        t.id, t.fioId, t.transactionDate, t.amount, t.currency,
        t.variableSymbol ?? "", t.note ?? "", t.counterAccount ?? "", t.counterName ?? "",
        t.isMatched ? "ANO" : "NE",
        inv?.invoiceNumber ?? "",
        clientName ?? "",
      ].map(escape).join(",");
    });

    const csv = [header, ...rows].join("\n");
    const filename = `fio-export-${new Date().toISOString().slice(0, 10)}.csv`;

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send("\uFEFF" + csv); // BOM for Excel Czech encoding
  });
};

export default fioRoutes;
