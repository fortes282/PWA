import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { invoices, invoiceItems, users } from "../db/schema.js";
import { eq, and, lt, desc } from "drizzle-orm";
import { logAudit } from "./audit.js";

const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/invoices", async (request) => {
    const { id, role } = request.auth!;
    if (role === "CLIENT") {
      return db.select().from(invoices).where(eq(invoices.clientId, id));
    }
    return db.select().from(invoices);
  });

  fastify.get<{ Params: { id: string } }>("/invoices/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const invId = parseInt(request.params.id);

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invId)).limit(1);
    if (!inv) return reply.code(404).send({ error: "Not found" });
    if (role === "CLIENT" && inv.clientId !== userId) return reply.code(403).send({ error: "Forbidden" });

    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invId));
    return { ...inv, items };
  });

  fastify.post("/invoices", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as {
      clientId: number;
      dueDate: string;
      notes?: string;
      items: Array<{ description: string; quantity: number; unitPrice: number }>;
    };

    const total = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // Sequential invoice number: INV-YYYY-NNNN
    const year = new Date().getFullYear();
    const lastInv = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .orderBy(desc(invoices.id))
      .limit(1);
    let seq = 1;
    if (lastInv.length > 0) {
      const lastNum = lastInv[0].invoiceNumber;
      const match = lastNum.match(/INV-\d{4}-(\d+)$/);
      if (match) seq = parseInt(match[1], 10) + 1;
      // If last invoice was from different year, reset seq
      const lastYear = lastNum.match(/INV-(\d{4})-/);
      if (lastYear && parseInt(lastYear[1], 10) !== year) seq = 1;
    }
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;

    const [inv] = await db.insert(invoices).values({
      invoiceNumber,
      clientId: body.clientId,
      total,
      dueDate: body.dueDate,
      notes: body.notes ?? null,
    }).returning();

    const itemRows = body.items.map((i) => ({
      invoiceId: inv.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.quantity * i.unitPrice,
    }));

    await db.insert(invoiceItems).values(itemRows);

    logAudit(db, request.auth!.id, "INVOICE_CREATED", { targetId: inv.id });

    reply.code(201);
    return { ...inv, items: itemRows };
  });

  fastify.patch<{ Params: { id: string } }>("/invoices/:id/status", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const { status } = request.body as { status: string };
    const updates: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (status === "PAID") {
      updates.paidAt = new Date().toISOString();
    }

    const [updated] = await db.update(invoices)
      .set(updates as any)
      .where(eq(invoices.id, parseInt(request.params.id)))
      .returning();

    logAudit(db, request.auth!.id, "INVOICE_UPDATED", { targetId: parseInt(request.params.id) });

    return updated;
  });

  // GET /invoices/overdue — invoices past due date and not paid (ADMIN/RECEPTION)
  fastify.get("/invoices/overdue", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const today = new Date().toISOString().slice(0, 10);
    const all = await db.select().from(invoices);
    const overdue = all.filter(
      (inv) => inv.status === "SENT" && inv.dueDate < today
    );

    // Auto-mark them as OVERDUE in DB
    for (const inv of overdue) {
      if (inv.status !== "OVERDUE") {
        await db.update(invoices)
          .set({ status: "OVERDUE", updatedAt: new Date().toISOString() })
          .where(and(eq(invoices.id, inv.id), eq(invoices.status, "SENT")));
      }
    }

    // Return fresh overdue list
    const fresh = await db.select().from(invoices);
    return fresh.filter((inv) => inv.status === "OVERDUE");
  });

  // PATCH /invoices/:id/notes — update notes
  fastify.patch<{ Params: { id: string } }>("/invoices/:id/notes", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const { notes } = request.body as { notes: string };
    const [updated] = await db.update(invoices)
      .set({ notes: notes ?? null, updatedAt: new Date().toISOString() })
      .where(eq(invoices.id, parseInt(request.params.id)))
      .returning();

    return updated;
  });

  /**
   * GET /invoices/export/csv — export invoices as CSV (ADMIN/RECEPTION)
   * Query: ?status=PAID,OVERDUE&from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  fastify.get("/invoices/export/csv", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { status?: string; from?: string; to?: string };

    const allInvoices = await db.select().from(invoices);
    const allUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
    const allItems = await db.select().from(invoiceItems);

    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
    const itemsByInvoice: Record<number, typeof allItems> = {};
    for (const item of allItems) {
      if (!itemsByInvoice[item.invoiceId]) itemsByInvoice[item.invoiceId] = [];
      itemsByInvoice[item.invoiceId].push(item);
    }

    let filtered = allInvoices;
    if (q.status) {
      const statuses = q.status.split(",").map((s) => s.trim());
      filtered = filtered.filter((i) => statuses.includes(i.status));
    }
    if (q.from) filtered = filtered.filter((i) => i.createdAt >= q.from!);
    if (q.to) filtered = filtered.filter((i) => i.createdAt <= q.to! + "T23:59:59");

    filtered.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = ["Číslo faktury", "Klient", "Email klienta", "Status", "Celkem",
      "Splatnost", "Zaplaceno", "Poznámky", "Vytvořeno"].join(",");

    const rows = filtered.map((inv) => {
      const client = userMap[inv.clientId];
      return [
        inv.invoiceNumber,
        client?.name ?? inv.clientId,
        client?.email ?? "",
        inv.status,
        inv.total,
        inv.dueDate,
        inv.paidAt ?? "",
        inv.notes ?? "",
        inv.createdAt,
      ].map(escape).join(",");
    });

    const csv = [header, ...rows].join("\n");
    const dateStr = new Date().toISOString().slice(0, 10);
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="invoices-${dateStr}.csv"`)
      .send("\uFEFF" + csv);
  });
};

export default invoicesRoutes;
