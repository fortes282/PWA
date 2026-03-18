/**
 * Auto-processor: background jobs that can be triggered manually or on schedule
 * POST /auto-processor/no-shows   — marks overdue CONFIRMED appointments as NO_SHOW, applies behavior penalty
 * POST /auto-processor/reminders  — trigger reminder run (admin manual trigger)
 * GET  /auto-processor/status     — last run stats (stored in system_settings)
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

const autoProcessorRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auto-processor/no-shows — ADMIN only
  fastify.post("/auto-processor/no-shows", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin only" });
    }

    const now = new Date().toISOString();
    // Threshold: appointments that ended > 1 hour ago and are still CONFIRMED
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Find overdue CONFIRMED appointments
    const overdueAppts = rawSqlite.prepare(`
      SELECT a.id, a.client_id, a.employee_id, a.end_time, s.name as service_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.status = 'CONFIRMED' AND a.end_time < ?
      ORDER BY a.end_time ASC
    `).all(threshold) as any[];

    let processed = 0;
    let errors = 0;

    for (const appt of overdueAppts) {
      try {
        // Mark as NO_SHOW
        rawSqlite.prepare(`
          UPDATE appointments SET status = 'NO_SHOW', updated_at = ? WHERE id = ?
        `).run(now, appt.id);

        // Behavior penalty (-20 points)
        rawSqlite.prepare(`
          INSERT INTO behavior_events (user_id, type, points, note, created_at)
          VALUES (?, 'NO_SHOW', -20, ?, ?)
        `).run(appt.client_id, `Auto no-show: ${appt.service_name ?? "Termín"} #${appt.id}`, now);

        // Update behavior score (recalculate: base 100 + sum of all events, clamped 0-100)
        const eventSum = rawSqlite.prepare(`
          SELECT COALESCE(SUM(points), 0) as total FROM behavior_events WHERE user_id = ?
        `).get(appt.client_id) as any;
        const newScore = Math.max(0, Math.min(100, 100 + (eventSum?.total ?? 0)));
        rawSqlite.prepare(`
          UPDATE users SET behavior_score = ?, updated_at = ? WHERE id = ?
        `).run(newScore, now, appt.client_id);

        // In-app notification
        rawSqlite.prepare(`
          INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
          VALUES (?, 'GENERAL', 'Nedostavení se na termín', ?, 0, ?)
        `).run(
          appt.client_id,
          `Váš termín (${appt.service_name ?? "Termín"}) byl označen jako nedostavení. Vaše skóre bylo sníženo o 20 bodů.`,
          now,
        );

        processed++;
      } catch {
        errors++;
      }
    }

    // Store last run stats
    const statsJson = JSON.stringify({ processed, errors, ranAt: now, found: overdueAppts.length });
    try {
      rawSqlite.prepare(`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('no_show_processor_last_run', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(statsJson, now);
    } catch { /* ignore */ }

    return { ok: true, found: overdueAppts.length, processed, errors, ranAt: now };
  });

  // POST /auto-processor/invoice-overdue — mark overdue invoices
  fastify.post("/auto-processor/invoice-overdue", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin only" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const result = rawSqlite.prepare(`
      UPDATE invoices SET status = 'OVERDUE', updated_at = ?
      WHERE status = 'SENT' AND due_date < ?
    `).run(now, today);

    return { ok: true, updated: result.changes, ranAt: now };
  });

  // GET /auto-processor/status — last run info
  fastify.get("/auto-processor/status", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin only" });
    }

    try {
      const noShowRun = rawSqlite.prepare(
        "SELECT value FROM system_settings WHERE key = 'no_show_processor_last_run'"
      ).get() as any;

      return {
        noShowProcessor: noShowRun ? JSON.parse(noShowRun.value) : null,
        serverTime: new Date().toISOString(),
      };
    } catch {
      return { noShowProcessor: null, serverTime: new Date().toISOString() };
    }
  });
};

export default autoProcessorRoutes;
