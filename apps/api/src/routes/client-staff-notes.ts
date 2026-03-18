import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { clientStaffNotes, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { clientStaffNoteSchemas } from "../utils/swagger-schemas.js";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS client_staff_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    is_private INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const clientStaffNotesRoutes: FastifyPluginAsync = async (fastify) => {
  rawSqlite.exec(MIGRATION_SQL);

  // GET /clients/:id/staff-notes — list notes for a client
  fastify.get<{ Params: { id: string } }>("/clients/:id/staff-notes", { schema: clientStaffNoteSchemas.list }, async (request, reply) => {
    const role = request.auth!.role;
    const authUserId = request.auth!.id;
    const clientId = parseInt(request.params.id);

    // Clients cannot see staff notes
    if (role === "CLIENT") return reply.status(403).send({ error: "Forbidden" });

    // Verify client exists
    const [client] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);
    if (!client || client.role !== "CLIENT") {
      return reply.status(404).send({ error: "Client not found" });
    }

    let rows: any[];
    if (role === "ADMIN") {
      // ADMIN sees all notes including private
      rows = rawSqlite.prepare(
        `SELECT csn.*, u.name as author_name, u.role as author_role
         FROM client_staff_notes csn
         JOIN users u ON u.id = csn.author_id
         WHERE csn.client_id = ?
         ORDER BY csn.created_at DESC`,
      ).all(clientId);
    } else {
      // RECEPTION/EMPLOYEE see non-private + own private
      rows = rawSqlite.prepare(
        `SELECT csn.*, u.name as author_name, u.role as author_role
         FROM client_staff_notes csn
         JOIN users u ON u.id = csn.author_id
         WHERE csn.client_id = ? AND (csn.is_private = 0 OR csn.author_id = ?)
         ORDER BY csn.created_at DESC`,
      ).all(clientId, authUserId);
    }

    return rows;
  });

  // POST /clients/:id/staff-notes — add note
  fastify.post<{
    Params: { id: string };
    Body: { note: string; isPrivate?: boolean };
  }>("/clients/:id/staff-notes", { schema: clientStaffNoteSchemas.create }, async (request, reply) => {
    const role = request.auth!.role;
    const authorId = request.auth!.id;
    const clientId = parseInt(request.params.id);
    const { note, isPrivate = false } = request.body ?? {};

    if (role === "CLIENT") return reply.status(403).send({ error: "Forbidden" });
    if (!note || note.trim().length === 0) {
      return reply.status(400).send({ error: "Note cannot be empty" });
    }
    if (note.length > 2000) {
      return reply.status(400).send({ error: "Note too long (max 2000 chars)" });
    }

    // Verify client exists
    const [client] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);
    if (!client || client.role !== "CLIENT") {
      return reply.status(404).send({ error: "Client not found" });
    }

    const [created] = await db
      .insert(clientStaffNotes)
      .values({
        clientId,
        authorId,
        note: note.trim(),
        isPrivate: role === "ADMIN" ? isPrivate : false, // only ADMIN can set private
      })
      .returning();

    return reply.status(201).send(created);
  });

  // PATCH /staff-notes/:id — edit own note
  fastify.patch<{
    Params: { id: string };
    Body: { note?: string; isPrivate?: boolean };
  }>("/staff-notes/:id", { schema: clientStaffNoteSchemas.update }, async (request, reply) => {
    const role = request.auth!.role;
    const authUserId = request.auth!.id;
    const noteId = parseInt(request.params.id);
    const { note, isPrivate } = request.body ?? {};

    const [existing] = await db
      .select()
      .from(clientStaffNotes)
      .where(eq(clientStaffNotes.id, noteId))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: "Note not found" });

    // Only author or ADMIN can edit
    if (existing.authorId !== authUserId && role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (note !== undefined) {
      if (note.trim().length === 0) return reply.status(400).send({ error: "Note cannot be empty" });
      updates.note = note.trim();
    }
    if (isPrivate !== undefined && role === "ADMIN") {
      updates.isPrivate = isPrivate;
    }

    await db.update(clientStaffNotes).set(updates).where(eq(clientStaffNotes.id, noteId));

    const [updated] = await db
      .select()
      .from(clientStaffNotes)
      .where(eq(clientStaffNotes.id, noteId))
      .limit(1);

    return updated;
  });

  // DELETE /staff-notes/:id — delete note (author or ADMIN)
  fastify.delete<{ Params: { id: string } }>("/staff-notes/:id", { schema: clientStaffNoteSchemas.delete }, async (request, reply) => {
    const role = request.auth!.role;
    const authUserId = request.auth!.id;
    const noteId = parseInt(request.params.id);

    const [existing] = await db
      .select({ id: clientStaffNotes.id, authorId: clientStaffNotes.authorId })
      .from(clientStaffNotes)
      .where(eq(clientStaffNotes.id, noteId))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: "Note not found" });
    if (existing.authorId !== authUserId && role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    await db.delete(clientStaffNotes).where(eq(clientStaffNotes.id, noteId));
    return { ok: true };
  });
};

export default clientStaffNotesRoutes;
