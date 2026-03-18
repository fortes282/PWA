import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { exportSchemas } from "../utils/swagger-schemas.js";

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(f => {
    if (f == null) return "";
    const s = String(f);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(",");
}

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /export/clients.csv
  fastify.get("/export/clients.csv", { schema: exportSchemas.clients }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    let clients: Array<{id: number; name: string; email: string; phone: string | null; created_at: string; behavior_score: number; loyalty_points: number}>;
    try {
      clients = rawSqlite.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.created_at, u.behavior_score,
               COALESCE(lp.total_points, 0) as loyalty_points
        FROM users u
        LEFT JOIN (SELECT user_id, SUM(points) as total_points FROM loyalty_points GROUP BY user_id) lp ON lp.user_id = u.id
        WHERE u.role = 'CLIENT' AND u.is_active = 1
        ORDER BY u.name
      `).all() as Array<{id: number; name: string; email: string; phone: string | null; created_at: string; behavior_score: number; loyalty_points: number}>;
    } catch {
      // loyalty_points table may not exist
      clients = rawSqlite.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.created_at, u.behavior_score, 0 as loyalty_points
        FROM users u
        WHERE u.role = 'CLIENT' AND u.is_active = 1
        ORDER BY u.name
      `).all() as Array<{id: number; name: string; email: string; phone: string | null; created_at: string; behavior_score: number; loyalty_points: number}>;
    }

    const header = "id,name,email,phone,created_at,behavior_score,loyalty_points";
    const rows = clients.map(c => csvRow([c.id, c.name, c.email, c.phone, c.created_at, c.behavior_score, c.loyalty_points]));
    const csv = [header, ...rows].join("\r\n");

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="clients.csv"')
      .send("\uFEFF" + csv);
  });

  // GET /export/appointments.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
  fastify.get("/export/appointments.csv", { schema: exportSchemas.appointments }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };
    const from = q.from ?? "2000-01-01";
    const to = q.to ?? "2100-12-31";

    const rows = rawSqlite.prepare(`
      SELECT a.id, a.start_time, a.end_time, a.status, a.price,
             uc.name as client_name, ue.name as employee_name, s.name as service_name
      FROM appointments a
      JOIN users uc ON uc.id = a.client_id
      JOIN users ue ON ue.id = a.employee_id
      JOIN services s ON s.id = a.service_id
      WHERE a.start_time >= ? AND a.start_time <= ?
      ORDER BY a.start_time
    `).all(from, to + "T23:59:59") as Array<{id: number; start_time: string; end_time: string; status: string; price: number | null; client_name: string; employee_name: string; service_name: string}>;

    const header = "id,date,client,employee,service,status,price";
    const csvRows = rows.map(r => csvRow([r.id, r.start_time, r.client_name, r.employee_name, r.service_name, r.status, r.price]));
    const csv = [header, ...csvRows].join("\r\n");

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="appointments.csv"')
      .send("\uFEFF" + csv);
  });

  // GET /export/invoices.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
  fastify.get("/export/invoices.csv", { schema: exportSchemas.invoices }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };
    const from = q.from ?? "2000-01-01";
    const to = q.to ?? "2100-12-31";

    const rows = rawSqlite.prepare(`
      SELECT i.id, i.invoice_number, u.name as client_name, i.total, i.status, i.due_date, i.paid_at, i.created_at
      FROM invoices i
      JOIN users u ON u.id = i.client_id
      WHERE i.created_at >= ? AND i.created_at <= ?
      ORDER BY i.created_at
    `).all(from, to + "T23:59:59") as Array<{id: number; invoice_number: string; client_name: string; total: number; status: string; due_date: string; paid_at: string | null; created_at: string}>;

    const header = "id,invoice_number,client,total,status,due_date,paid_at,created_at";
    const csvRows = rows.map(r => csvRow([r.id, r.invoice_number, r.client_name, r.total, r.status, r.due_date, r.paid_at, r.created_at]));
    const csv = [header, ...csvRows].join("\r\n");

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="invoices.csv"')
      .send("\uFEFF" + csv);
  });
};

export default exportRoutes;
