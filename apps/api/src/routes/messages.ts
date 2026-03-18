import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { messages, users } from "../db/schema.js";
import { eq, or, and, desc, sql } from "drizzle-orm";
import { messageSchemas } from "../utils/swagger-schemas.js";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  // Runtime migration
  rawSqlite.exec(MIGRATION_SQL);

  // GET /messages — inbox + sent for current user
  fastify.get<{ Querystring: { folder?: string; limit?: string; page?: string } }>(
    "/messages",
    { schema: messageSchemas.list },
    async (request) => {
      const { folder = "inbox", limit = "20", page = "1" } = request.query;
      const userId = request.auth!.id;
      const lim = Math.min(parseInt(limit), 100);
      const offset = (parseInt(page) - 1) * lim;

      let rows: any[];
      if (folder === "sent") {
        rows = await db
          .select({
            id: messages.id,
            fromUserId: messages.fromUserId,
            toUserId: messages.toUserId,
            subject: messages.subject,
            body: messages.body,
            isRead: messages.isRead,
            parentId: messages.parentId,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.fromUserId, userId))
          .orderBy(desc(messages.createdAt))
          .limit(lim)
          .offset(offset);
      } else {
        rows = await db
          .select({
            id: messages.id,
            fromUserId: messages.fromUserId,
            toUserId: messages.toUserId,
            subject: messages.subject,
            body: messages.body,
            isRead: messages.isRead,
            parentId: messages.parentId,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.toUserId, userId))
          .orderBy(desc(messages.createdAt))
          .limit(lim)
          .offset(offset);
      }

      // Enrich with sender/recipient names
      const enriched = await Promise.all(
        rows.map(async (m: any) => {
          const [from] = await db
            .select({ id: users.id, name: users.name, role: users.role })
            .from(users)
            .where(eq(users.id, m.fromUserId))
            .limit(1);
          const [to] = await db
            .select({ id: users.id, name: users.name, role: users.role })
            .from(users)
            .where(eq(users.id, m.toUserId))
            .limit(1);
          return { ...m, from, to };
        }),
      );

      return enriched;
    },
  );

  // GET /messages/unread-count
  fastify.get("/messages/unread-count", { schema: messageSchemas.unreadCount }, async (request) => {
    const userId = request.auth!.id;
    const rows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.toUserId, userId), eq(messages.isRead, false)));
    return { count: rows.length };
  });

  // GET /messages/:id — detail
  fastify.get<{ Params: { id: string } }>("/messages/:id", async (request, reply) => {
    const userId = request.auth!.id;
    const role = request.auth!.role;
    const msgId = parseInt(request.params.id);

    const [msg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, msgId))
      .limit(1);

    if (!msg) return reply.status(404).send({ error: "Not found" });

    // Only sender, recipient or ADMIN can see
    if (msg.fromUserId !== userId && msg.toUserId !== userId && role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    // Auto-mark as read if recipient
    if (msg.toUserId === userId && !msg.isRead) {
      await db.update(messages).set({ isRead: true }).where(eq(messages.id, msgId));
    }

    const [from] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, msg.fromUserId))
      .limit(1);
    const [to] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, msg.toUserId))
      .limit(1);

    // Fetch thread replies (messages with parentId = this id)
    const replies = await db
      .select()
      .from(messages)
      .where(eq(messages.parentId, msgId))
      .orderBy(messages.createdAt);

    return { ...msg, isRead: true, from, to, replies };
  });

  // POST /messages — send new message
  fastify.post<{ Body: { toUserId: number; subject: string; body: string; parentId?: number } }>(
    "/messages",
    async (request, reply) => {
      const { toUserId, subject, body, parentId } = request.body ?? {};
      const fromUserId = request.auth!.id;

      if (!toUserId || !subject || !body) {
        return reply.status(400).send({ error: "toUserId, subject, body required" });
      }
      if (typeof subject !== "string" || subject.trim().length === 0) {
        return reply.status(400).send({ error: "Subject cannot be empty" });
      }
      if (body.length > 5000) {
        return reply.status(400).send({ error: "Body too long (max 5000 chars)" });
      }

      // Validate recipient exists
      const [recipient] = await db
        .select({ id: users.id, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, toUserId))
        .limit(1);
      if (!recipient || !recipient.isActive) {
        return reply.status(404).send({ error: "Recipient not found" });
      }
      if (fromUserId === toUserId) {
        return reply.status(400).send({ error: "Cannot send message to yourself" });
      }

      const [created] = await db
        .insert(messages)
        .values({
          fromUserId,
          toUserId,
          subject: subject.trim(),
          body: body.trim(),
          parentId: parentId ?? null,
          isRead: false,
        })
        .returning();

      return reply.status(201).send(created);
    },
  );

  // PATCH /messages/:id/read — mark as read
  fastify.patch<{ Params: { id: string } }>("/messages/:id/read", async (request, reply) => {
    const userId = request.auth!.id;
    const msgId = parseInt(request.params.id);

    const [msg] = await db
      .select({ id: messages.id, toUserId: messages.toUserId })
      .from(messages)
      .where(eq(messages.id, msgId))
      .limit(1);

    if (!msg) return reply.status(404).send({ error: "Not found" });
    if (msg.toUserId !== userId) return reply.status(403).send({ error: "Forbidden" });

    await db.update(messages).set({ isRead: true }).where(eq(messages.id, msgId));
    return { ok: true };
  });

  // DELETE /messages/:id — delete (sender or ADMIN)
  fastify.delete<{ Params: { id: string } }>("/messages/:id", async (request, reply) => {
    const userId = request.auth!.id;
    const role = request.auth!.role;
    const msgId = parseInt(request.params.id);

    const [msg] = await db
      .select({ id: messages.id, fromUserId: messages.fromUserId })
      .from(messages)
      .where(eq(messages.id, msgId))
      .limit(1);

    if (!msg) return reply.status(404).send({ error: "Not found" });
    if (msg.fromUserId !== userId && role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    await db.delete(messages).where(eq(messages.id, msgId));
    return { ok: true };
  });

  // GET /messages/contacts — list of users the current user can message
  fastify.get("/messages/contacts", async (request) => {
    const role = request.auth!.role;
    const userId = request.auth!.id;

    let allowedRoles: string[];
    if (role === "CLIENT") {
      // Clients can message RECEPTION and EMPLOYEE
      allowedRoles = ["RECEPTION", "EMPLOYEE"];
    } else if (role === "EMPLOYEE") {
      // Employees can message all (clients, reception, admin)
      allowedRoles = ["CLIENT", "RECEPTION", "ADMIN", "EMPLOYEE"];
    } else {
      // RECEPTION / ADMIN can message everyone
      allowedRoles = ["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"];
    }

    const rows = rawSqlite.prepare(
      `SELECT id, name, role, avatar_url FROM users WHERE is_active = 1 AND role IN (${allowedRoles.map(() => "?").join(",")}) AND id != ? ORDER BY name`,
    ).all(...allowedRoles, userId);

    return rows;
  });
};

export default messagesRoutes;
