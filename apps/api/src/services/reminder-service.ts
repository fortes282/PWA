/**
 * Reminder service — sends 24h and 2h reminders for upcoming appointments.
 * Tracks sent reminders to avoid duplicates.
 */
import { rawSqlite } from "../db/index.js";
import { sendEmail } from "./email.js";
import { sendSms } from "./sms.js";

// Ensure reminder_sent_log table exists
function ensureTable() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS reminder_sent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      window TEXT NOT NULL, -- '24h' or '2h'
      channel TEXT NOT NULL, -- 'email', 'sms', 'push', 'inapp'
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(appointment_id, window, channel)
    )
  `);
}

function wasAlreadySent(appointmentId: number, window: string, channel: string): boolean {
  const row = rawSqlite.prepare(
    `SELECT 1 FROM reminder_sent_log WHERE appointment_id = ? AND window = ? AND channel = ?`
  ).get(appointmentId, window, channel);
  return !!row;
}

function markSent(appointmentId: number, window: string, channel: string) {
  try {
    rawSqlite.prepare(
      `INSERT OR IGNORE INTO reminder_sent_log (appointment_id, window, channel) VALUES (?, ?, ?)`
    ).run(appointmentId, window, channel);
  } catch { /* ignore */ }
}

export async function runReminderWindow(
  windowLabel: string,
  windowStart: Date,
  windowEnd: Date,
  log: { info: (m: string) => void; error: (m: string, e?: unknown) => void }
) {
  ensureTable();

  // Get confirmed appointments in the window
  const upcoming = rawSqlite.prepare(`
    SELECT a.id, a.client_id, a.employee_id, a.service_id, a.start_time,
           u.name, u.email, u.phone, u.email_enabled, u.sms_enabled, u.push_enabled, u.push_subscription,
           s.name AS service_name,
           np.email_reminders, np.sms_reminders, np.push_reminders
    FROM appointments a
    JOIN users u ON u.id = a.client_id
    JOIN services s ON s.id = a.service_id
    LEFT JOIN notification_preferences np ON np.user_id = a.client_id
    WHERE a.status = 'CONFIRMED'
      AND a.start_time > ?
      AND a.start_time <= ?
  `).all(windowStart.toISOString(), windowEnd.toISOString()) as any[];

  if (upcoming.length === 0) {
    log.info(`[reminders:${windowLabel}] No appointments in window`);
    return { total: 0, emailSent: 0, smsSent: 0, pushSent: 0, inApp: 0 };
  }

  let emailSent = 0, smsSent = 0, pushSent = 0, inApp = 0;

  for (const appt of upcoming) {
    const dateStr = new Date(appt.start_time).toLocaleString("cs-CZ");
    const svcName = appt.service_name ?? "Termín";

    // In-app notification
    if (!wasAlreadySent(appt.id, windowLabel, "inapp")) {
      try {
        rawSqlite.prepare(`
          INSERT INTO notifications (user_id, type, title, message, created_at)
          VALUES (?, 'APPOINTMENT_REMINDER', 'Připomínka termínu', ?, datetime('now'))
        `).run(appt.client_id, `Váš termín ${svcName} je naplánován na ${dateStr}.`);
        markSent(appt.id, windowLabel, "inapp");
        inApp++;
      } catch { /* ignore */ }
    }

    // Email
    const emailEnabled = appt.email_reminders !== 0 && appt.email_enabled;
    if (emailEnabled && appt.email && !wasAlreadySent(appt.id, windowLabel, "email")) {
      const subject = windowLabel === "2h"
        ? `⏰ Za 2 hodiny: ${svcName} v Přístav Radosti`
        : `📅 Zítra: ${svcName} v Přístav Radosti`;
      const html = `<p>Dobrý den ${appt.name},</p>
<p>připomínáme Vám Váš termín:</p>
<ul>
  <li><strong>Služba:</strong> ${svcName}</li>
  <li><strong>Datum a čas:</strong> ${dateStr}</li>
</ul>
<p>Těšíme se na Vás v Přístav Radosti!</p>`;
      const sent = await sendEmail({ to: appt.email, subject, html });
      if (sent) { markSent(appt.id, windowLabel, "email"); emailSent++; }
    }

    // SMS
    const smsEnabled = appt.sms_reminders !== 0 && appt.sms_enabled;
    if (smsEnabled && appt.phone && !wasAlreadySent(appt.id, windowLabel, "sms")) {
      const msg = windowLabel === "2h"
        ? `Pristav Radosti: Za 2h mate termin (${svcName}) v ${dateStr}. Info: pristav-radosti.cz`
        : `Pristav Radosti: Zitra mate termin (${svcName}) v ${dateStr}. Info: pristav-radosti.cz`;
      const sent = await sendSms(appt.phone, msg);
      if (sent) { markSent(appt.id, windowLabel, "sms"); smsSent++; }
    }

    // Push notification
    const pushEnabled = appt.push_reminders !== 0 && appt.push_enabled;
    if (pushEnabled && appt.push_subscription && !wasAlreadySent(appt.id, windowLabel, "push")) {
      try {
        const webpush = await import("web-push");
        const pub = process.env.VAPID_PUBLIC_KEY;
        const priv = process.env.VAPID_PRIVATE_KEY;
        if (pub && priv) {
          webpush.default.setVapidDetails(
            process.env.VAPID_SUBJECT || "mailto:admin@pristav-radosti.cz",
            pub, priv
          );
          await webpush.default.sendNotification(
            JSON.parse(appt.push_subscription),
            JSON.stringify({
              title: "Připomínka termínu",
              body: `${svcName} — ${dateStr}`,
              icon: "/icons/icon-192.png",
              url: "/client/appointments",
            })
          );
          markSent(appt.id, windowLabel, "push");
          pushSent++;
        }
      } catch { /* ignore push errors */ }
    }
  }

  log.info(
    `[reminders:${windowLabel}] ${upcoming.length} appts → inApp=${inApp}, email=${emailSent}, sms=${smsSent}, push=${pushSent}`
  );
  return { total: upcoming.length, emailSent, smsSent, pushSent, inApp };
}

export async function runAllReminders(
  log: { info: (m: string) => void; error: (m: string, e?: unknown) => void }
) {
  const now = new Date();

  // 24h window: appointments starting between now+23h and now+25h
  const w24start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const w24end = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // 2h window: appointments starting between now+1h and now+3h
  const w2start = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const w2end = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const r24 = await runReminderWindow("24h", w24start, w24end, log);
  const r2 = await runReminderWindow("2h", w2start, w2end, log);

  return { "24h": r24, "2h": r2 };
}
