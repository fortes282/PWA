import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { wellbeingSurveys, users, appointments, workingHours } from "../db/schema.js";
import { eq, desc, and, gte, sql } from "drizzle-orm";

/** Returns ISO week string like "2024-W12" for a given date */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Parse "2024-W12" → Monday date */
function weekToDate(week: string): Date {
  const [year, w] = week.split("-W");
  const jan4 = new Date(Date.UTC(parseInt(year), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  return new Date(mondayOfWeek1.getTime() + (parseInt(w) - 1) * 7 * 86400000);
}

const wellbeingRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /wellbeing/survey — uloží týdenní dotazník
  fastify.post("/wellbeing/survey", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as any;
    const { q1, q2, q3, q4, q5, week: weekParam } = body;

    // Validate scores
    for (const [k, v] of Object.entries({ q1, q2, q3, q4, q5 })) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return reply.code(400).send({ error: `${k} must be integer 1-5` });
      }
    }

    const week = weekParam || getISOWeek(new Date());
    const averageScore = (Number(q1) + Number(q2) + Number(q3) + Number(q4) + Number(q5)) / 5;

    // Upsert: delete old for same week then insert
    rawSqlite
      .prepare(`DELETE FROM wellbeing_surveys WHERE user_id = ? AND week = ?`)
      .run(userId, week);

    const [survey] = await db
      .insert(wellbeingSurveys)
      .values({ userId, week, q1: Number(q1), q2: Number(q2), q3: Number(q3), q4: Number(q4), q5: Number(q5), averageScore })
      .returning();

    return reply.code(201).send({ survey });
  });

  // GET /wellbeing/my-history — terapeut vidí svou historii (posledních 12 týdnů)
  fastify.get("/wellbeing/my-history", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const history = await db
      .select()
      .from(wellbeingSurveys)
      .where(eq(wellbeingSurveys.userId, userId))
      .orderBy(desc(wellbeingSurveys.week))
      .limit(12);

    // Current week
    const currentWeek = getISOWeek(new Date());
    const hasCurrentWeek = history.some((s) => s.week === currentWeek);

    // Trend: compare last 4 weeks avg vs previous 4 weeks avg
    let trend: "improving" | "declining" | "stable" = "stable";
    if (history.length >= 4) {
      const recent = history.slice(0, 4).reduce((s, x) => s + x.averageScore, 0) / 4;
      const older = history.slice(4, 8).reduce((s, x) => s + x.averageScore, 0) / (Math.min(history.length - 4, 4) || 1);
      if (history.length >= 8) {
        if (recent > older + 0.2) trend = "improving";
        else if (recent < older - 0.2) trend = "declining";
      }
    }

    const avgScore =
      history.length > 0
        ? history.reduce((s, x) => s + x.averageScore, 0) / history.length
        : null;

    // Tips based on score
    let tips: string[] = [];
    const score = avgScore ?? 0;
    if (score < 2) {
      tips = [
        "Vaše skóre naznačuje vysokou míru vyhoření. Zvažte konzultaci s supervizorem.",
        "Naplánujte si volno nebo sick day, abyste se zregenerovali.",
        "Zkuste mindfulness nebo krátkou meditaci 5 minut denně.",
      ];
    } else if (score < 3) {
      tips = [
        "Vaše wellbeing je pod průměrem. Dbejte na pravidelný odpočinek.",
        "Zkuste sdílet pracovní zátěž s kolegy.",
        "Pohyb a příroda pomáhají obnovit energii — zkuste krátkou procházku.",
      ];
    } else if (score < 4) {
      tips = [
        "Vaše wellbeing je v normě. Udržujte pracovní-životní rovnováhu.",
        "Pamatujte na dostatečný spánek (7-9 hodin).",
        "Udržujte sociální kontakty mimo práci.",
      ];
    } else {
      tips = [
        "Výborně! Vaše wellbeing je na vysoké úrovni. Pokračujte v tom, co děláte.",
        "Sdílejte tipy pro wellbeing s kolegy.",
      ];
    }

    return { history: history.reverse(), hasCurrentWeek, currentWeek, avgScore, trend, tips };
  });

  // GET /wellbeing/team-overview — admin vidí anonymizovaný přehled
  fastify.get("/wellbeing/team-overview", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    // Get all employees
    const employees = rawSqlite
      .prepare(`SELECT id FROM users WHERE role = 'EMPLOYEE' AND is_active = 1`)
      .all() as { id: number }[];

    const totalEmployees = employees.length;

    // Average team score (last 4 weeks)
    const teamScores = rawSqlite
      .prepare(`
        SELECT AVG(average_score) as avg, COUNT(DISTINCT user_id) as respondents
        FROM wellbeing_surveys
        WHERE week >= ?
      `)
      .get(getISOWeek(new Date(Date.now() - 28 * 86400000))) as any;

    // Count therapists below 3 in last 4 weeks
    const belowThreshold = rawSqlite
      .prepare(`
        SELECT user_id, AVG(average_score) as avg
        FROM wellbeing_surveys
        WHERE week >= ?
        GROUP BY user_id
        HAVING avg < 3
      `)
      .all(getISOWeek(new Date(Date.now() - 28 * 86400000))) as any[];

    // ALERT: therapists with score <2.5 for 2+ consecutive weeks
    const alertUsers = rawSqlite
      .prepare(`
        SELECT user_id, COUNT(*) as low_weeks
        FROM wellbeing_surveys
        WHERE average_score < 2.5 AND week >= ?
        GROUP BY user_id
        HAVING low_weeks >= 2
      `)
      .all(getISOWeek(new Date(Date.now() - 14 * 86400000))) as any[];

    // Overtime: compare actual appointment hours vs planned working hours
    // Planned hours per week from working_hours table (sum of minutes / 60)
    const plannedHoursRows = rawSqlite
      .prepare(`
        SELECT user_id, SUM((end_minute - start_minute)) / 60.0 as weekly_planned_hours
        FROM working_hours
        WHERE role = 'EMPLOYEE' OR user_id IN (SELECT id FROM users WHERE role IN ('EMPLOYEE', 'ADMIN'))
        GROUP BY user_id
      `)
      .all() as { user_id: number; weekly_planned_hours: number }[];

    const plannedMap = Object.fromEntries(
      plannedHoursRows.map((r) => [r.user_id, r.weekly_planned_hours])
    );

    // Actual appointment hours last 7 days
    const actualHoursRows = rawSqlite
      .prepare(`
        SELECT employee_id, SUM(
          (strftime('%s', end_time) - strftime('%s', start_time)) / 3600.0
        ) as actual_hours
        FROM appointments
        WHERE status IN ('COMPLETED', 'CONFIRMED') AND start_time >= ?
        GROUP BY employee_id
      `)
      .all(new Date(Date.now() - 7 * 86400000).toISOString()) as { employee_id: number; actual_hours: number }[];

    const actualMap = Object.fromEntries(
      actualHoursRows.map((r) => [r.employee_id, r.actual_hours])
    );

    // Overtime per employee (actual - planned)
    const overtimeList = employees.map((e) => ({
      planned: plannedMap[e.id] ?? 0,
      actual: actualMap[e.id] ?? 0,
      overtime: Math.max(0, (actualMap[e.id] ?? 0) - (plannedMap[e.id] ?? 0)),
    }));

    const totalOvertime = overtimeList.reduce((s, x) => s + x.overtime, 0);
    const avgOvertime = totalEmployees > 0 ? totalOvertime / totalEmployees : 0;

    // Caseload: clients per therapist + avg session duration (last 30 days)
    const caseloadRows = rawSqlite
      .prepare(`
        SELECT 
          a.employee_id,
          COUNT(DISTINCT a.client_id) as client_count,
          AVG((strftime('%s', a.end_time) - strftime('%s', a.start_time)) / 60.0) as avg_duration_min
        FROM appointments a
        WHERE a.status IN ('COMPLETED', 'CONFIRMED') AND a.start_time >= ?
        GROUP BY a.employee_id
      `)
      .all(new Date(Date.now() - 30 * 86400000).toISOString()) as any[];

    const avgClientsPerTherapist =
      caseloadRows.length > 0
        ? caseloadRows.reduce((s: number, r: any) => s + r.client_count, 0) / caseloadRows.length
        : 0;
    const avgSessionDuration =
      caseloadRows.length > 0
        ? caseloadRows.reduce((s: number, r: any) => s + (r.avg_duration_min ?? 0), 0) / caseloadRows.length
        : 0;

    // Team score trend (last 12 weeks, grouped by week)
    const weeklyTrend = rawSqlite
      .prepare(`
        SELECT week, AVG(average_score) as avg_score, COUNT(DISTINCT user_id) as respondents
        FROM wellbeing_surveys
        GROUP BY week
        ORDER BY week DESC
        LIMIT 12
      `)
      .all() as { week: string; avg_score: number; respondents: number }[];

    return {
      totalEmployees,
      respondentsLast4Weeks: teamScores?.respondents ?? 0,
      teamAvgScore: teamScores?.avg ?? null,
      belowThresholdCount: belowThreshold.length,
      alertCount: alertUsers.length,
      overtime: {
        avgHoursPerWeek: avgOvertime,
        totalHoursLastWeek: totalOvertime,
      },
      caseload: {
        avgClientsPerTherapist,
        avgSessionDurationMin: avgSessionDuration,
      },
      weeklyTrend: weeklyTrend.reverse(),
    };
  });
};

export default wellbeingRoutes;
