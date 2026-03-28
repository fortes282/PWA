import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

/**
 * Therapist–Service assignments: which services each therapist (employee) can offer.
 * Used by scheduling to validate slot availability per service.
 */
const therapistServicesRoutes: FastifyPluginAsync = async (fastify) => {
  // Ensure table exists
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS therapist_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(employee_id, service_id)
    )
  `);

  // GET /therapist-services — ADMIN/RECEPTION: list all assignments (join users+services)
  fastify.get("/therapist-services", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const rows = rawSqlite.prepare(`
      SELECT
        ts.id,
        ts.employee_id AS employeeId,
        u.name AS employeeName,
        ts.service_id AS serviceId,
        s.name AS serviceName,
        ts.created_at AS createdAt
      FROM therapist_services ts
      JOIN users u ON u.id = ts.employee_id
      JOIN services s ON s.id = ts.service_id
      ORDER BY u.name, s.name
    `).all();

    return rows;
  });

  // GET /therapist-services/:employeeId — ALL authenticated: services for specific therapist
  fastify.get<{ Params: { employeeId: string } }>(
    "/therapist-services/:employeeId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION", "EMPLOYEE", "CLIENT"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const empId = parseInt(request.params.employeeId);
      const rows = rawSqlite.prepare(`
        SELECT
          ts.id,
          ts.employee_id AS employeeId,
          ts.service_id AS serviceId,
          s.name AS serviceName,
          s.duration_min AS durationMin,
          s.price,
          s.category,
          ts.created_at AS createdAt
        FROM therapist_services ts
        JOIN services s ON s.id = ts.service_id
        WHERE ts.employee_id = ?
        ORDER BY s.name
      `).all(empId);

      return rows;
    }
  );

  // PUT /therapist-services/:employeeId — ADMIN/RECEPTION: upsert service assignments
  // Body: { serviceIds: number[] }. Delete old, insert new.
  fastify.put<{ Params: { employeeId: string } }>(
    "/therapist-services/:employeeId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const empId = parseInt(request.params.employeeId);
      const body = request.body as { serviceIds: number[] };

      if (!Array.isArray(body.serviceIds)) {
        return reply.code(400).send({ error: "serviceIds must be an array of numbers" });
      }

      // Verify employee exists and is EMPLOYEE role
      const employee = rawSqlite.prepare(
        "SELECT id FROM users WHERE id = ? AND role = 'EMPLOYEE'"
      ).get(empId) as any;

      if (!employee) {
        return reply.code(404).send({ error: "Employee not found" });
      }

      // Delete old assignments, insert new ones (transactional)
      const upsert = rawSqlite.transaction(() => {
        rawSqlite.prepare("DELETE FROM therapist_services WHERE employee_id = ?").run(empId);

        if (body.serviceIds.length > 0) {
          const insert = rawSqlite.prepare(
            "INSERT INTO therapist_services (employee_id, service_id) VALUES (?, ?)"
          );
          for (const serviceId of body.serviceIds) {
            insert.run(empId, serviceId);
          }
        }

        return rawSqlite.prepare(`
          SELECT
            ts.id,
            ts.employee_id AS employeeId,
            ts.service_id AS serviceId,
            s.name AS serviceName,
            ts.created_at AS createdAt
          FROM therapist_services ts
          JOIN services s ON s.id = ts.service_id
          WHERE ts.employee_id = ?
          ORDER BY s.name
        `).all(empId);
      });

      return upsert();
    }
  );
};

export default therapistServicesRoutes;
