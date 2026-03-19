import schedule from "node-schedule";
import { rawSqlite } from "./db/index.js";
import type { FastifyInstance } from "fastify";
import { runAllReminders } from "./services/reminder-service.js";
import { refreshUpcomingRiskScores } from "./services/cancellation-risk.js";
import { runWaitlistAutoOffer } from "./services/waitlist-auto-offer.js";
import { runReengagement } from "./services/reengagement.js";

function runNoShowProcessor(log: any) {
  const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const overdueAppts = rawSqlite.prepare(
    `SELECT a.id, a.client_id FROM appointments a WHERE a.status = "CONFIRMED" AND a.end_time < ? ORDER BY a.end_time ASC`
  ).all(threshold) as any[];

  let processed = 0;
  for (const appt of overdueAppts) {
    rawSqlite.prepare(`UPDATE appointments SET status = "NO_SHOW", updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), appt.id);
    // Behavior penalty
    const client = rawSqlite.prepare(`SELECT id, behavior_score FROM users WHERE id = ?`).get(appt.client_id) as any;
    if (client) {
      const newScore = Math.max(0, (client.behavior_score ?? 100) - 20);
      rawSqlite.prepare(`UPDATE users SET behavior_score = ? WHERE id = ?`).run(newScore, appt.client_id);
    }
    processed++;
  }

  // Update last run in system_settings
  rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
    .run("auto_processor_no_show_last_run", JSON.stringify({ at: new Date().toISOString(), processed }));

  log.info({ processed }, "Auto-processor: no-show run complete");
  return processed;
}

function runInvoiceOverdueProcessor(log: any) {
  const now = new Date().toISOString();
  const result = rawSqlite.prepare(
    `UPDATE invoices SET status = "OVERDUE" WHERE status = "SENT" AND due_date < ?`
  ).run(now);

  rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
    .run("auto_processor_invoice_last_run", JSON.stringify({ at: now, processed: result.changes }));

  log.info({ processed: result.changes }, "Auto-processor: invoice overdue run complete");
  return result.changes;
}

export function startScheduler(fastify: FastifyInstance) {
  // No-show processor — every day at 02:00
  schedule.scheduleJob("no-show-processor", "0 2 * * *", () => {
    runNoShowProcessor(fastify.log);
  });

  // Invoice overdue processor — every day at 03:00
  schedule.scheduleJob("invoice-overdue-processor", "0 3 * * *", () => {
    runInvoiceOverdueProcessor(fastify.log);
  });

  // Reminder scheduler — every 5 minutes (24h + 2h windows)
  const logShim = {
    info: (m: string) => fastify.log.info(m),
    error: (m: string, e?: unknown) => fastify.log.error({ err: e }, m),
  };
  schedule.scheduleJob("reminder-scheduler", "*/5 * * * *", () => {
    runAllReminders(logShim).catch((e) =>
      fastify.log.error({ err: e }, "Reminder scheduler error")
    );
  });

  // ── SHOULD #10: Cancellation risk refresh + waitlist auto-offer — every 6h ──
  const logShim10 = {
    info: (m: string, d?: unknown) => fastify.log.info({ data: d }, m),
    error: (m: string, e?: unknown) => fastify.log.error({ err: e }, m),
  };

  schedule.scheduleJob("cancellation-risk-refresh", "0 */6 * * *", async () => {
    try {
      const updated = refreshUpcomingRiskScores();
      fastify.log.info({ updated }, "Cancellation risk scores refreshed");

      const results = await runWaitlistAutoOffer(logShim10);
      const notified = results.filter((r) => r.notifiedClientId !== null).length;
      fastify.log.info({ checked: results.length, notified }, "Waitlist auto-offer run complete");

      rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
        .run("cancellation_risk_last_run", JSON.stringify({ at: new Date().toISOString(), updated, notified }));
    } catch (e) {
      fastify.log.error({ err: e }, "Cancellation risk / waitlist auto-offer error");
    }
  });

  // ── SHOULD #10: Re-engagement — daily at 10:00 ────────────────────────────
  schedule.scheduleJob("reengagement", "0 10 * * *", async () => {
    try {
      const result = await runReengagement(logShim10);
      rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
        .run("reengagement_last_run", JSON.stringify({ at: new Date().toISOString(), ...result }));
    } catch (e) {
      fastify.log.error({ err: e }, "Re-engagement job error");
    }
  });

  // ── COULD #12: Wellbeing self-check reminder — every Monday at 08:00 ─────────
  schedule.scheduleJob("wellbeing-reminder", "0 8 * * 1", async () => {
    try {
      const employees = rawSqlite
        .prepare(`SELECT id, name FROM users WHERE role IN ('EMPLOYEE') AND is_active = 1`)
        .all() as { id: number; name: string }[];

      let sent = 0;
      for (const emp of employees) {
        // Insert in-app notification
        rawSqlite
          .prepare(
            `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
             VALUES (?, 'GENERAL', 'Týdenní self-check', 'Vyplňte týdenní self-check – pomáhá nám pečovat o váš wellbeing.', 0, datetime('now'))`
          )
          .run(emp.id);
        sent++;
      }

      rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
        .run("wellbeing_reminder_last_run", JSON.stringify({ at: new Date().toISOString(), sent }));

      fastify.log.info({ sent }, "Wellbeing reminder: sent to employees");
    } catch (e) {
      fastify.log.error({ err: e }, "Wellbeing reminder job error");
    }
  });

  fastify.log.info("Scheduler started: no-show (02:00), invoice-overdue (03:00), reminders (every 5min), cancellation-risk (every 6h), reengagement (10:00), wellbeing-reminder (Mon 08:00)");
}

export function getScheduledJobs() {
  const jobs = schedule.scheduledJobs;
  return Object.entries(jobs).map(([name, job]) => ({
    name,
    nextInvocation: job.nextInvocation()?.toISOString() ?? null,
  }));
}
