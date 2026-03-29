/**
 * SHOULD #10 — AI Predictive Waitlist Management
 * Cancellation Risk Scoring (heuristic, no ML)
 *
 * Score 0-100 where higher = more likely to cancel
 *
 * Factors:
 *  - Historical cancellation rate (0-40 pts)
 *  - Time since booking (0-20 pts) — last-minute bookings cancel more
 *  - Day of week (0-10 pts) — Mon/Fri higher risk
 *  - Days since last visit (0-15 pts) — long gap = less committed
 *  - Total cancellation count (0-15 pts)
 */

import { rawSqlite } from "../db/index.js";

export interface RiskScore {
  score: number;
  factors: {
    cancellationRate: number;
    timeSinceBooking: number;
    dayOfWeek: number;
    daysSinceLastVisit: number;
    cancellationCount: number;
  };
}

/**
 * Compute cancellation risk score for an appointment.
 * @param appointmentId - the appointment to score
 * @returns score 0-100 and factor breakdown
 */
export function computeCancellationRisk(appointmentId: number): RiskScore {
  const appt = rawSqlite.prepare(`
    SELECT a.id, a.client_id, a.start_time, a.created_at, a.status
    FROM appointments a
    WHERE a.id = ?
  `).get(appointmentId) as { id: number; client_id: number; start_time: string; created_at: string; status: string } | undefined;

  if (!appt) return { score: 0, factors: { cancellationRate: 0, timeSinceBooking: 0, dayOfWeek: 0, daysSinceLastVisit: 0, cancellationCount: 0 } };

  const clientId = appt.client_id;

  // ── Factor 1: Historical cancellation rate (0-40 pts) ──────────────────────
  const history = rawSqlite.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS bad
    FROM appointments
    WHERE client_id = ? AND id != ? AND status IN ('COMPLETED', 'CANCELLED')
  `).get(clientId, appointmentId) as { total: number; bad: number };

  let cancellationRatePts = 0;
  if (history.total >= 3) {
    const rate = history.bad / history.total;
    cancellationRatePts = Math.round(rate * 40);
  } else if (history.total > 0) {
    // Low data — partial penalty
    const rate = history.bad / history.total;
    cancellationRatePts = Math.round(rate * 20);
  }

  // ── Factor 2: Time from booking to appointment (0-20 pts) ──────────────────
  // Last-minute bookings (<24h): low risk (0 pts)
  // Bookings made >7 days ago: higher risk of forgetting (max 20 pts)
  const hoursFromBooking = (new Date(appt.start_time).getTime() - new Date(appt.created_at).getTime()) / (1000 * 60 * 60);
  let timeSinceBookingPts = 0;
  if (hoursFromBooking > 24 * 30) timeSinceBookingPts = 20;
  else if (hoursFromBooking > 24 * 14) timeSinceBookingPts = 15;
  else if (hoursFromBooking > 24 * 7) timeSinceBookingPts = 10;
  else if (hoursFromBooking > 24 * 3) timeSinceBookingPts = 5;
  else timeSinceBookingPts = 0;

  // ── Factor 3: Day of week (0-10 pts) ───────────────────────────────────────
  // Monday (1) and Friday (5) have higher cancellation rates
  const dow = new Date(appt.start_time).getDay(); // 0=Sun
  const dowRisk: Record<number, number> = { 0: 8, 1: 10, 5: 8, 6: 6 }; // Sun=8, Mon=10, Fri=8, Sat=6
  const dayOfWeekPts = dowRisk[dow] ?? 3;

  // ── Factor 4: Days since last completed visit (0-15 pts) ───────────────────
  const lastVisit = rawSqlite.prepare(`
    SELECT MAX(start_time) AS last
    FROM appointments
    WHERE client_id = ? AND status = 'COMPLETED' AND id != ?
  `).get(clientId, appointmentId) as { last: string | null };

  let daysSinceLastVisitPts = 0;
  if (!lastVisit.last) {
    // New client — moderate risk
    daysSinceLastVisitPts = 8;
  } else {
    const daysSince = (Date.now() - new Date(lastVisit.last).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 90) daysSinceLastVisitPts = 15;
    else if (daysSince > 60) daysSinceLastVisitPts = 12;
    else if (daysSince > 30) daysSinceLastVisitPts = 8;
    else if (daysSince > 14) daysSinceLastVisitPts = 4;
    else daysSinceLastVisitPts = 0;
  }

  // ── Factor 5: Total cancellation count (0-15 pts) ──────────────────────────
  const totalCancels = rawSqlite.prepare(`
    SELECT COUNT(*) AS n FROM appointments
    WHERE client_id = ? AND status = 'CANCELLED' AND id != ?
  `).get(clientId, appointmentId) as { n: number };

  let cancellationCountPts = 0;
  if (totalCancels.n >= 5) cancellationCountPts = 15;
  else if (totalCancels.n >= 3) cancellationCountPts = 10;
  else if (totalCancels.n >= 1) cancellationCountPts = 5;

  const total = Math.min(100, cancellationRatePts + timeSinceBookingPts + dayOfWeekPts + daysSinceLastVisitPts + cancellationCountPts);

  return {
    score: total,
    factors: {
      cancellationRate: cancellationRatePts,
      timeSinceBooking: timeSinceBookingPts,
      dayOfWeek: dayOfWeekPts,
      daysSinceLastVisit: daysSinceLastVisitPts,
      cancellationCount: cancellationCountPts,
    },
  };
}

/**
 * Compute and persist cancellation risk score for an appointment.
 */
export function updateAppointmentRiskScore(appointmentId: number): number {
  const { score } = computeCancellationRisk(appointmentId);
  rawSqlite.prepare(`UPDATE appointments SET cancellation_risk_score = ? WHERE id = ?`).run(score, appointmentId);
  return score;
}

/**
 * Re-score all upcoming appointments (used by background job).
 * Returns number of appointments updated.
 */
export function refreshUpcomingRiskScores(): number {
  const upcoming = rawSqlite.prepare(`
    SELECT id FROM appointments
    WHERE status IN ('PENDING', 'CONFIRMED')
      AND start_time > datetime('now')
  `).all() as Array<{ id: number }>;

  for (const { id } of upcoming) {
    updateAppointmentRiskScore(id);
  }
  return upcoming.length;
}
