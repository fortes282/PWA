/**
 * Session Note Templates
 * CRUD for reusable session note templates for therapists.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

function ensureSessionTemplatesTable() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS session_note_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      is_global INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_session_note_templates_category ON session_note_templates(category);
    CREATE INDEX IF NOT EXISTS idx_session_note_templates_created_by ON session_note_templates(created_by);
  `);
}

const sessionTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  ensureSessionTemplatesTable();

  // GET /session-templates — list templates (EMPLOYEE/ADMIN)
  fastify.get("/session-templates", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { category?: string };
    const conditions: string[] = ["t.is_active = 1"];
    const params: any[] = [];

    // EMPLOYEE sees own templates + global ones; ADMIN sees all
    if (role === "EMPLOYEE") {
      conditions.push("(t.created_by = ? OR t.is_global = 1)");
      params.push(userId);
    }

    if (q.category) {
      conditions.push("t.category = ?");
      params.push(q.category);
    }

    const where = conditions.join(" AND ");
    const rows = rawSqlite.prepare(
      `SELECT t.*, u.name as created_by_name
       FROM session_note_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE ${where}
       ORDER BY t.is_global DESC, t.title ASC`
    ).all(...params);

    return rows;
  });

  // GET /session-templates/:id — detail (EMPLOYEE/ADMIN)
  fastify.get<{ Params: { id: string } }>("/session-templates/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt(request.params.id);
    const row = rawSqlite.prepare(
      `SELECT t.*, u.name as created_by_name
       FROM session_note_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.id = ? AND t.is_active = 1`
    ).get(id) as any;

    if (!row) return reply.code(404).send({ error: "Template not found" });

    // EMPLOYEE can only see own or global templates
    if (role === "EMPLOYEE" && row.created_by !== userId && !row.is_global) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return row;
  });

  // POST /session-templates — create (EMPLOYEE/ADMIN)
  fastify.post("/session-templates", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as any;
    const { title, category, content, isGlobal } = body;

    if (!title || !category || !content) {
      return reply.code(400).send({ error: "title, category, and content are required" });
    }

    // Only ADMIN can create global templates
    const globalFlag = (role === "ADMIN" && isGlobal) ? 1 : 0;

    const result = rawSqlite.prepare(
      `INSERT INTO session_note_templates (title, category, content, created_by, is_global)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    ).get(title, category, content, userId, globalFlag);

    return reply.code(201).send(result);
  });

  // PATCH /session-templates/:id — update (EMPLOYEE/ADMIN)
  fastify.patch<{ Params: { id: string } }>("/session-templates/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt(request.params.id);
    const existing = rawSqlite.prepare(
      "SELECT * FROM session_note_templates WHERE id = ? AND is_active = 1"
    ).get(id) as any;
    if (!existing) return reply.code(404).send({ error: "Template not found" });

    // EMPLOYEE can only update own templates
    if (role === "EMPLOYEE" && existing.created_by !== userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as any;
    const updates: string[] = [];
    const values: any[] = [];

    for (const [jsKey, dbKey] of [
      ["title", "title"], ["category", "category"], ["content", "content"],
    ] as const) {
      if (body[jsKey] !== undefined) {
        updates.push(`${dbKey} = ?`);
        values.push(body[jsKey]);
      }
    }

    // Only ADMIN can toggle global flag
    if (role === "ADMIN" && body.isGlobal !== undefined) {
      updates.push("is_global = ?");
      values.push(body.isGlobal ? 1 : 0);
    }

    if (updates.length === 0) return reply.code(400).send({ error: "No fields to update" });

    values.push(id);
    const row = rawSqlite.prepare(
      `UPDATE session_note_templates SET ${updates.join(", ")} WHERE id = ? RETURNING *`
    ).get(...values);

    return row;
  });

  // DELETE /session-templates/:id — soft delete (ADMIN or owner)
  fastify.delete<{ Params: { id: string } }>("/session-templates/:id", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt(request.params.id);
    const existing = rawSqlite.prepare(
      "SELECT * FROM session_note_templates WHERE id = ? AND is_active = 1"
    ).get(id) as any;
    if (!existing) return reply.code(404).send({ error: "Template not found" });

    // ADMIN can delete any; EMPLOYEE can only delete own
    if (role !== "ADMIN" && existing.created_by !== userId) {
      return reply.code(403).send({ error: "Forbidden — only admin or owner can delete" });
    }

    rawSqlite.prepare("UPDATE session_note_templates SET is_active = 0 WHERE id = ?").run(id);
    return { success: true };
  });
};

export default sessionTemplatesRoutes;
