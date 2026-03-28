import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { invoices, invoiceItems, users, appointments, services } from "../db/schema.js";
import { eq, and, lt, desc, like } from "drizzle-orm";
import { logAudit } from "./audit.js";
import { invoiceSchemas, invoiceExtSchemas } from "../utils/swagger-schemas.js";
import { widenReply } from "../utils/widen-reply.js";

// ── Invoice number prefix map ────────────────────────────────────────────────
const INVOICE_TYPE_PREFIX: Record<string, string> = {
  THERAPY_INVOICE: "TI",
  PRICE_QUOTE: "PQ",
  FOUNDATION_INVOICE: "FI",
  GENERAL: "INV",
};

/**
 * Generate next sequential invoice number for the given type.
 * Format: PREFIX-YYYY-NNNN
 */
function generateInvoiceNumber(invoiceType: string): string {
  const prefix = INVOICE_TYPE_PREFIX[invoiceType] ?? "INV";
  const year = new Date().getFullYear();

  const lastInv = rawSqlite.prepare(`
    SELECT invoice_number FROM invoices
    WHERE invoice_number LIKE ? || '-' || ? || '-%'
    ORDER BY id DESC LIMIT 1
  `).get(prefix, String(year)) as { invoice_number: string } | undefined;

  let seq = 1;
  if (lastInv) {
    const match = lastInv.invoice_number.match(new RegExp(`${prefix}-\\d{4}-(\\d+)$`));
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Foundation invoice paid handler: create notifications for RECEPTION + ADMIN,
 * create credit_transactions entry.
 */
function handleFoundationInvoicePaid(invoiceId: number, invoiceNumber: string, total: number, clientId: number): void {
  const now = new Date().toISOString();
  const message = `Faktura z nadace ${invoiceNumber} byla proplacena (${total} Kč). Připište kredit klientovi.`;

  // Notify all RECEPTION users
  const receptionUsers = rawSqlite.prepare(
    `SELECT id FROM users WHERE role = 'RECEPTION' AND is_active = 1`
  ).all() as { id: number }[];

  for (const u of receptionUsers) {
    rawSqlite.prepare(`
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
      VALUES (?, 'INVOICE', ?, ?, 0, ?)
    `).run(u.id, "Faktura z nadace proplacena", message, now);
  }

  // Notify all ADMIN users
  const adminUsers = rawSqlite.prepare(
    `SELECT id FROM users WHERE role = 'ADMIN' AND is_active = 1`
  ).all() as { id: number }[];

  for (const u of adminUsers) {
    rawSqlite.prepare(`
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
      VALUES (?, 'INVOICE', ?, ?, 0, ?)
    `).run(u.id, "Faktura z nadace proplacena", message, now);
  }

  // Create credit_transactions entry: FOUNDATION_CREDIT
  const lastTx = rawSqlite.prepare(
    `SELECT balance FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
  ).get(clientId) as { balance: number } | undefined;

  const currentBalance = lastTx?.balance ?? 0;
  const newBalance = currentBalance + total;

  rawSqlite.prepare(`
    INSERT INTO credit_transactions (user_id, invoice_id, type, amount, balance, note, created_at)
    VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?)
  `).run(clientId, invoiceId, total, newBalance, `Kredit z nadační faktury ${invoiceNumber}`, now);

  // Set foundationNotifiedAt
  rawSqlite.prepare(`
    UPDATE invoices SET foundation_notified_at = ? WHERE id = ?
  `).run(now, invoiceId);
}

const invoicesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/invoices", { schema: invoiceSchemas.list }, async (request) => {
    const { id, role } = request.auth!;
    const q = request.query as { invoiceType?: string };

    if (role === "CLIENT") {
      const all = await db.select().from(invoices).where(eq(invoices.clientId, id));
      if (q.invoiceType) {
        return all.filter((inv) => inv.invoiceType === q.invoiceType);
      }
      return all;
    }

    const all = await db.select().from(invoices);
    if (q.invoiceType) {
      return all.filter((inv) => inv.invoiceType === q.invoiceType);
    }
    return all;
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
      invoiceType?: string;
      items: Array<{ description: string; quantity: number; unitPrice: number }>;
    };

    const invoiceType = body.invoiceType ?? "GENERAL";
    const validTypes = ["THERAPY_INVOICE", "PRICE_QUOTE", "FOUNDATION_INVOICE", "GENERAL"];
    if (!validTypes.includes(invoiceType)) {
      return reply.code(400).send({ error: "Invalid invoiceType" });
    }

    const total = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const invoiceNumber = generateInvoiceNumber(invoiceType);

    const [inv] = await db.insert(invoices).values({
      invoiceNumber,
      clientId: body.clientId,
      invoiceType: invoiceType as any,
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

    widenReply(reply).code(201);
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

      // Foundation invoice auto-credit: notify staff + create credit
      if (invBefore.invoiceType === "FOUNDATION_INVOICE") {
        handleFoundationInvoicePaid(invId, updated.invoiceNumber, updated.total, updated.clientId);
      }
    }

    logAudit(db, request.auth!.id, "INVOICE_UPDATED", { targetId: invId });

    return updated;
  });

  // ── Bulk therapy invoicing: preview ──────────────────────────────────────
  fastify.get("/invoices/bulk-therapy/preview", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const { month } = request.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return reply.code(400).send({ error: "Query param month required in YYYY-MM format" });
    }

    const monthStart = `${month}-01T00:00:00`;
    const nextMonth = month.slice(0, 5) + String(parseInt(month.slice(5), 10) + 1).padStart(2, "0");
    const monthEnd = `${nextMonth}-01T00:00:00`;

    // Find completed appointments in the given month NOT linked to invoice_items
    const rows = rawSqlite.prepare(`
      SELECT a.id, a.client_id, a.start_time, a.price, a.service_id,
             u.name AS client_name, s.name AS service_name, s.price AS service_price
      FROM appointments a
      INNER JOIN users u ON u.id = a.client_id
      INNER JOIN services s ON s.id = a.service_id
      WHERE a.status = 'COMPLETED'
        AND a.start_time >= ? AND a.start_time < ?
        AND a.id NOT IN (
          SELECT ii.appointment_id FROM invoice_items ii WHERE ii.appointment_id IS NOT NULL
        )
      ORDER BY a.client_id, a.start_time
    `).all(monthStart, monthEnd) as any[];

    const grouped: Record<number, { clientId: number; clientName: string; appointments: any[]; totalAmount: number }> = {};
    for (const row of rows) {
      if (!grouped[row.client_id]) {
        grouped[row.client_id] = {
          clientId: row.client_id,
          clientName: row.client_name,
          appointments: [],
          totalAmount: 0,
        };
      }
      const price = row.price ?? row.service_price;
      grouped[row.client_id].appointments.push({
        id: row.id,
        serviceId: row.service_id,
        serviceName: row.service_name,
        startTime: row.start_time,
        price,
      });
      grouped[row.client_id].totalAmount += price;
    }

    return Object.values(grouped);
  });

  // ── Bulk therapy invoicing: create ───────────────────────────────────────
  fastify.post("/invoices/bulk-therapy", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as { month: string; clientIds?: number[] };
    if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return reply.code(400).send({ error: "month required in YYYY-MM format" });
    }

    const monthStart = `${body.month}-01T00:00:00`;
    const nextMonth = body.month.slice(0, 5) + String(parseInt(body.month.slice(5), 10) + 1).padStart(2, "0");
    const monthEnd = `${nextMonth}-01T00:00:00`;

    // Find uninvoiced completed appointments
    let query = `
      SELECT a.id, a.client_id, a.start_time, a.price, a.service_id,
             u.name AS client_name, s.name AS service_name, s.price AS service_price
      FROM appointments a
      INNER JOIN users u ON u.id = a.client_id
      INNER JOIN services s ON s.id = a.service_id
      WHERE a.status = 'COMPLETED'
        AND a.start_time >= ? AND a.start_time < ?
        AND a.id NOT IN (
          SELECT ii.appointment_id FROM invoice_items ii WHERE ii.appointment_id IS NOT NULL
        )
      ORDER BY a.client_id, a.start_time
    `;

    const rows = rawSqlite.prepare(query).all(monthStart, monthEnd) as any[];

    // Group by client
    const grouped: Record<number, any[]> = {};
    for (const row of rows) {
      if (body.clientIds && !body.clientIds.includes(row.client_id)) continue;
      if (!grouped[row.client_id]) grouped[row.client_id] = [];
      grouped[row.client_id].push(row);
    }

    const created: any[] = [];
    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    const txn = rawSqlite.transaction(() => {
      for (const [clientIdStr, appts] of Object.entries(grouped)) {
        const clientId = parseInt(clientIdStr, 10);
        const invoiceNumber = generateInvoiceNumber("THERAPY_INVOICE");
        const total = appts.reduce((s: number, a: any) => s + (a.price ?? a.service_price), 0);

        const invResult = rawSqlite.prepare(`
          INSERT INTO invoices (invoice_number, client_id, invoice_type, total, due_date, source_month, created_at, updated_at)
          VALUES (?, ?, 'THERAPY_INVOICE', ?, ?, ?, ?, ?)
        `).run(invoiceNumber, clientId, total, dueDate, body.month, now, now);

        const invoiceId = Number(invResult.lastInsertRowid);

        for (const a of appts) {
          const price = a.price ?? a.service_price;
          rawSqlite.prepare(`
            INSERT INTO invoice_items (invoice_id, appointment_id, description, quantity, unit_price, total)
            VALUES (?, ?, ?, 1, ?, ?)
          `).run(invoiceId, a.id, `[appt:${a.id}] ${a.service_name} — ${a.start_time.slice(0, 10)}`, price, price);
        }

        created.push({ invoiceId, invoiceNumber, clientId, total, appointmentCount: appts.length });
      }
    });

    txn();

    logAudit(db, request.auth!.id, "BULK_THERAPY_INVOICES_CREATED", {
      details: JSON.stringify({ month: body.month, count: created.length }),
    });

    widenReply(reply).code(201);
    return { created };
  });

  // ── Payment reminder ─────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>("/invoices/:id/send-reminder", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const invId = parseInt(request.params.id);
    const inv = rawSqlite.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invId) as any;
    if (!inv) return reply.code(404).send({ error: "Not found" });
    if (inv.status === "PAID" || inv.status === "CANCELLED") {
      return reply.code(400).send({ error: "Cannot send reminder for PAID or CANCELLED invoice" });
    }

    const now = new Date().toISOString();

    // Create payment_reminders record
    rawSqlite.prepare(`
      INSERT INTO payment_reminders (invoice_id, sent_at, channel, status, created_at)
      VALUES (?, ?, 'inapp', 'sent', ?)
    `).run(invId, now, now);

    // Increment reminderCount on invoice
    rawSqlite.prepare(`
      UPDATE invoices SET reminder_count = reminder_count + 1, reminder_sent_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, invId);

    // In-app notification to client
    rawSqlite.prepare(`
      INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
      VALUES (?, 'INVOICE', 'Upomínka k faktuře', ?, 0, ?)
    `).run(inv.client_id, `Faktura ${inv.invoice_number} je po splatnosti. Prosíme o úhradu.`, now);

    logAudit(db, request.auth!.id, "INVOICE_REMINDER_SENT", { targetId: invId });

    return { ok: true, invoiceId: invId, reminderCount: inv.reminder_count + 1 };
  });

  // GET /invoices/overdue — invoices past due date and not paid (ADMIN/RECEPTION)
  fastify.get("/invoices/overdue", { schema: invoiceExtSchemas.overdue }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const today = new Date().toISOString().slice(0, 10);

    // Auto-mark SENT invoices past due as OVERDUE
    rawSqlite.prepare(`
      UPDATE invoices SET status = 'OVERDUE', updated_at = ?
      WHERE status = 'SENT' AND due_date < ?
    `).run(new Date().toISOString(), today);

    // Return fresh overdue list (status SENT or OVERDUE, past due, not paid)
    const overdue = rawSqlite.prepare(`
      SELECT * FROM invoices WHERE status IN ('SENT', 'OVERDUE') AND due_date < ?
      ORDER BY due_date ASC
    `).all(today) as any[];

    return overdue;
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

    const invoiceNumber = generateInvoiceNumber("GENERAL");

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

    widenReply(reply).code(201);
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

    const header = ["Číslo faktury", "Typ", "Klient", "Email klienta", "Status", "Celkem",
      "Splatnost", "Zaplaceno", "Poznámky", "Vytvořeno"].join(",");

    const rows = filtered.map((inv) => {
      const client = userMap[inv.clientId];
      return [
        inv.invoiceNumber,
        inv.invoiceType ?? "GENERAL",
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
