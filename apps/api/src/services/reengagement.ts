/**
 * SHOULD #10 — Re-engagement Workflow
 *
 * Daily job: identify clients with no appointment in 30+ days,
 * send re-engagement message (max 1 per 30 days per client).
 */

import { rawSqlite } from "../db/index.js";
import { sendEmail } from "./email.js";
import { sendSms } from "./sms.js";

export interface ReengagementResult {
  totalInactive: number;
  contacted: number;
  skipped: number;
}

/**
 * Run daily re-engagement check.
 * Returns count of clients contacted.
 */
export async function runReengagement(
  log: { info: (m: string, d?: unknown) => void; error: (m: string, e?: unknown) => void }
): Promise<ReengagementResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find clients who had an appointment but not in last 30 days
  // and haven't been re-engaged in last 30 days
  const inactiveClients = rawSqlite.prepare(`
    SELECT
      u.id, u.name, u.email, u.phone,
      u.email_enabled, u.sms_enabled, u.is_active,
      u.last_reengagement_at,
      MAX(a.start_time) AS last_appointment
    FROM users u
    JOIN appointments a ON a.client_id = u.id
    WHERE u.role = 'CLIENT'
      AND u.is_active = 1
      AND u.gdpr_anonymized_at IS NULL
      AND a.status = 'COMPLETED'
    GROUP BY u.id
    HAVING MAX(a.start_time) < ?
      AND (u.last_reengagement_at IS NULL OR u.last_reengagement_at < ?)
  `).all(thirtyDaysAgo, thirtyDaysAgo) as Array<{
    id: number; name: string; email: string; phone: string | null;
    email_enabled: number; sms_enabled: number; is_active: number;
    last_reengagement_at: string | null; last_appointment: string;
  }>;

  let contacted = 0;
  let skipped = 0;

  for (const client of inactiveClients) {
    const appUrl = process.env.APP_URL ?? "https://pristav-radosti.cz";
    const message = `Chybíte nám! Objednejte se na další sezení — ${appUrl}/booking`;
    const html = `<p>Dobrý den ${client.name},</p><p>Chybíte nám! Objednejte se na další sezení.</p><p><a href="${appUrl}/booking" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Objednat se</a></p><p><small>Pokud si nepřejete dostávat tato upozornění, odhlaste se v <a href="${appUrl}/settings">nastavení</a>.</small></p>`;

    let sent = false;
    try {
      if (client.email_enabled && client.email) {
        await sendEmail({
          to: client.email,
          subject: "Chybíte nám — Přístav Radosti",
          html,
          text: message,
        });
        sent = true;
      } else if (client.sms_enabled && client.phone) {
        await sendSms(client.phone, message);
        sent = true;
      }

      if (sent) {
        rawSqlite.prepare(`UPDATE users SET last_reengagement_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), client.id);
        contacted++;
        log.info(`Re-engagement: contacted client ${client.id} (${client.email})`);
      } else {
        skipped++;
      }
    } catch (err) {
      log.error(`Re-engagement: failed to contact client ${client.id}`, err);
      skipped++;
    }
  }

  log.info(`Re-engagement run: ${contacted} contacted, ${skipped} skipped out of ${inactiveClients.length} inactive`);

  return {
    totalInactive: inactiveClients.length,
    contacted,
    skipped,
  };
}
