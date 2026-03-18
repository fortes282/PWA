import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { appointmentRatings, appointments, users } from "../db/schema.js";
import { eq, avg, and, desc } from "drizzle-orm";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS appointment_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(appointment_id)
  )
`;

const ratingsRoutes: FastifyPluginAsync = async (fastify) => {
  rawSqlite.exec(MIGRATION_SQL);

  // POST /appointments/:id/rating — CLIENT submits rating for COMPLETED appointment
  fastify.post<{
    Params: { id: string };
    Body: { rating: number; comment?: string };
  }>("/appointments/:id/rating", async (request, reply) => {
    const role = request.auth!.role;
    const userId = request.auth!.id;
    const apptId = parseInt(request.params.id);
    const { rating, comment } = request.body ?? {};

    if (role !== "CLIENT") return reply.status(403).send({ error: "Clients only" });
    if (!rating || rating < 1 || rating > 5) {
      return reply.status(400).send({ error: "Rating must be 1–5" });
    }

    // Verify appointment belongs to this client and is COMPLETED
    const [appt] = await db
      .select({ id: appointments.id, clientId: appointments.clientId, status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, apptId))
      .limit(1);

    if (!appt) return reply.status(404).send({ error: "Appointment not found" });
    if (appt.clientId !== userId) return reply.status(403).send({ error: "Not your appointment" });
    if (appt.status !== "COMPLETED") {
      return reply.status(400).send({ error: "Only COMPLETED appointments can be rated" });
    }

    // Check no existing rating
    const [existing] = await db
      .select({ id: appointmentRatings.id })
      .from(appointmentRatings)
      .where(eq(appointmentRatings.appointmentId, apptId))
      .limit(1);
    if (existing) return reply.status(409).send({ error: "Already rated" });

    const [created] = await db
      .insert(appointmentRatings)
      .values({ appointmentId: apptId, clientId: userId, rating, comment: comment ?? null })
      .returning();

    return reply.status(201).send(created);
  });

  // GET /appointments/:id/rating — get rating for appointment
  fastify.get<{ Params: { id: string } }>("/appointments/:id/rating", async (request, reply) => {
    const role = request.auth!.role;
    const userId = request.auth!.id;
    const apptId = parseInt(request.params.id);

    const [appt] = await db
      .select({ clientId: appointments.clientId, employeeId: appointments.employeeId })
      .from(appointments)
      .where(eq(appointments.id, apptId))
      .limit(1);

    if (!appt) return reply.status(404).send({ error: "Appointment not found" });

    // Only client (own), employee (own), RECEPTION/ADMIN
    if (
      role === "CLIENT" && appt.clientId !== userId &&
      role === "EMPLOYEE" && appt.employeeId !== userId
    ) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [r] = await db
      .select()
      .from(appointmentRatings)
      .where(eq(appointmentRatings.appointmentId, apptId))
      .limit(1);

    return r ?? null;
  });

  // GET /employees/:id/ratings — employee's average rating + recent comments
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/employees/:id/ratings",
    async (request, reply) => {
      const empId = parseInt(request.params.id);
      const limit = Math.min(parseInt(request.query.limit ?? "10"), 50);

      // Verify employee exists
      const [emp] = await db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.id, empId))
        .limit(1);
      if (!emp || emp.role !== "EMPLOYEE") {
        return reply.status(404).send({ error: "Employee not found" });
      }

      // Get all appointment IDs for this employee
      const empAppts = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(eq(appointments.employeeId, empId));

      if (empAppts.length === 0) {
        return { employeeId: empId, averageRating: null, totalRatings: 0, recentComments: [] };
      }

      const apptIds = empAppts.map((a: any) => a.id);

      // Fetch all ratings for these appointments
      const placeholders = apptIds.map(() => "?").join(",");
      const allRatings: any[] = rawSqlite.prepare(
        `SELECT ar.*, a.start_time FROM appointment_ratings ar
         JOIN appointments a ON a.id = ar.appointment_id
         WHERE ar.appointment_id IN (${placeholders})
         ORDER BY ar.created_at DESC
         LIMIT ?`,
      ).all(...apptIds, limit);

      const totalRatings = allRatings.length;
      const avgRating =
        totalRatings > 0
          ? Math.round((allRatings.reduce((s: number, r: any) => s + r.rating, 0) / totalRatings) * 10) / 10
          : null;

      return {
        employeeId: empId,
        employeeName: emp.name,
        averageRating: avgRating,
        totalRatings,
        recentComments: allRatings.filter((r: any) => r.comment).slice(0, limit),
      };
    },
  );

  // GET /ratings/summary — admin overview of all employee ratings
  fastify.get("/ratings/summary", async (request, reply) => {
    const role = request.auth!.role;
    if (role !== "ADMIN" && role !== "RECEPTION") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const rows = rawSqlite.prepare(`
      SELECT u.id as employee_id, u.name as employee_name,
             COUNT(ar.id) as total_ratings,
             ROUND(AVG(ar.rating), 1) as avg_rating
      FROM users u
      JOIN appointments a ON a.employee_id = u.id
      JOIN appointment_ratings ar ON ar.appointment_id = a.id
      WHERE u.role = 'EMPLOYEE' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY avg_rating DESC
    `).all();

    return rows;
  });
};

export default ratingsRoutes;
