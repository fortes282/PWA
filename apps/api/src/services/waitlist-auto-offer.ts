/**
 * SHOULD #10 — Waitlist Auto-Offer Service
 *
 * Finds upcoming appointments with high cancellation risk (>70)
 * that are within 48h and notifies the first suitable waitlist client.
 */

import { rawSqlite } from "../db/index.js";
import { sendEmail } from "./email.js";
import { sendSms } from "./sms.js";

export interface AutoOfferResult {
  appointmentId: number;
  riskScore: number;
  notifiedClientId: number | null;
  channel: "email" | "sms" | "none";
}

/**
 * Run auto-offer: find high-risk appointments in next 48h,
 * notify first matching waitlist client.
 */
export async function runWaitlistAutoOffer(log: { info: (m: string, d?: unknown) => void; error: (m: string, e?: unknown) => void }): Promise<AutoOfferResult[]> {
  const now = new Date().toISOString();
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // Find high-risk appointments in next 48h
  const highRiskAppts = rawSqlite.prepare(`
    SELECT
      a.id, a.client_id, a.employee_id, a.service_id,
      a.start_time, a.end_time, a.cancellation_risk_score,
      e.name AS employee_name,
      s.name AS service_name
    FROM appointments a
    JOIN users e ON e.id = a.employee_id
    JOIN services s ON s.id = a.service_id
    WHERE a.status IN ('PENDING', 'CONFIRMED')
      AND a.start_time >= ?
      AND a.start_time <= ?
      AND a.cancellation_risk_score > 70
    ORDER BY a.cancellation_risk_score DESC
  `).all(now, in48h) as Array<{
    id: number; client_id: number; employee_id: number; service_id: number;
    start_time: string; end_time: string; cancellation_risk_score: number;
    employee_name: string; service_name: string;
  }>;

  const results: AutoOfferResult[] = [];

  for (const appt of highRiskAppts) {
    // Find first suitable waiting client for this service/employee
    const candidate = rawSqlite.prepare(`
      SELECT w.id AS waitlist_id, w.client_id,
        u.name, u.email, u.phone, u.email_enabled, u.sms_enabled
      FROM waitlist w
      JOIN users u ON u.id = w.client_id
      WHERE w.status = 'WAITING'
        AND w.service_id = ?
        AND (w.employee_id IS NULL OR w.employee_id = ?)
        AND w.client_id != ?
      ORDER BY w.created_at ASC
      LIMIT 1
    `).get(appt.service_id, appt.employee_id, appt.client_id) as {
      waitlist_id: number; client_id: number; name: string;
      email: string; phone: string | null; email_enabled: number; sms_enabled: number;
    } | undefined;

    if (!candidate) {
      results.push({ appointmentId: appt.id, riskScore: appt.cancellation_risk_score, notifiedClientId: null, channel: "none" });
      continue;
    }

    // Check if we already notified about this appointment recently
    const alreadyNotified = rawSqlite.prepare(`
      SELECT id FROM notifications
      WHERE user_id = ? AND type = 'WAITLIST_AUTO_OFFER'
        AND metadata LIKE ?
        AND created_at > datetime('now', '-24 hours')
    `).get(candidate.client_id, `%"appointmentId":${appt.id}%`) as { id: number } | undefined;

    if (alreadyNotified) {
      results.push({ appointmentId: appt.id, riskScore: appt.cancellation_risk_score, notifiedClientId: null, channel: "none" });
      continue;
    }

    const startDate = new Date(appt.start_time);
    const dateStr = startDate.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
    const timeStr = startDate.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    const offerToken = Buffer.from(JSON.stringify({ apptId: appt.id, clientId: candidate.client_id, ts: Date.now() })).toString("base64url");

    const message = `Uvolnil se termín ${dateStr} v ${timeStr} u ${appt.employee_name} (${appt.service_name}). Chcete ho?\n\nPřijmout: ${process.env.APP_URL ?? "https://pristav-radosti.cz"}/booking/offer/${offerToken}?action=accept\nOdmítnout: ${process.env.APP_URL ?? "https://pristav-radosti.cz"}/booking/offer/${offerToken}?action=decline`;

    let channel: "email" | "sms" | "none" = "none";

    try {
      if (candidate.email_enabled) {
        await sendEmail({
          to: candidate.email,
          subject: `Volný termín: ${dateStr} v ${timeStr}`,
          html: `<p>Dobrý den ${candidate.name},</p><p>${message.replace(/\n/g, "<br>")}</p>`,
          text: message,
        });
        channel = "email";
      } else if (candidate.phone && candidate.sms_enabled) {
        await sendSms(candidate.phone, message);
        channel = "sms";
      }

      if (channel !== "none") {
        // Mark waitlist entry as notified
        rawSqlite.prepare(`UPDATE waitlist SET status = 'NOTIFIED', notified_at = ?, updated_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), new Date().toISOString(), candidate.waitlist_id);

        // Store notification record
        rawSqlite.prepare(`
          INSERT INTO notifications (user_id, type, title, message, metadata)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          candidate.client_id,
          "WAITLIST_AUTO_OFFER",
          `Volný termín ${dateStr} v ${timeStr}`,
          message,
          JSON.stringify({ appointmentId: appt.id, offerToken, employeeName: appt.employee_name })
        );

        log.info(`Waitlist auto-offer: notified client ${candidate.client_id} about appointment ${appt.id} via ${channel}`);
      }

      results.push({ appointmentId: appt.id, riskScore: appt.cancellation_risk_score, notifiedClientId: candidate.client_id, channel });
    } catch (err) {
      log.error(`Waitlist auto-offer: failed to notify client ${candidate.client_id}`, err);
      results.push({ appointmentId: appt.id, riskScore: appt.cancellation_risk_score, notifiedClientId: null, channel: "none" });
    }
  }

  return results;
}
