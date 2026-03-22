import { FastifyInstance } from "fastify";
import { rawSqlite } from "../db/index.js";

function ensureTables() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS intensive_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      max_participants INTEGER NOT NULL DEFAULT 10,
      price_per_person REAL NOT NULL,
      includes_accommodation INTEGER NOT NULL DEFAULT 0,
      accommodation_details TEXT,
      meal_plan TEXT,
      program_details TEXT,
      employee_id INTEGER NOT NULL REFERENCES users(id),
      service_id INTEGER REFERENCES services(id),
      status TEXT NOT NULL DEFAULT 'DRAFT',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS intensive_block_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL REFERENCES intensive_blocks(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'ENROLLED',
      payment_status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(block_id, client_id)
    );

    CREATE INDEX IF NOT EXISTS idx_intensive_blocks_status ON intensive_blocks(status);
    CREATE INDEX IF NOT EXISTS idx_intensive_block_enrollments_block ON intensive_block_enrollments(block_id);
    CREATE INDEX IF NOT EXISTS idx_intensive_block_enrollments_client ON intensive_block_enrollments(client_id);
  `);
}

const STAFF_ROLES = ["ADMIN", "RECEPTION", "EMPLOYEE"];

export default async function intensiveBlocksRoutes(app: FastifyInstance) {
  ensureTables();

  // GET /intensive-blocks — list blocks
  app.get("/intensive-blocks", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const isStaff = STAFF_ROLES.includes(user.role);
    const whereClause = isStaff ? "" : "WHERE ib.status = 'PUBLISHED' AND ib.is_active = 1";

    const blocks = rawSqlite
      .prepare(
        `SELECT ib.*,
          u.name as employee_name,
          s.name as service_name,
          (SELECT COUNT(*) FROM intensive_block_enrollments ibe WHERE ibe.block_id = ib.id AND ibe.status = 'ENROLLED') as enrolled_count,
          (SELECT ibe2.status FROM intensive_block_enrollments ibe2 WHERE ibe2.block_id = ib.id AND ibe2.client_id = ? LIMIT 1) as my_enrollment_status
         FROM intensive_blocks ib
         LEFT JOIN users u ON u.id = ib.employee_id
         LEFT JOIN services s ON s.id = ib.service_id
         ${whereClause}
         ORDER BY ib.start_date ASC`
      )
      .all(user.id);

    return blocks;
  });

  // GET /intensive-blocks/:id — single block with enrollment count
  app.get<{ Params: { id: string } }>("/intensive-blocks/:id", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    const isStaff = STAFF_ROLES.includes(user.role);

    const block = rawSqlite
      .prepare(
        `SELECT ib.*,
          u.name as employee_name,
          s.name as service_name,
          (SELECT COUNT(*) FROM intensive_block_enrollments ibe WHERE ibe.block_id = ib.id AND ibe.status = 'ENROLLED') as enrolled_count,
          (SELECT ibe2.status FROM intensive_block_enrollments ibe2 WHERE ibe2.block_id = ib.id AND ibe2.client_id = ? LIMIT 1) as my_enrollment_status
         FROM intensive_blocks ib
         LEFT JOIN users u ON u.id = ib.employee_id
         LEFT JOIN services s ON s.id = ib.service_id
         WHERE ib.id = ?`
      )
      .get(user.id, id) as any;

    if (!block) return reply.status(404).send({ error: "Not found" });
    if (!isStaff && (block.status !== "PUBLISHED" || !block.is_active)) {
      return reply.status(404).send({ error: "Not found" });
    }

    return block;
  });

  // POST /intensive-blocks — create (STAFF only)
  app.post("/intensive-blocks", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = req.body as any;
    const {
      title, description, startDate, endDate, maxParticipants, pricePerPerson,
      includesAccommodation, accommodationDetails, mealPlan, programDetails,
      employeeId, serviceId, status,
    } = body;

    if (!title || !startDate || !endDate || pricePerPerson === undefined) {
      return reply.status(400).send({ error: "title, startDate, endDate, pricePerPerson are required" });
    }

    const result = rawSqlite
      .prepare(
        `INSERT INTO intensive_blocks
          (title, description, start_date, end_date, max_participants, price_per_person,
           includes_accommodation, accommodation_details, meal_plan, program_details,
           employee_id, service_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(
        title,
        description ?? null,
        startDate,
        endDate,
        maxParticipants ?? 10,
        pricePerPerson,
        includesAccommodation ? 1 : 0,
        accommodationDetails ?? null,
        mealPlan ?? null,
        programDetails ?? null,
        employeeId ?? user.id,
        serviceId ?? null,
        status ?? "DRAFT",
      ) as any;

    return reply.status(201).send(result);
  });

  // PATCH /intensive-blocks/:id — update (STAFF only)
  app.patch<{ Params: { id: string } }>("/intensive-blocks/:id", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const id = parseInt(req.params.id);
    const existing = rawSqlite.prepare("SELECT id FROM intensive_blocks WHERE id = ?").get(id);
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const body = req.body as any;
    const fields: string[] = [];
    const values: any[] = [];

    const map: Record<string, string> = {
      title: "title",
      description: "description",
      startDate: "start_date",
      endDate: "end_date",
      maxParticipants: "max_participants",
      pricePerPerson: "price_per_person",
      includesAccommodation: "includes_accommodation",
      accommodationDetails: "accommodation_details",
      mealPlan: "meal_plan",
      programDetails: "program_details",
      employeeId: "employee_id",
      serviceId: "service_id",
      status: "status",
      isActive: "is_active",
    };

    for (const [jsKey, dbCol] of Object.entries(map)) {
      if (body[jsKey] !== undefined) {
        fields.push(`${dbCol} = ?`);
        // Convert booleans for SQLite
        if (jsKey === "includesAccommodation" || jsKey === "isActive") {
          values.push(body[jsKey] ? 1 : 0);
        } else {
          values.push(body[jsKey]);
        }
      }
    }

    if (fields.length === 0) return reply.status(400).send({ error: "No fields to update" });

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const updated = rawSqlite
      .prepare(`UPDATE intensive_blocks SET ${fields.join(", ")} WHERE id = ? RETURNING *`)
      .get(...values) as any;

    return updated;
  });

  // DELETE /intensive-blocks/:id — soft-delete via CANCELLED (ADMIN only)
  app.delete<{ Params: { id: string } }>("/intensive-blocks/:id", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || user.role !== "ADMIN") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const id = parseInt(req.params.id);
    const updated = rawSqlite
      .prepare(
        "UPDATE intensive_blocks SET status = 'CANCELLED', is_active = 0, updated_at = datetime('now') WHERE id = ? RETURNING *"
      )
      .get(id) as any;

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  // POST /intensive-blocks/:id/enroll — enroll self (CLIENT)
  app.post<{ Params: { id: string } }>("/intensive-blocks/:id/enroll", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    if (user.role !== "CLIENT") return reply.status(403).send({ error: "Only clients can enroll" });

    const id = parseInt(req.params.id);
    const block = rawSqlite
      .prepare("SELECT * FROM intensive_blocks WHERE id = ? AND status = 'PUBLISHED' AND is_active = 1")
      .get(id) as any;

    if (!block) return reply.status(404).send({ error: "Block not found or not available" });

    const enrolledCount = (rawSqlite
      .prepare("SELECT COUNT(*) as cnt FROM intensive_block_enrollments WHERE block_id = ? AND status = 'ENROLLED'")
      .get(id) as any).cnt;

    const existing = rawSqlite
      .prepare("SELECT * FROM intensive_block_enrollments WHERE block_id = ? AND client_id = ?")
      .get(id, user.id) as any;

    if (existing) {
      if (existing.status === "ENROLLED") {
        return reply.status(409).send({ error: "Already enrolled" });
      }
      // Re-enroll if previously cancelled
      const isFull = enrolledCount >= block.max_participants;
      const newStatus = isFull ? "WAITLIST" : "ENROLLED";
      const updated = rawSqlite
        .prepare(
          "UPDATE intensive_block_enrollments SET status = ?, payment_status = 'PENDING', enrolled_at = datetime('now') WHERE id = ? RETURNING *"
        )
        .get(newStatus, existing.id);
      return reply.status(200).send(updated);
    }

    const isFull = enrolledCount >= block.max_participants;
    const enrollStatus = isFull ? "WAITLIST" : "ENROLLED";

    const enrollment = rawSqlite
      .prepare(
        "INSERT INTO intensive_block_enrollments (block_id, client_id, status) VALUES (?, ?, ?) RETURNING *"
      )
      .get(id, user.id, enrollStatus) as any;

    // Mark block as FULL if capacity reached
    if (!isFull && enrolledCount + 1 >= block.max_participants) {
      rawSqlite
        .prepare("UPDATE intensive_blocks SET status = 'FULL', updated_at = datetime('now') WHERE id = ?")
        .run(id);
    }

    return reply.status(201).send(enrollment);
  });

  // DELETE /intensive-blocks/:id/enroll — cancel own enrollment (CLIENT)
  app.delete<{ Params: { id: string } }>("/intensive-blocks/:id/enroll", async (req, reply) => {
    const user = (req as any).auth;
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    if (user.role !== "CLIENT") return reply.status(403).send({ error: "Forbidden" });

    const id = parseInt(req.params.id);
    const enrollment = rawSqlite
      .prepare("SELECT * FROM intensive_block_enrollments WHERE block_id = ? AND client_id = ? AND status = 'ENROLLED'")
      .get(id, user.id) as any;

    if (!enrollment) return reply.status(404).send({ error: "Active enrollment not found" });

    rawSqlite
      .prepare("UPDATE intensive_block_enrollments SET status = 'CANCELLED' WHERE id = ?")
      .run(enrollment.id);

    // If block was FULL, set back to PUBLISHED and promote waitlist
    const block = rawSqlite.prepare("SELECT status FROM intensive_blocks WHERE id = ?").get(id) as any;
    if (block?.status === "FULL") {
      rawSqlite
        .prepare("UPDATE intensive_blocks SET status = 'PUBLISHED', updated_at = datetime('now') WHERE id = ?")
        .run(id);

      // Promote first waitlisted person
      const waitlisted = rawSqlite
        .prepare("SELECT * FROM intensive_block_enrollments WHERE block_id = ? AND status = 'WAITLIST' ORDER BY enrolled_at ASC LIMIT 1")
        .get(id) as any;
      if (waitlisted) {
        rawSqlite
          .prepare("UPDATE intensive_block_enrollments SET status = 'ENROLLED' WHERE id = ?")
          .run(waitlisted.id);
      }
    }

    return { message: "Enrollment cancelled" };
  });

  // GET /intensive-blocks/:id/enrollments — list enrollments (STAFF only)
  app.get<{ Params: { id: string } }>("/intensive-blocks/:id/enrollments", async (req, reply) => {
    const user = (req as any).auth;
    if (!user || !STAFF_ROLES.includes(user.role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const id = parseInt(req.params.id);
    const block = rawSqlite.prepare("SELECT id FROM intensive_blocks WHERE id = ?").get(id);
    if (!block) return reply.status(404).send({ error: "Block not found" });

    const enrollments = rawSqlite
      .prepare(
        `SELECT ibe.*, u.name as client_name, u.email as client_email, u.phone as client_phone
         FROM intensive_block_enrollments ibe
         JOIN users u ON u.id = ibe.client_id
         WHERE ibe.block_id = ?
         ORDER BY ibe.enrolled_at ASC`
      )
      .all(id);

    return enrollments;
  });
}
