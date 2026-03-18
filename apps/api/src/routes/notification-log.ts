/**
 * Notification log — read-only admin view of outbound reminders.
 * GET /notification-log?limit=50&offset=0&channel=email&status=sent
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

const notificationLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/notification-log", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const query = request.query as Record<string, string>;
    const limit = Math.min(parseInt(query.limit ?? "50"), 200);
    const offset = parseInt(query.offset ?? "0");
    const channel = query.channel; // optional filter
    const status = query.status;   // optional filter

    let sql = `
      SELECT nl.id, nl.appointment_id, nl.user_id, u.name AS user_name, u.email AS user_email,
             nl.channel, nl.window, nl.status, nl.detail, nl.sent_at
      FROM notification_log nl
      LEFT JOIN users u ON u.id = nl.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (channel) { sql += ` AND nl.channel = ?`; params.push(channel); }
    if (status)  { sql += ` AND nl.status = ?`;  params.push(status); }

    sql += ` ORDER BY nl.sent_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = rawSqlite.prepare(sql).all(...params) as any[];

    // Total count for pagination
    let countSql = `SELECT COUNT(*) as n FROM notification_log WHERE 1=1`;
    const countParams: any[] = [];
    if (channel) { countSql += ` AND channel = ?`; countParams.push(channel); }
    if (status)  { countSql += ` AND status = ?`;  countParams.push(status); }
    const { n: total } = rawSqlite.prepare(countSql).get(...countParams) as any;

    return { total, rows };
  });
};

export default notificationLogRoutes;
