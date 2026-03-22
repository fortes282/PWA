import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { notifications, waitlist, openSlots } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

import { notificationSchemas } from "../utils/swagger-schemas.js";

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/notifications", { schema: notificationSchemas.list }, async (request) => {
    const query = request.query as { type?: string; unread?: string; limit?: string; offset?: string };
    let rows = await db.select().from(notifications)
      .where(eq(notifications.userId, request.auth!.id));
    
    // Filter by type
    if (query.type) {
      rows = rows.filter((n) => n.type === query.type);
    }
    // Filter unread only
    if (query.unread === "true") {
      rows = rows.filter((n) => !n.isRead);
    }
    // Sort newest first
    rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    // Pagination
    const offset = parseInt(query.offset ?? "0");
    const limit = Math.min(parseInt(query.limit ?? "100"), 200);
    const total = rows.length;
    rows = rows.slice(offset, offset + limit);
    
    return { notifications: rows, total };
  });

  // GET /notifications/unread-count — lightweight: returns { count: N }
  fastify.get("/notifications/unread-count", async (request) => {
    const all = await db.select().from(notifications)
      .where(and(eq(notifications.userId, request.auth!.id), eq(notifications.isRead, false)));
    return { count: all.length };
  });

  fastify.post<{ Params: { id: string } }>("/notifications/:id/read", async (request) => {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, parseInt(request.params.id)),
        eq(notifications.userId, request.auth!.id),
      ));
    return { ok: true };
  });

  fastify.post("/notifications/read-all", async (request) => {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, request.auth!.id));
    return { ok: true };
  });

  // POST /notifications — create notification (ADMIN/RECEPTION only)
  fastify.post("/notifications", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      userId: number;
      type: string;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    };

    const [notification] = await db.insert(notifications).values({
      userId: body.userId,
      type: body.type as any,
      title: body.title,
      message: body.message,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    }).returning();

    reply.code(201);
    return notification;
  });

  // POST /notifications/bulk — create multiple notifications at once (ADMIN/RECEPTION)
  fastify.post("/notifications/bulk", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      userIds: number[];
      type: string;
      title: string;
      message: string;
    };

    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      return reply.code(400).send({ error: "userIds must be a non-empty array" });
    }

    const created = [];
    for (const userId of body.userIds) {
      const [n] = await db.insert(notifications).values({
        userId,
        type: body.type as any,
        title: body.title,
        message: body.message,
      }).returning();
      created.push(n);
    }

    reply.code(201);
    return { sent: created.length, notifications: created };
  });

  // POST /notifications/send-slot-alert — notify waitlisted clients about a slot (ADMIN/RECEPTION)
  fastify.post("/notifications/send-slot-alert", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      slotId: number;
      type: "AVAILABLE" | "DISCOUNTED";
      discount?: number;
    };

    if (!body.slotId || !["AVAILABLE", "DISCOUNTED"].includes(body.type)) {
      return reply.code(400).send({ error: "slotId and type (AVAILABLE|DISCOUNTED) are required" });
    }

    // Look up the slot to get the employee (no serviceId on open_slots, so we
    // notify clients waiting for ANY service with that employee, or all WAITING)
    const [slot] = await db.select().from(openSlots)
      .where(eq(openSlots.id, body.slotId)).limit(1);

    if (!slot) {
      return reply.code(404).send({ error: "Slot not found" });
    }

    // Get all WAITING waitlist entries (for that employee if set)
    const waiting = await db.select().from(waitlist)
      .where(
        and(
          eq(waitlist.status, "WAITING"),
          slot.employeeId ? eq(waitlist.employeeId, slot.employeeId) : undefined,
        )
      );

    if (waiting.length === 0) {
      return { sent: 0 };
    }

    const isDiscounted = body.type === "DISCOUNTED";
    const title = isDiscounted
      ? `Slevový slot k dispozici${body.discount ? ` (${body.discount}% sleva)` : ""}`
      : "Uvolnil se termín";
    const message = isDiscounted
      ? `Uvolnil se termín se slevou${body.discount ? ` ${body.discount} %` : ""} na ${slot.date} v ${slot.time}. Rezervujte si ho co nejdříve.`
      : `Uvolnil se termín, na který čekáte: ${slot.date} v ${slot.time}. Přihlaste se a rezervujte si místo.`;

    const created = [];
    for (const entry of waiting) {
      const [n] = await db.insert(notifications).values({
        userId: entry.clientId,
        type: "APPOINTMENT_REMINDER" as any,
        title,
        message,
        metadata: JSON.stringify({ slotId: body.slotId, alertType: body.type, discount: body.discount ?? null }),
      }).returning();
      created.push(n);
    }

    reply.code(201);
    return { sent: created.length };
  });

  // DELETE /notifications/clear-read — delete all read notifications for current user
  fastify.delete("/notifications/clear-read", async (request) => {
    const { id: userId } = request.auth!;
    await db.delete(notifications).where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, true))
    );
    return { ok: true };
  });

  // PATCH /notifications/mark-all-read — mark all as read for current user
  fastify.patch("/notifications/mark-all-read", async (request) => {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, request.auth!.id));
    return { ok: true };
  });

  // DELETE /notifications/:id — delete notification
  fastify.delete<{ Params: { id: string } }>("/notifications/:id", async (request, reply) => {
    const { id: userId } = request.auth!;
    const notifId = parseInt(request.params.id);

    const [notif] = await db.select().from(notifications)
      .where(eq(notifications.id, notifId)).limit(1);
    if (!notif) return reply.code(404).send({ error: "Not found" });
    const { role } = request.auth!;
    if (notif.userId !== userId && role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    await db.delete(notifications).where(eq(notifications.id, notifId));
    return { ok: true };
  });
};

export default notificationsRoutes;
