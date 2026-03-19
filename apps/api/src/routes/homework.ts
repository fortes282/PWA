import { FastifyInstance } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import path from "path";
import fs from "fs";

// Ensure homework table exists (runtime migration)
function ensureHomeworkTable() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      appointment_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      exercises TEXT,
      video_url TEXT,
      media_urls TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      completed_at TEXT,
      client_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_homework_client ON homework(client_id);
    CREATE INDEX IF NOT EXISTS idx_homework_employee ON homework(employee_id);
  `);
  // Additive migration: add media_urls column if missing
  try {
    rawSqlite.exec(`ALTER TABLE homework ADD COLUMN media_urls TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

export default async function homeworkRoutes(app: FastifyInstance) {
  ensureHomeworkTable();

  // GET /homework — client's homework list
  app.get("/homework", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const status = (req.query as any).status || "ACTIVE";

    if (user.role === "CLIENT") {
      const rows = rawSqlite.prepare(
        `SELECT h.*, u.name as employee_name 
         FROM homework h 
         LEFT JOIN users u ON u.id = h.employee_id
         WHERE h.client_id = ? AND h.status = ?
         ORDER BY h.created_at DESC`
      ).all(user.id, status);
      return rows;
    }

    if (["EMPLOYEE", "ADMIN", "RECEPTION"].includes(user.role)) {
      const clientId = (req.query as any).clientId;
      if (clientId) {
        const rows = rawSqlite.prepare(
          `SELECT h.*, u.name as client_name, e.name as employee_name
           FROM homework h
           LEFT JOIN users u ON u.id = h.client_id
           LEFT JOIN users e ON e.id = h.employee_id
           WHERE h.client_id = ?
           ORDER BY h.created_at DESC`
        ).all(parseInt(clientId));
        return rows;
      }
      // Employee: own assigned homework
      if (user.role === "EMPLOYEE") {
        const rows = rawSqlite.prepare(
          `SELECT h.*, u.name as client_name
           FROM homework h
           LEFT JOIN users u ON u.id = h.client_id
           WHERE h.employee_id = ?
           ORDER BY h.created_at DESC
           LIMIT 50`
        ).all(user.id);
        return rows;
      }
      return [];
    }

    return reply.status(403).send({ error: "Forbidden" });
  });

  // POST /homework — therapist assigns homework
  app.post("/homework", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = req.body as any;
    const { clientId, appointmentId, title, description, exercises, videoUrl, mediaUrls, dueDate } = body;

    if (!clientId || !title) {
      return reply.status(400).send({ error: "clientId and title are required" });
    }

    const result = rawSqlite.prepare(
      `INSERT INTO homework (client_id, employee_id, appointment_id, title, description, exercises, video_url, media_urls, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).get(
      clientId,
      user.id,
      appointmentId || null,
      title,
      description || null,
      exercises ? JSON.stringify(exercises) : null,
      videoUrl || null,
      mediaUrls ? JSON.stringify(mediaUrls) : null,
      dueDate || null
    );

    // Create notification for client
    rawSqlite.prepare(
      `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'HOMEWORK', ?, ?)`
    ).run(clientId, "Nové domácí cvičení", `Terapeut vám přiřadil: ${title}`);

    return reply.status(201).send(result);
  });

  // PATCH /homework/:id — update homework (mark complete, add client notes)
  app.patch("/homework/:id", async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const id = parseInt((req.params as any).id);
    const existing = rawSqlite.prepare("SELECT * FROM homework WHERE id = ?").get(id) as any;
    if (!existing) return reply.status(404).send({ error: "Not found" });

    // Client can mark complete and add notes
    if (user.role === "CLIENT" && existing.client_id !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    // Employee can update their own assignments
    if (user.role === "EMPLOYEE" && existing.employee_id !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = req.body as any;
    const updates: string[] = [];
    const values: any[] = [];

    if (body.status !== undefined) {
      updates.push("status = ?");
      values.push(body.status);
      if (body.status === "COMPLETED") {
        updates.push("completed_at = datetime('now')");
      }
    }
    if (body.clientNotes !== undefined) {
      updates.push("client_notes = ?");
      values.push(body.clientNotes);
    }
    if (body.title !== undefined) {
      updates.push("title = ?");
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(body.description);
    }
    if (body.exercises !== undefined) {
      updates.push("exercises = ?");
      values.push(JSON.stringify(body.exercises));
    }
    if (body.videoUrl !== undefined) {
      updates.push("video_url = ?");
      values.push(body.videoUrl);
    }
    if (body.mediaUrls !== undefined) {
      updates.push("media_urls = ?");
      values.push(JSON.stringify(body.mediaUrls));
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    const result = rawSqlite.prepare(
      `UPDATE homework SET ${updates.join(", ")} WHERE id = ? RETURNING *`
    ).get(...values);

    return result;
  });

  // DELETE /homework/:id — therapist removes homework
  app.delete("/homework/:id", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const id = parseInt((req.params as any).id);
    rawSqlite.prepare("DELETE FROM homework WHERE id = ?").run(id);
    return { success: true };
  });

  // POST /homework/:id/media — upload media file (base64 data URL) for homework
  // Employees attach images/videos to homework items
  app.post("/homework/:id/media", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const id = parseInt((req.params as any).id);
    const existing = rawSqlite.prepare("SELECT * FROM homework WHERE id = ?").get(id) as any;
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const body = req.body as { file: string; filename?: string };
    if (!body.file || typeof body.file !== "string") {
      return reply.status(400).send({ error: "file (base64 data URL) is required" });
    }

    const match = body.file.match(/^data:(image\/(jpeg|jpg|png|webp|gif)|video\/(mp4|webm|mov));base64,(.+)$/);
    if (!match) {
      return reply.status(400).send({ error: "Invalid file format. Use base64 data URL (image/video)." });
    }

    const mimeType = match[1];
    const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
    const mediaDir = path.join(process.env.DATA_PATH ?? "./data", "homework-media");
    fs.mkdirSync(mediaDir, { recursive: true });

    const filename = `hw-${id}-${Date.now()}.${ext}`;
    const filePath = path.join(mediaDir, filename);
    fs.writeFileSync(filePath, Buffer.from(match[4], "base64"));

    const fileUrl = `/data/homework-media/${filename}`;

    // Append to media_urls array
    const currentMediaUrls: string[] = existing.media_urls ? JSON.parse(existing.media_urls) : [];
    currentMediaUrls.push(fileUrl);

    rawSqlite.prepare(
      "UPDATE homework SET media_urls = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(currentMediaUrls), id);

    return { url: fileUrl, mediaUrls: currentMediaUrls };
  });

  // DELETE /homework/:id/media — remove a specific media file
  app.delete("/homework/:id/media", async (req, reply) => {
    const user = (req as any).user;
    if (!user || !["EMPLOYEE", "ADMIN"].includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const id = parseInt((req.params as any).id);
    const existing = rawSqlite.prepare("SELECT * FROM homework WHERE id = ?").get(id) as any;
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const { url } = req.body as { url: string };
    const currentMediaUrls: string[] = existing.media_urls ? JSON.parse(existing.media_urls) : [];
    const updated = currentMediaUrls.filter((u) => u !== url);

    rawSqlite.prepare(
      "UPDATE homework SET media_urls = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(updated), id);

    // Try to delete the physical file
    try {
      const mediaDir = path.join(process.env.DATA_PATH ?? "./data", "homework-media");
      const filename = path.basename(url);
      fs.unlinkSync(path.join(mediaDir, filename));
    } catch {
      // File may not exist on disk — ignore
    }

    return { mediaUrls: updated };
  });
}
