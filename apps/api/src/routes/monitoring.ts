import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

/**
 * System monitoring endpoints — surfaces unpaid appointments, overdue invoices,
 * and pending credit requests for admin/reception dashboards.
 */
const monitoringRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Guard: ADMIN/RECEPTION only ──────────────────────────────────────────
  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.auth || !["ADMIN", "RECEPTION"].includes(request.auth.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  });

  // GET /monitoring/unpaid — COMPLETED appointments with no paidAt and not linked to any invoice
  fastify.get("/monitoring/unpaid", async (request) => {
    const q = request.query as { page?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "50"), 1), 200);
    const page = Math.max(parseInt(q.page ?? "1"), 1);
    const offset = (page - 1) * limit;

    const total = (rawSqlite.prepare(`
      SELECT COUNT(*) as n
      FROM appointments a
      WHERE a.status = 'COMPLETED'
        AND a.paid_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM invoice_items ii WHERE ii.appointment_id = a.id
        )
    `).get() as any).n;

    const rows = rawSqlite.prepare(`
      SELECT
        a.id,
        a.client_id AS clientId,
        u.name AS clientName,
        a.employee_id AS employeeId,
        e.name AS employeeName,
        a.service_id AS serviceId,
        s.name AS serviceName,
        a.start_time AS startTime,
        a.end_time AS endTime,
        a.price,
        a.created_at AS createdAt
      FROM appointments a
      JOIN users u ON u.id = a.client_id
      JOIN users e ON e.id = a.employee_id
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.status = 'COMPLETED'
        AND a.paid_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM invoice_items ii WHERE ii.appointment_id = a.id
        )
      ORDER BY a.start_time DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return {
      items: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit), hasMore: offset + limit < total },
    };
  });

  // GET /monitoring/unresolved — overdue invoices + pending credit requests
  fastify.get("/monitoring/unresolved", async (request) => {
    const today = new Date().toISOString().slice(0, 10);

    const overdueInvoices = rawSqlite.prepare(`
      SELECT
        i.id,
        i.invoice_number AS invoiceNumber,
        i.client_id AS clientId,
        u.name AS clientName,
        i.total,
        i.due_date AS dueDate,
        i.status,
        i.created_at AS createdAt
      FROM invoices i
      JOIN users u ON u.id = i.client_id
      WHERE i.status = 'SENT'
        AND i.due_date < ?
      ORDER BY i.due_date ASC
    `).all(today);

    const pendingCreditRequests = rawSqlite.prepare(`
      SELECT
        cr.id,
        cr.client_id AS clientId,
        u.name AS clientName,
        cr.amount,
        cr.note,
        cr.status,
        cr.created_at AS createdAt
      FROM credit_requests cr
      JOIN users u ON u.id = cr.client_id
      WHERE cr.status = 'PENDING'
      ORDER BY cr.created_at ASC
    `).all();

    return {
      overdueInvoices,
      pendingCreditRequests,
    };
  });

  // GET /monitoring/summary — ADMIN only: counts of unpaid, overdue invoices, pending credit requests
  fastify.get("/monitoring/summary", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin only" });
    }

    const today = new Date().toISOString().slice(0, 10);

    const unpaidCount = (rawSqlite.prepare(`
      SELECT COUNT(*) as n
      FROM appointments a
      WHERE a.status = 'COMPLETED'
        AND a.paid_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM invoice_items ii WHERE ii.appointment_id = a.id
        )
    `).get() as any).n;

    const overdueInvoicesCount = (rawSqlite.prepare(`
      SELECT COUNT(*) as n
      FROM invoices
      WHERE status = 'SENT' AND due_date < ?
    `).get(today) as any).n;

    const pendingCreditRequestsCount = (rawSqlite.prepare(`
      SELECT COUNT(*) as n
      FROM credit_requests
      WHERE status = 'PENDING'
    `).get() as any).n;

    return {
      unpaidAppointments: unpaidCount,
      overdueInvoices: overdueInvoicesCount,
      pendingCreditRequests: pendingCreditRequestsCount,
    };
  });
};

export default monitoringRoutes;
