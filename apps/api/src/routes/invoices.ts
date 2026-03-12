import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { invoices, invoiceItems } from "../db/schema.js";
import { eq } from "drizzle-orm";

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
    const invoiceNumber = `INV-${Date.now()}`;

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
};

export default invoicesRoutes;
