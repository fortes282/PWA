import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { invoices, invoiceItems, users, appointments, services } from "../db/schema.js";
import { eq, and, lt, desc, like } from "drizzle-orm";
import { logAudit } from "./audit.js";
import { invoiceSchemas, invoiceExtSchemas } from "../utils/swagger-schemas.js";

const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/invoices", { schema: invoiceSchemas.list }, async (request) => {
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

  fastify.post("/invoices", { schema: invoiceSchemas.create }, async (request, reply) => {
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

    const invId = parseInt(request.params.id);
    const [invBefore] = await db.select().from(invoices).where(eq(invoices.id, invId)).limit(1);

    const [updated] = await db.update(invoices)
      .set(updates as any)
      .where(eq(invoices.id, invId))
      .returning();

    // Loyalty: +5 when invoice marked PAID (only once — check previous status)
    if (status === "PAID" && invBefore && invBefore.status !== "PAID") {
      const { addLoyaltyPoints } = await import("./loyalty.js");
      await addLoyaltyPoints(updated.clientId, 5, `Platba faktury ${updated.invoiceNumber}`);
    }

    logAudit(db, request.auth!.id, "INVOICE_UPDATED", { targetId: invId });

    return updated;
  });

  // GET /invoices/overdue — invoices past due date and not paid (ADMIN/RECEPTION)
  fastify.get("/invoices/overdue", { schema: invoiceExtSchemas.overdue }, async (request, reply) => {
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

  // PATCH /invoices/:id/payment — set payment_method + payment_paid_at (ADMIN/RECEPTION)
  fastify.patch<{ Params: { id: string } }>("/invoices/:id/payment", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const invId = parseInt(request.params.id);
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invId)).limit(1);
    if (!inv) return reply.code(404).send({ error: "Not found" });
    if (inv.status !== "PAID") return reply.code(400).send({ error: "Invoice must be PAID to set payment details" });

    const body = request.body as { payment_method: string; paid_at?: string | null };
    const validMethods = ["cash", "card", "transfer", "credit"];
    if (!validMethods.includes(body.payment_method)) {
      return reply.code(400).send({ error: "Invalid payment_method. Must be one of: cash, card, transfer, credit" });
    }

    const paymentPaidAt = body.paid_at ? new Date(body.paid_at).getTime() : null;

    const updateData: Record<string, unknown> = {
      paymentMethod: body.payment_method,
      updatedAt: new Date().toISOString(),
    };
    if (paymentPaidAt !== null) updateData.paymentPaidAt = paymentPaidAt;

    const [updated] = await db.update(invoices)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateData as any)
      .where(eq(invoices.id, invId))
      .returning();

    logAudit(db, request.auth!.id, "INVOICE_PAYMENT_UPDATED", { targetId: invId });
    return updated;
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

  // GET /appointments/uninvoiced — COMPLETED appointments not yet invoiced, grouped by client
  fastify.get("/appointments/uninvoiced", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const completed = await db
      .select({
        id: appointments.id,
        clientId: appointments.clientId,
        clientName: users.name,
        serviceId: appointments.serviceId,
        serviceName: services.name,
        startTime: appointments.startTime,
        price: appointments.price,
        servicePrice: services.price,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.clientId, users.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.status, "COMPLETED"));

    const invoicedItems = await db
      .select({ description: invoiceItems.description })
      .from(invoiceItems)
      .where(like(invoiceItems.description, "[appt:%"));

    const invoicedIds = new Set(
      invoicedItems
        .map((item) => {
          const m = item.description.match(/\[appt:(\d+)\]/);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter((id): id is number => id !== null)
    );

    const uninvoiced = completed.filter((a) => !invoicedIds.has(a.id));

    const grouped: Record<number, { clientId: number; clientName: string; appointments: typeof uninvoiced }> = {};
    for (const appt of uninvoiced) {
      if (!grouped[appt.clientId]) {
        grouped[appt.clientId] = { clientId: appt.clientId, clientName: appt.clientName, appointments: [] };
      }
      grouped[appt.clientId].appointments.push(appt);
    }

    return Object.values(grouped);
  });

  // POST /invoices/from-appointments — create invoice(s) from completed appointments
  fastify.post("/invoices/from-appointments", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as {
      clientId: number;
      appointmentIds: number[];
      dueDate?: string;
      notes?: string;
    };

    const appts = await db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        price: appointments.price,
        serviceName: services.name,
        servicePrice: services.price,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(eq(appointments.clientId, body.clientId));

    const selected = appts.filter((a) => body.appointmentIds.includes(a.id));
    if (selected.length === 0) return reply.code(400).send({ error: "No valid appointments found" });

    const items = selected.map((a) => ({
      description: `[appt:${a.id}] ${a.serviceName} — ${a.startTime.slice(0, 10)}`,
      quantity: 1,
      unitPrice: a.price ?? a.servicePrice,
    }));

    const total = items.reduce((s, i) => s + i.unitPrice, 0);
    const dueDate = body.dueDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

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
      const lastYear = lastNum.match(/INV-(\d{4})-/);
      if (lastYear && parseInt(lastYear[1], 10) !== year) seq = 1;
    }
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;

    const [inv] = await db.insert(invoices).values({
      invoiceNumber,
      clientId: body.clientId,
      total,
      dueDate,
      notes: body.notes ?? null,
    }).returning();

    const itemRows = items.map((i) => ({
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

  /**
   * GET /invoices/export/csv — export invoices as CSV (ADMIN/RECEPTION)
   * Query: ?status=PAID,OVERDUE&from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  fastify.get("/invoices/export/csv", { schema: invoiceExtSchemas.exportCsv }, async (request, reply) => {
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
