/**
 * GET /employees/me/clients — terapeut vidí unikátní klienty z vlastních termínů
 * GET /employees/me/stats — souhrn statistik pro přihlášeného terapeuta
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { employeeClientSchemas } from "../utils/swagger-schemas.js";

const employeeClientsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /employees/me/clients — klienti přihlášeného terapeuta
  fastify.get<{ Querystring: { search?: string; limit?: string } }>(
    "/employees/me/clients",
    { schema: employeeClientSchemas.clients },
    async (request, reply) => {
      const role = request.auth!.role;
      const empId = request.auth!.id;

      if (!["EMPLOYEE", "ADMIN"].includes(role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const limit = Math.min(parseInt(request.query.limit ?? "50"), 200);
      const search = request.query.search?.trim().toLowerCase();

      const rows = rawSqlite.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.phone, u.behavior_score,
               COUNT(a.id) as session_count,
               MAX(a.start_time) as last_session,
               SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
               SUM(CASE WHEN a.status = 'UNJUSTIFIED_CANCEL' THEN 1 ELSE 0 END) as unjustified_cancel_count
        FROM users u
        JOIN appointments a ON a.client_id = u.id
        WHERE a.employee_id = ? AND u.role = 'CLIENT' AND u.is_active = 1
        GROUP BY u.id
        ORDER BY last_session DESC
        LIMIT ?
      `).all(empId, limit) as any[];

      let results = rows;
      if (search) {
        results = rows.filter((r: any) =>
          r.name?.toLowerCase().includes(search) ||
          r.email?.toLowerCase().includes(search)
        );
      }

      return results.map((r: any) => ({
        ...r,
        daysSinceLastSession: r.last_session
          ? Math.floor((Date.now() - new Date(r.last_session).getTime()) / 86400000)
          : null,
      }));
    },
  );

  // GET /employees/me/stats — souhrnné statistiky terapeuta
  fastify.get("/employees/me/stats", { schema: employeeClientSchemas.stats }, async (request, reply) => {
    const role = request.auth!.role;
    const empId = request.auth!.id;

    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const totalAppts = rawSqlite.prepare(`
      SELECT COUNT(*) as n FROM appointments WHERE employee_id = ?
    `).get(empId) as any;

    const completedAppts = rawSqlite.prepare(`
      SELECT COUNT(*) as n FROM appointments WHERE employee_id = ? AND status = 'COMPLETED'
    `).get(empId) as any;

    const unjustifiedCancelAppts = rawSqlite.prepare(`
      SELECT COUNT(*) as n FROM appointments WHERE employee_id = ? AND status = 'UNJUSTIFIED_CANCEL'
    `).get(empId) as any;

    const revenue = rawSqlite.prepare(`
      SELECT COALESCE(SUM(price), 0) as total FROM appointments
      WHERE employee_id = ? AND status = 'COMPLETED'
    `).get(empId) as any;

    const uniqueClients = rawSqlite.prepare(`
      SELECT COUNT(DISTINCT client_id) as n FROM appointments WHERE employee_id = ?
    `).get(empId) as any;

    const thisMonthRevenue = rawSqlite.prepare(`
      SELECT COALESCE(SUM(price), 0) as total FROM appointments
      WHERE employee_id = ? AND status = 'COMPLETED'
        AND start_time >= datetime('now', 'start of month')
    `).get(empId) as any;

    let avgRating = null;
    try {
      const ratingData = rawSqlite.prepare(`
        SELECT ROUND(AVG(ar.rating), 1) as avg, COUNT(ar.id) as n
        FROM appointment_ratings ar
        JOIN appointments a ON a.id = ar.appointment_id
        WHERE a.employee_id = ?
      `).get(empId) as any;
      avgRating = ratingData?.avg ?? null;
    } catch { /* ratings table might not exist */ }

    return {
      totalAppointments: totalAppts.n,
      completedAppointments: completedAppts.n,
      unjustifiedCancelAppointments: unjustifiedCancelAppts.n,
      completionRate: totalAppts.n > 0 ? Math.round((completedAppts.n / totalAppts.n) * 100) : 0,
      totalRevenue: revenue.total,
      monthRevenue: thisMonthRevenue.total,
      uniqueClients: uniqueClients.n,
      avgRating,
    };
  });
};

export default employeeClientsRoutes;
