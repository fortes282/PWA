/**
 * Exercise / Video Library
 * CRUD for exercise definitions used in homework assignments.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

function ensureExerciseLibraryTable() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS exercise_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      video_url TEXT,
      thumbnail_url TEXT,
      duration INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      body_part TEXT,
      instructions TEXT,
      created_by INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_exercise_library_category ON exercise_library(category);
    CREATE INDEX IF NOT EXISTS idx_exercise_library_difficulty ON exercise_library(difficulty);
  `);
}

const exerciseLibraryRoutes: FastifyPluginAsync = async (fastify) => {
  ensureExerciseLibraryTable();

  // GET /exercise-library — list exercises (ALL authenticated)
  fastify.get("/exercise-library", async (request, reply) => {
    const { role } = request.auth!;
    if (!role) return reply.code(401).send({ error: "Unauthorized" });

    const q = request.query as { category?: string; difficulty?: string; bodyPart?: string };

    const conditions: string[] = ["is_active = 1"];
    const params: any[] = [];

    if (q.category) {
      conditions.push("category = ?");
      params.push(q.category);
    }
    if (q.difficulty) {
      conditions.push("difficulty = ?");
      params.push(q.difficulty);
    }
    if (q.bodyPart) {
      conditions.push("body_part = ?");
      params.push(q.bodyPart);
    }

    const where = conditions.join(" AND ");
    const rows = rawSqlite.prepare(
      `SELECT e.*, u.name as created_by_name
       FROM exercise_library e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE ${where}
       ORDER BY e.title ASC`
    ).all(...params);

    return rows;
  });

  // GET /exercise-library/:id — detail (ALL authenticated)
  fastify.get<{ Params: { id: string } }>("/exercise-library/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (!role) return reply.code(401).send({ error: "Unauthorized" });

    const id = parseInt(request.params.id);
    const row = rawSqlite.prepare(
      `SELECT e.*, u.name as created_by_name
       FROM exercise_library e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = ? AND e.is_active = 1`
    ).get(id);

    if (!row) return reply.code(404).send({ error: "Exercise not found" });
    return row;
  });

  // POST /exercise-library — create (ADMIN/EMPLOYEE)
  fastify.post("/exercise-library", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["ADMIN", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as any;
    const { title, description, category, videoUrl, thumbnailUrl, duration, difficulty, bodyPart, instructions } = body;

    if (!title || !description || !category || !duration || !difficulty) {
      return reply.code(400).send({ error: "title, description, category, duration, and difficulty are required" });
    }

    const result = rawSqlite.prepare(
      `INSERT INTO exercise_library (title, description, category, video_url, thumbnail_url, duration, difficulty, body_part, instructions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).get(title, description, category, videoUrl || null, thumbnailUrl || null, duration, difficulty, bodyPart || null, instructions || null, userId);

    return reply.code(201).send(result);
  });

  // PATCH /exercise-library/:id — update (ADMIN/EMPLOYEE)
  fastify.patch<{ Params: { id: string } }>("/exercise-library/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt(request.params.id);
    const existing = rawSqlite.prepare("SELECT * FROM exercise_library WHERE id = ?").get(id) as any;
    if (!existing) return reply.code(404).send({ error: "Exercise not found" });

    const body = request.body as any;
    const updates: string[] = [];
    const values: any[] = [];

    for (const [jsKey, dbKey] of [
      ["title", "title"], ["description", "description"], ["category", "category"],
      ["videoUrl", "video_url"], ["thumbnailUrl", "thumbnail_url"], ["duration", "duration"],
      ["difficulty", "difficulty"], ["bodyPart", "body_part"], ["instructions", "instructions"],
    ] as const) {
      if (body[jsKey] !== undefined) {
        updates.push(`${dbKey} = ?`);
        values.push(body[jsKey]);
      }
    }

    if (updates.length === 0) return reply.code(400).send({ error: "No fields to update" });

    values.push(id);
    const row = rawSqlite.prepare(
      `UPDATE exercise_library SET ${updates.join(", ")} WHERE id = ? RETURNING *`
    ).get(...values);

    return row;
  });

  // DELETE /exercise-library/:id — soft delete (ADMIN only)
  fastify.delete<{ Params: { id: string } }>("/exercise-library/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const id = parseInt(request.params.id);
    const existing = rawSqlite.prepare("SELECT * FROM exercise_library WHERE id = ?").get(id) as any;
    if (!existing) return reply.code(404).send({ error: "Exercise not found" });

    rawSqlite.prepare("UPDATE exercise_library SET is_active = 0 WHERE id = ?").run(id);
    return { success: true };
  });
};

export default exerciseLibraryRoutes;
