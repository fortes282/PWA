/**
 * Auto-processor: background jobs that can be triggered manually or on schedule
 * POST /auto-processor/reminders  — trigger reminder run (admin manual trigger)
 * GET  /auto-processor/status     — last run stats (stored in system_settings)
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { autoProcessorSchemas } from "../utils/swagger-schemas.js";

const autoProcessorRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auto-processor/invoice-overdue — mark overdue invoices
  fastify.post("/auto-processor/invoice-overdue", { schema: autoProcessorSchemas.invoiceOverdue }, async (request, reply) => {
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

  // POST /auto-processor/complete-therapies — mark CONFIRMED appointments past endTime as COMPLETED
  fastify.post("/auto-processor/complete-therapies", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin only" });
    }

    const now = new Date().toISOString();

    // Find all CONFIRMED appointments where endTime < now
    const result = rawSqlite.prepare(`
      UPDATE appointments SET status = 'COMPLETED', updated_at = ?
      WHERE status = 'CONFIRMED' AND end_time < ?
    `).run(now, now);

    const statsJson = JSON.stringify({ processed: result.changes, ranAt: now });
    try {
      rawSqlite.prepare(`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('complete_therapies_last_run', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(statsJson, now);
    } catch { /* ignore */ }

    return { ok: true, completed: result.changes, ranAt: now };
  });

  // GET /auto-processor/status — last run info
  fastify.get("/auto-processor/status", { schema: autoProcessorSchemas.status }, async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin only" });
    }

    try {
      const completeTherapiesRun = rawSqlite.prepare(
        "SELECT value FROM system_settings WHERE key = 'complete_therapies_last_run'"
      ).get() as any;

      const reminderRun = rawSqlite.prepare(
        "SELECT value FROM system_settings WHERE key = 'payment_reminder_last_run'"
      ).get() as any;

      return {
        completeTherapiesProcessor: completeTherapiesRun ? JSON.parse(completeTherapiesRun.value) : null,
        paymentReminderProcessor: reminderRun ? JSON.parse(reminderRun.value) : null,
        serverTime: new Date().toISOString(),
      };
    } catch {
      return { completeTherapiesProcessor: null, paymentReminderProcessor: null, serverTime: new Date().toISOString() };
    }
  });
  // GET /auto-processor/schedule — info o scheduled jobech (ADMIN only)
  fastify.get("/auto-processor/schedule", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.status(403).send({ error: "Admin only" });
    }
    const { getScheduledJobs } = await import("../scheduler.js");
    return { jobs: getScheduledJobs() };
  });
};

export default autoProcessorRoutes;
