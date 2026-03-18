/**
 * GET /clients/:id/timeline — chronologická osa všech událostí klienta
 * Vrací: termíny, faktury, kredity, lékařské zprávy, věrnostní body, zprávy
 * Přístup: ADMIN / RECEPTION / EMPLOYEE (vlastní), CLIENT (vlastní)
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { timelineSchemas } from "../utils/swagger-schemas.js";

const timelineRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; before?: string };
  }>("/clients/:id/timeline", { schema: timelineSchemas.list }, async (request, reply) => {
    const role = request.auth!.role;
    const authId = request.auth!.id;
    const clientId = parseInt(request.params.id);
    const limit = Math.min(parseInt(request.query.limit ?? "50"), 100);
    const before = request.query.before; // ISO timestamp cursor

    // Access control
    if (role === "CLIENT" && authId !== clientId) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const beforeClause = before ? `AND created_at < '${before}'` : "";

    const events: any[] = [];

    // 1. Appointments
    try {
      const appts = rawSqlite.prepare(`
        SELECT a.id, a.start_time as created_at, a.status, a.price,
               s.name as service_name, u.name as employee_name
        FROM appointments a
        LEFT JOIN services s ON s.id = a.service_id
        LEFT JOIN users u ON u.id = a.employee_id
        WHERE a.client_id = ? ${before ? `AND a.start_time < '${before}'` : ""}
        ORDER BY a.start_time DESC
        LIMIT ?
      `).all(clientId, limit) as any[];

      for (const a of appts) {
        events.push({
          type: "appointment",
          id: a.id,
          createdAt: a.created_at,
          title: a.service_name ?? "Termín",
          subtitle: a.employee_name ? `Terapeut: ${a.employee_name}` : undefined,
          badge: a.status,
          badgeColor: {
            COMPLETED: "green",
            CONFIRMED: "blue",
            CANCELLED: "red",
            NO_SHOW: "gray",
            PENDING: "yellow",
          }[a.status as string] ?? "gray",
          data: { price: a.price, status: a.status },
        });
      }
    } catch { /* skip if table missing */ }

    // 2. Invoices
    try {
      const invs = rawSqlite.prepare(`
        SELECT id, created_at, invoice_number, status, total
        FROM invoices
        WHERE client_id = ? ${before ? `AND created_at < '${before}'` : ""}
        ORDER BY created_at DESC
        LIMIT ?
      `).all(clientId, limit) as any[];

      for (const inv of invs) {
        events.push({
          type: "invoice",
          id: inv.id,
          createdAt: inv.created_at,
          title: `Faktura ${inv.invoice_number}`,
          subtitle: `${inv.total} Kč`,
          badge: inv.status,
          badgeColor: {
            PAID: "green",
            SENT: "blue",
            OVERDUE: "red",
            DRAFT: "gray",
            CANCELLED: "gray",
          }[inv.status as string] ?? "gray",
          data: { total: inv.total, status: inv.status },
        });
      }
    } catch { /* skip */ }

    // 3. Credit transactions
    try {
      const txs = rawSqlite.prepare(`
        SELECT id, created_at, type, amount, balance, note
        FROM credit_transactions
        WHERE user_id = ? ${before ? `AND created_at < '${before}'` : ""}
        ORDER BY created_at DESC
        LIMIT ?
      `).all(clientId, limit) as any[];

      for (const tx of txs) {
        events.push({
          type: "credit",
          id: tx.id,
          createdAt: tx.created_at,
          title: `Kredit: ${tx.type}`,
          subtitle: `${tx.amount > 0 ? "+" : ""}${tx.amount} Kč (zůstatek: ${tx.balance} Kč)`,
          badge: tx.type,
          badgeColor: tx.amount > 0 ? "green" : "red",
          data: { amount: tx.amount, balance: tx.balance, note: tx.note },
        });
      }
    } catch { /* skip */ }

    // 4. Medical reports
    try {
      const reports = rawSqlite.prepare(`
        SELECT mr.id, mr.created_at, mr.title, u.name as author_name
        FROM medical_reports mr
        LEFT JOIN users u ON u.id = mr.employee_id
        WHERE mr.client_id = ? ${before ? `AND mr.created_at < '${before}'` : ""}
        ORDER BY mr.created_at DESC
        LIMIT ?
      `).all(clientId, limit) as any[];

      for (const r of reports) {
        events.push({
          type: "medical_report",
          id: r.id,
          createdAt: r.created_at,
          title: r.title,
          subtitle: r.author_name ? `Autor: ${r.author_name}` : undefined,
          badge: "Zpráva",
          badgeColor: "purple",
          data: {},
        });
      }
    } catch { /* skip */ }

    // 5. Loyalty points
    try {
      const pts = rawSqlite.prepare(`
        SELECT id, created_at, points, reason
        FROM loyalty_points
        WHERE user_id = ? ${before ? `AND created_at < '${before}'` : ""}
        ORDER BY created_at DESC
        LIMIT ?
      `).all(clientId, limit) as any[];

      for (const p of pts) {
        events.push({
          type: "loyalty",
          id: p.id,
          createdAt: p.created_at,
          title: `+${p.points} věrnostních bodů`,
          subtitle: p.reason,
          badge: "Body",
          badgeColor: "yellow",
          data: { points: p.points },
        });
      }
    } catch { /* skip */ }

    // 6. Messages (received/sent) — only for staff viewing client
    if (role !== "CLIENT") {
      try {
        const msgs = rawSqlite.prepare(`
          SELECT m.id, m.created_at, m.subject,
                 uf.name as from_name, ut.name as to_name
          FROM messages m
          LEFT JOIN users uf ON uf.id = m.from_user_id
          LEFT JOIN users ut ON ut.id = m.to_user_id
          WHERE (m.from_user_id = ? OR m.to_user_id = ?) ${before ? `AND m.created_at < '${before}'` : ""}
          ORDER BY m.created_at DESC
          LIMIT ?
        `).all(clientId, clientId, limit) as any[];

        for (const m of msgs) {
          events.push({
            type: "message",
            id: m.id,
            createdAt: m.created_at,
            title: m.subject,
            subtitle: `${m.from_name} → ${m.to_name}`,
            badge: "Zpráva",
            badgeColor: "blue",
            data: {},
          });
        }
      } catch { /* skip if messages table doesn't exist yet */ }
    }

    // Sort all events by date descending and limit
    events.sort((a, b) => {
      const da = a.createdAt ?? "";
      const db2 = b.createdAt ?? "";
      return db2.localeCompare(da);
    });

    const limited = events.slice(0, limit);

    return {
      clientId,
      events: limited,
      nextCursor: limited.length === limit ? limited[limited.length - 1]?.createdAt : null,
      total: limited.length,
    };
  });
};

export default timelineRoutes;
