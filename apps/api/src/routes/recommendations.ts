/**
 * Smart Recommendation Engine
 * GET /recommendations/rebooking — clients who need rebooking (no upcoming appointment)
 * GET /recommendations/loyalty-rewards — clients close to loyalty milestone
 * GET /recommendations/at-risk — clients with declining behavior or long absence
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { recommendationSchemas } from "../utils/swagger-schemas.js";

const recommendationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /recommendations/rebooking — clients with no upcoming CONFIRMED/PENDING appointment
  fastify.get<{ Querystring: { days?: string; limit?: string } }>(
    "/recommendations/rebooking",
    { schema: recommendationSchemas.rebooking },
    async (request, reply) => {
      const role = request.auth!.role;
      if (!["RECEPTION", "ADMIN"].includes(role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const lookbackDays = parseInt(request.query.days ?? "30");
      const limit = Math.min(parseInt(request.query.limit ?? "20"), 100);
      const now = new Date().toISOString();
      const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

      // Clients who had an appointment in the last N days but have no upcoming ones
      const rows = rawSqlite.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.behavior_score,
               MAX(a.start_time) as last_visit,
               COUNT(a.id) as total_visits
        FROM users u
        JOIN appointments a ON a.client_id = u.id
        WHERE u.role = 'CLIENT' AND u.is_active = 1
          AND a.status IN ('COMPLETED', 'NO_SHOW')
          AND a.start_time >= ?
          AND u.id NOT IN (
            SELECT DISTINCT client_id FROM appointments
            WHERE status IN ('CONFIRMED', 'PENDING') AND start_time > ?
          )
        GROUP BY u.id
        ORDER BY last_visit ASC
        LIMIT ?
      `).all(lookbackDate, now, limit) as any[];

      return rows.map((r: any) => ({
        ...r,
        daysSinceLastVisit: Math.floor((Date.now() - new Date(r.last_visit).getTime()) / 86400000),
        recommendation: "Doporučit nový termín",
      }));
    },
  );

  // GET /recommendations/loyalty-rewards — clients close to loyalty milestone
  fastify.get<{ Querystring: { threshold?: string; limit?: string } }>(
    "/recommendations/loyalty-rewards",
    { schema: recommendationSchemas.loyaltyRewards },
    async (request, reply) => {
      const role = request.auth!.role;
      if (!["RECEPTION", "ADMIN"].includes(role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const threshold = parseInt(request.query.threshold ?? "50");
      const limit = Math.min(parseInt(request.query.limit ?? "20"), 100);

      try {
        // Clients close to next milestone (50, 100, 200 points)
        const rows = rawSqlite.prepare(`
          SELECT u.id, u.name, u.email,
                 COALESCE(SUM(lp.points), 0) as total_points
          FROM users u
          LEFT JOIN loyalty_points lp ON lp.user_id = u.id
          WHERE u.role = 'CLIENT' AND u.is_active = 1
          GROUP BY u.id
          HAVING total_points > 0
          ORDER BY total_points DESC
          LIMIT ?
        `).all(limit) as any[];

        return rows.map((r: any) => {
          const pts = r.total_points;
          const milestones = [50, 100, 200, 500];
          const nextMilestone = milestones.find((m) => m > pts) ?? null;
          return {
            ...r,
            nextMilestone,
            pointsToNextMilestone: nextMilestone ? nextMilestone - pts : null,
            closingIn: nextMilestone && (nextMilestone - pts) <= threshold,
          };
        }).filter((r: any) => r.closingIn);
      } catch {
        return []; // loyalty_points table might not exist
      }
    },
  );

  // GET /recommendations/at-risk — clients with low behavior score or long absence
  fastify.get<{ Querystring: { limit?: string } }>(
    "/recommendations/at-risk",
    { schema: recommendationSchemas.atRisk },
    async (request, reply) => {
      const role = request.auth!.role;
      if (!["RECEPTION", "ADMIN"].includes(role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const limit = Math.min(parseInt(request.query.limit ?? "20"), 100);
      const longAbsenceDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days

      const rows = rawSqlite.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.behavior_score,
               MAX(a.start_time) as last_visit,
               COUNT(CASE WHEN a.status = 'NO_SHOW' THEN 1 END) as no_show_count,
               COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END) as completed_count
        FROM users u
        LEFT JOIN appointments a ON a.client_id = u.id
        WHERE u.role = 'CLIENT' AND u.is_active = 1
        GROUP BY u.id
        HAVING (u.behavior_score < 60 OR (last_visit IS NOT NULL AND last_visit < ?) OR (last_visit IS NULL))
        ORDER BY u.behavior_score ASC
        LIMIT ?
      `).all(longAbsenceDate, limit) as any[];

      return rows.map((r: any) => {
        const risks = [];
        if (r.behavior_score < 60) risks.push(`Nízké skóre (${r.behavior_score})`);
        if (r.last_visit && new Date(r.last_visit) < new Date(longAbsenceDate)) risks.push("60+ dní bez návštěvy");
        if (r.no_show_count >= 2) risks.push(`${r.no_show_count}× nedostavení`);
        return {
          ...r,
          risks,
          daysSinceLastVisit: r.last_visit
            ? Math.floor((Date.now() - new Date(r.last_visit).getTime()) / 86400000)
            : null,
        };
      });
    },
  );
};

export default recommendationsRoutes;
