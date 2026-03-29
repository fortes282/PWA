import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

// Helper: parse query filters
function parseFilters(q: Record<string, string | undefined>) {
  const dateFrom = q.dateFrom ?? null;
  const dateTo = q.dateTo ?? null;
  const therapistId = q.therapistId ? parseInt(q.therapistId) : null;
  const serviceId = q.serviceId ? parseInt(q.serviceId) : null;
  return { dateFrom, dateTo, therapistId, serviceId };
}

// Revenue forecasting: simple linear regression on monthly revenue
function computeForecast(monthlyRows: Array<{ month: string; revenue: unknown }>) {
  if (monthlyRows.length < 2) return [];

  const points = monthlyRows.map((r, i) => ({ x: i, y: Number(r.revenue) || 0 }));
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return [];

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const lastMonth = monthlyRows[monthlyRows.length - 1]!.month;
  const [lastYear, lastMo] = lastMonth.split("-").map(Number) as [number, number];

  const forecast = [];
  for (let i = 1; i <= 3; i++) {
    const projectedX = n - 1 + i;
    const projectedRevenue = Math.max(0, Math.round(intercept + slope * projectedX));
    let mo = lastMo + i;
    let yr = lastYear;
    while (mo > 12) { mo -= 12; yr++; }
    forecast.push({
      month: `${yr}-${String(mo).padStart(2, "0")}`,
      revenue: projectedRevenue,
      isForecast: true,
    });
  }

  return forecast;
}

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Guard: ADMIN only ──────────────────────────────────────────────────────
  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.auth || !["ADMIN"].includes(request.auth.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  });

  // ─── GET /analytics/revenue ─────────────────────────────────────────────────
  fastify.get("/analytics/revenue", async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const { dateFrom, dateTo, therapistId, serviceId } = parseFilters(q);

    const from = dateFrom ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = dateTo ?? new Date().toISOString().slice(0, 10) + "T23:59:59";

    const conditions: string[] = [
      `a.status = 'COMPLETED'`,
      `a.price IS NOT NULL`,
      `a.start_time >= '${from}'`,
      `a.start_time <= '${to}'`,
    ];
    if (therapistId) conditions.push(`a.employee_id = ${therapistId}`);
    if (serviceId) conditions.push(`a.service_id = ${serviceId}`);
    const where = conditions.join(" AND ");

    const byTherapistMonth = rawSqlite.prepare(`
      SELECT
        strftime('%Y-%m', a.start_time) AS month,
        e.id AS therapist_id,
        e.name AS therapist_name,
        COUNT(*) AS count,
        SUM(a.price) AS revenue
      FROM appointments a
      JOIN users e ON e.id = a.employee_id
      WHERE ${where}
      GROUP BY strftime('%Y-%m', a.start_time), e.id, e.name
      ORDER BY month, therapist_name
    `).all();

    const byServiceMonth = rawSqlite.prepare(`
      SELECT
        strftime('%Y-%m', a.start_time) AS month,
        s.id AS service_id,
        s.name AS service_name,
        COUNT(*) AS count,
        SUM(a.price) AS revenue
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE ${where}
      GROUP BY strftime('%Y-%m', a.start_time), s.id, s.name
      ORDER BY month, service_name
    `).all();

    const totals = rawSqlite.prepare(`
      SELECT
        strftime('%Y-%m', a.start_time) AS month,
        COUNT(*) AS count,
        SUM(a.price) AS revenue
      FROM appointments a
      WHERE ${where}
      GROUP BY strftime('%Y-%m', a.start_time)
      ORDER BY month
    `).all();

    return { byTherapistMonth, byServiceMonth, totals };
  });

  // ─── GET /analytics/occupancy ───────────────────────────────────────────────
  fastify.get("/analytics/occupancy", async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const { dateFrom, dateTo } = parseFilters(q);

    const from = dateFrom ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = dateTo ?? new Date().toISOString().slice(0, 10) + "T23:59:59";

    const rows = rawSqlite.prepare(`
      SELECT
        r.id AS room_id,
        r.name AS room_name,
        COUNT(a.id) AS appointment_count,
        COALESCE(SUM(
          (CAST(strftime('%s', a.end_time) AS REAL) - CAST(strftime('%s', a.start_time) AS REAL)) / 3600.0
        ), 0) AS booked_hours
      FROM rooms r
      LEFT JOIN appointments a ON a.room_id = r.id
        AND a.status NOT IN ('CANCELLED')
        AND a.start_time >= '${from}'
        AND a.start_time <= '${to}'
      GROUP BY r.id, r.name
      ORDER BY r.name
    `).all() as Array<{ room_id: number; room_name: string; appointment_count: number; booked_hours: number }>;

    const days = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)));
    const workdays = Math.ceil(days * 5 / 7);
    const availableHoursPerRoom = workdays * 10;

    const result = rows.map((r) => ({
      ...r,
      available_hours: availableHoursPerRoom,
      occupancy_rate: availableHoursPerRoom > 0
        ? Math.round(((r.booked_hours ?? 0) / availableHoursPerRoom) * 100)
        : 0,
    }));

    return { rooms: result, period: { from, to, workdays, availableHoursPerRoom } };
  });

  // ─── GET /analytics/retention ───────────────────────────────────────────────
  fastify.get("/analytics/retention", async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const { dateFrom, dateTo, therapistId } = parseFilters(q);

    const from = dateFrom ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = dateTo ?? new Date().toISOString().slice(0, 10) + "T23:59:59";

    const therapistFilter = therapistId ? `AND a.employee_id = ${therapistId}` : "";

    const rows = rawSqlite.prepare(`
      WITH first_appt AS (
        SELECT client_id, MIN(start_time) AS first_date
        FROM appointments
        WHERE status = 'COMPLETED'
        ${therapistFilter}
        GROUP BY client_id
      ),
      cohort AS (
        SELECT client_id, first_date
        FROM first_appt
        WHERE first_date >= '${from}' AND first_date <= '${to}'
      )
      SELECT
        c.client_id,
        c.first_date,
        MAX(a.start_time) AS last_date,
        COUNT(a.id) AS total_appointments,
        (julianday(MAX(a.start_time)) - julianday(MIN(a.start_time))) AS relationship_days
      FROM cohort c
      LEFT JOIN appointments a ON a.client_id = c.client_id AND a.status = 'COMPLETED'
      GROUP BY c.client_id, c.first_date
    `).all() as Array<{ client_id: number; first_date: string; last_date: string; total_appointments: number; relationship_days: number }>;

    const total = rows.length;
    const retained1m = rows.filter(r => (r.relationship_days ?? 0) >= 30).length;
    const retained3m = rows.filter(r => (r.relationship_days ?? 0) >= 90).length;
    const retained6m = rows.filter(r => (r.relationship_days ?? 0) >= 180).length;
    const avgDays = total > 0 ? rows.reduce((s, r) => s + (r.relationship_days ?? 0), 0) / total : 0;

    return {
      cohortSize: total,
      retained1month: { count: retained1m, rate: total > 0 ? Math.round((retained1m / total) * 100) : 0 },
      retained3months: { count: retained3m, rate: total > 0 ? Math.round((retained3m / total) * 100) : 0 },
      retained6months: { count: retained6m, rate: total > 0 ? Math.round((retained6m / total) * 100) : 0 },
      avgRelationshipDays: Math.round(avgDays),
      avgRelationshipWeeks: Math.round(avgDays / 7),
    };
  });

  // ─── GET /analytics/trends ──────────────────────────────────────────────────
  fastify.get("/analytics/trends", async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const { dateFrom, dateTo, therapistId, serviceId } = parseFilters(q);

    const from = dateFrom ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = dateTo ?? new Date().toISOString().slice(0, 10) + "T23:59:59";

    const conditions: string[] = [`a.start_time >= '${from}'`, `a.start_time <= '${to}'`];
    if (therapistId) conditions.push(`a.employee_id = ${therapistId}`);
    if (serviceId) conditions.push(`a.service_id = ${serviceId}`);
    const where = conditions.join(" AND ");

    const monthly = rawSqlite.prepare(`
      SELECT
        strftime('%Y-%m', a.start_time) AS month,
        SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancellations,
        SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' THEN a.price ELSE 0 END), 0) AS revenue
      FROM appointments a
      WHERE ${where}
      GROUP BY strftime('%Y-%m', a.start_time)
      ORDER BY month
    `).all() as Array<{ month: string; cancellations: number; completed: number; total: number; revenue: number }>;

    const newClients = rawSqlite.prepare(`
      SELECT
        strftime('%Y-%m', u.created_at) AS month,
        COUNT(*) AS new_clients
      FROM users u
      WHERE u.role = 'CLIENT'
        AND u.created_at >= '${from}'
        AND u.created_at <= '${to}'
      GROUP BY strftime('%Y-%m', u.created_at)
      ORDER BY month
    `).all();

    const forecast = computeForecast(monthly);

    return { monthly, newClients, forecast };
  });

  // ─── GET /analytics/cancellation-risk ──────────────────────────────────────
  // Returns upcoming appointments with their cancellation risk scores
  fastify.get("/analytics/cancellation-risk", async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const minScore = q.minScore ? parseInt(q.minScore) : 0;
    const limit = q.limit ? Math.min(parseInt(q.limit), 200) : 50;

    const rows = rawSqlite.prepare(`
      SELECT
        a.id, a.start_time, a.end_time, a.status,
        a.cancellation_risk_score AS risk_score,
        c.id AS client_id, c.name AS client_name, c.email AS client_email,
        e.id AS employee_id, e.name AS employee_name,
        s.name AS service_name
      FROM appointments a
      JOIN users c ON c.id = a.client_id
      JOIN users e ON e.id = a.employee_id
      JOIN services s ON s.id = a.service_id
      WHERE a.status IN ('PENDING', 'CONFIRMED')
        AND a.start_time > datetime('now')
        AND a.cancellation_risk_score >= ?
      ORDER BY a.cancellation_risk_score DESC, a.start_time ASC
      LIMIT ?
    `).all(minScore, limit);

    return { appointments: rows };
  });

  // ─── GET /analytics/inactive-clients ───────────────────────────────────────
  fastify.get("/analytics/inactive-clients", async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const days = q.days ? parseInt(q.days) : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const rows = rawSqlite.prepare(`
      SELECT
        u.id, u.name, u.email, u.phone,
        u.last_reengagement_at,
        MAX(a.start_time) AS last_appointment,
        COUNT(a.id) AS total_appointments
      FROM users u
      LEFT JOIN appointments a ON a.client_id = u.id AND a.status = 'COMPLETED'
      WHERE u.role = 'CLIENT'
        AND u.is_active = 1
        AND u.gdpr_anonymized_at IS NULL
      GROUP BY u.id
      HAVING (last_appointment IS NULL OR last_appointment < ?)
      ORDER BY last_appointment ASC NULLS FIRST
    `).all(cutoff);

    // Buckets: 30+, 60+, 90+
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const stats = {
      inactive30: (rawSqlite.prepare(`
        SELECT COUNT(DISTINCT u.id) AS n FROM users u
        LEFT JOIN appointments a ON a.client_id = u.id AND a.status = 'COMPLETED'
        WHERE u.role = 'CLIENT' AND u.is_active = 1
        GROUP BY u.id HAVING MAX(a.start_time) < ? OR MAX(a.start_time) IS NULL
      `).all(cutoff30) as Array<{ n: number }>).length,
      inactive60: (rawSqlite.prepare(`
        SELECT COUNT(DISTINCT u.id) AS n FROM users u
        LEFT JOIN appointments a ON a.client_id = u.id AND a.status = 'COMPLETED'
        WHERE u.role = 'CLIENT' AND u.is_active = 1
        GROUP BY u.id HAVING MAX(a.start_time) < ? OR MAX(a.start_time) IS NULL
      `).all(cutoff60) as Array<{ n: number }>).length,
      inactive90: (rawSqlite.prepare(`
        SELECT COUNT(DISTINCT u.id) AS n FROM users u
        LEFT JOIN appointments a ON a.client_id = u.id AND a.status = 'COMPLETED'
        WHERE u.role = 'CLIENT' AND u.is_active = 1
        GROUP BY u.id HAVING MAX(a.start_time) < ? OR MAX(a.start_time) IS NULL
      `).all(cutoff90) as Array<{ n: number }>).length,
    };

    return { clients: rows, stats };
  });
};

export default analyticsRoutes;
