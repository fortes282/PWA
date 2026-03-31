import schedule from "node-schedule";
import { rawSqlite } from "./db/index.js";
import type { FastifyInstance } from "fastify";
import { runAllReminders } from "./services/reminder-service.js";
import { refreshUpcomingRiskScores } from "./services/cancellation-risk.js";
import { runWaitlistAutoOffer } from "./services/waitlist-auto-offer.js";
import { runReengagement } from "./services/reengagement.js";
import { runSlotRecoveryEngine } from "./services/slot-recovery.js";

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

function runCompleteTherapies(log: any) {
  const now = new Date().toISOString();
  const result = rawSqlite.prepare(
    `UPDATE appointments SET status = 'COMPLETED', updated_at = ? WHERE status = 'CONFIRMED' AND end_time < ?`
  ).run(now, now);

  rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
    .run("complete_therapies_last_run", JSON.stringify({ at: now, completed: result.changes }));

  log.info({ completed: result.changes }, "Auto-processor: complete-therapies run complete");
  return result.changes;
}

function runPaymentReminderProcessor(log: any) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Find overdue invoices: dueDate < today, status not PAID/CANCELLED, reminderCount < 3
  const overdueInvoices = rawSqlite.prepare(`
    SELECT id, invoice_number, client_id, total, reminder_count
    FROM invoices
    WHERE due_date < ? AND status NOT IN ('PAID', 'CANCELLED') AND reminder_count < 3
    ORDER BY due_date ASC
  `).all(today) as { id: number; invoice_number: string; client_id: number; total: number; reminder_count: number }[];

  let sent = 0;
  for (const inv of overdueInvoices) {
    try {
      // Create payment_reminders record
      rawSqlite.prepare(`
        INSERT INTO payment_reminders (invoice_id, sent_at, channel, status, created_at)
        VALUES (?, ?, 'inapp', 'sent', ?)
      `).run(inv.id, now, now);

      // Increment reminderCount
      rawSqlite.prepare(`
        UPDATE invoices SET reminder_count = reminder_count + 1, reminder_sent_at = ?, updated_at = ? WHERE id = ?
      `).run(now, now, inv.id);

      // In-app notification to client
      rawSqlite.prepare(`
        INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
        VALUES (?, 'INVOICE', 'Upomínka k faktuře', ?, 0, ?)
      `).run(inv.client_id, `Faktura ${inv.invoice_number} je po splatnosti. Prosíme o úhradu.`, now);

      sent++;
    } catch {
      // skip individual errors
    }
  }

  rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
    .run("payment_reminder_last_run", JSON.stringify({ at: now, found: overdueInvoices.length, sent }));

  log.info({ found: overdueInvoices.length, sent }, "Payment reminder processor: run complete");
  return sent;
}

export function startScheduler(fastify: FastifyInstance) {
  // Invoice overdue processor — every day at 03:00
  schedule.scheduleJob("invoice-overdue-processor", "0 3 * * *", () => {
    runInvoiceOverdueProcessor(fastify.log);
  });

  // Complete therapies — every hour (mark past CONFIRMED as COMPLETED)
  schedule.scheduleJob("complete-therapies", "0 * * * *", () => {
    runCompleteTherapies(fastify.log);
  });

  // Payment reminder processor — every day at 09:00
  schedule.scheduleJob("payment-reminder", "0 9 * * *", () => {
    runPaymentReminderProcessor(fastify.log);
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

  // Slot recovery autonomy engine — every 10 minutes
  schedule.scheduleJob("slot-recovery-engine", "*/10 * * * *", async () => {
    try {
      const result = await runSlotRecoveryEngine(logShim10);
      rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
        .run("slot_recovery_last_run", JSON.stringify({ at: new Date().toISOString(), ...result }));
      fastify.log.info(result, "Slot recovery engine run complete");
    } catch (e) {
      fastify.log.error({ err: e }, "Slot recovery engine error");
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

  // ── Birthday greetings — daily at 08:00 ────────────────────────────────────
  schedule.scheduleJob("birthday-greeting", "0 8 * * *", async () => {
    try {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const mmdd = `-${month}-${day}`;

      // Find users whose birth_date contains today's MM-DD
      const birthdayUsers = rawSqlite
        .prepare(
          `SELECT id, name FROM users WHERE is_active = 1 AND birth_date IS NOT NULL AND birth_date LIKE ?`
        )
        .all(`%${mmdd}`) as { id: number; name: string }[];

      let sent = 0;
      for (const user of birthdayUsers) {
        // In-app notification
        rawSqlite
          .prepare(
            `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
             VALUES (?, 'GENERAL', 'Vše nejlepší k narozeninám! 🎂', 'Přejeme vám krásný den plný radosti!', 0, datetime('now'))`
          )
          .run(user.id);

        // Add 100 loyalty points
        rawSqlite
          .prepare(
            `INSERT INTO loyalty_points (user_id, points, reason) VALUES (?, 100, 'Narozeninový bonus')`
          )
          .run(user.id);

        sent++;
      }

      rawSqlite.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`)
        .run("birthday_greeting_last_run", JSON.stringify({ at: now.toISOString(), sent }));

      fastify.log.info({ sent }, "Birthday greeting: sent to users");
    } catch (e) {
      fastify.log.error({ err: e }, "Birthday greeting job error");
    }
  });

  // ── First visit follow-up check — every hour ─────────────────────────────
  schedule.scheduleJob("first-visit-followup", "30 * * * *", async () => {
    try {
      // Find recently completed appointments and create follow-ups if first visit
      const { createFollowupIfFirstVisit } = await import("./routes/first-visit-followup.js");

      const recentlyCompleted = rawSqlite
        .prepare(
          `SELECT id FROM appointments
           WHERE status = 'COMPLETED'
             AND updated_at > datetime('now', '-2 hours')
           ORDER BY updated_at DESC`
        )
        .all() as { id: number }[];

      let created = 0;
      for (const appt of recentlyCompleted) {
        const wasCreated = await createFollowupIfFirstVisit(appt.id);
        if (wasCreated) created++;
      }

      if (created > 0) {
        fastify.log.info({ created }, "First visit follow-up: created entries");
      }
    } catch (e) {
      fastify.log.error({ err: e }, "First visit follow-up job error");
    }
  });

  fastify.log.info("Scheduler started: complete-therapies (every hour), invoice-overdue (03:00), payment-reminder (09:00), reminders (every 5min), cancellation-risk (every 6h), slot-recovery (every 10min), reengagement (10:00), wellbeing-reminder (Mon 08:00), birthday-greeting (08:00), first-visit-followup (every hour)");
}

export function getScheduledJobs() {
  const jobs = schedule.scheduledJobs;
  return Object.entries(jobs).map(([name, job]) => ({
    name,
    nextInvocation: job.nextInvocation()?.toISOString() ?? null,
  }));
}
