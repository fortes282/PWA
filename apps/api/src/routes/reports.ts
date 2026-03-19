import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { appointments, users, invoices, creditTransactions, medicalReports, therapyReports, appointmentRatings } from "../db/schema.js";
import { reportSchemas, reportExtSchemas } from "../utils/swagger-schemas.js";

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /reports/monthly?year=YYYY&month=MM — ADMIN only
  fastify.get("/reports/monthly", { schema: reportExtSchemas.monthly }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { year?: string; month?: string };
    const year = parseInt(q.year ?? String(new Date().getFullYear()));
    const month = parseInt(q.month ?? String(new Date().getMonth() + 1));

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return reply.code(400).send({ error: "Invalid year or month" });
    }

    const monthStr = String(month).padStart(2, "0");
    const periodStart = `${year}-${monthStr}-01`;
    const periodEnd = `${year}-${monthStr}-31T23:59:59`;

    const allAppts = await db.select().from(appointments);
    const periodAppts = allAppts.filter(
      (a) => a.startTime >= periodStart && a.startTime <= periodEnd
    );

    const completed = periodAppts.filter((a) => a.status === "COMPLETED");
    const cancelled = periodAppts.filter((a) => a.status === "CANCELLED");
    const noShow = periodAppts.filter((a) => a.status === "NO_SHOW");

    // Revenue from completed appointments
    const totalRevenue = completed.reduce((sum, a) => sum + (a.price ?? 0), 0);

    // Revenue by service
    const serviceRevMap: Record<number, { serviceId: number; total: number; count: number }> = {};
    for (const a of completed) {
      if (!serviceRevMap[a.serviceId]) {
        serviceRevMap[a.serviceId] = { serviceId: a.serviceId, total: 0, count: 0 };
      }
      serviceRevMap[a.serviceId].total += a.price ?? 0;
      serviceRevMap[a.serviceId].count++;
    }
    const byService = Object.values(serviceRevMap).sort((a, b) => b.total - a.total);

    // Top clients by completed appointments
    const clientMap: Record<number, { clientId: number; count: number; revenue: number }> = {};
    for (const a of completed) {
      if (!clientMap[a.clientId]) clientMap[a.clientId] = { clientId: a.clientId, count: 0, revenue: 0 };
      clientMap[a.clientId].count++;
      clientMap[a.clientId].revenue += a.price ?? 0;
    }
    const topClients = Object.values(clientMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Top employees
    const empMap: Record<number, { employeeId: number; count: number; revenue: number }> = {};
    for (const a of completed) {
      if (!empMap[a.employeeId]) empMap[a.employeeId] = { employeeId: a.employeeId, count: 0, revenue: 0 };
      empMap[a.employeeId].count++;
      empMap[a.employeeId].revenue += a.price ?? 0;
    }
    const topEmployees = Object.values(empMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // New clients (registered this month)
    const allUsers = await db.select().from(users);
    const newClients = allUsers.filter(
      (u) => u.role === "CLIENT" && u.createdAt >= periodStart && u.createdAt <= periodEnd
    ).length;

    const avgSessionValue = completed.length > 0 ? totalRevenue / completed.length : 0;
    const completionRate = periodAppts.length > 0
      ? Math.round((completed.length / periodAppts.length) * 100)
      : 0;

    return {
      period: { year, month, start: periodStart, end: `${year}-${monthStr}-31` },
      revenue: {
        total: totalRevenue,
        byService,
      },
      appointments: {
        total: periodAppts.length,
        completed: completed.length,
        cancelled: cancelled.length,
        noShow: noShow.length,
        pending: periodAppts.filter((a) => a.status === "PENDING").length,
        confirmed: periodAppts.filter((a) => a.status === "CONFIRMED").length,
        completionRate,
      },
      topClients,
      topEmployees,
      newClients,
      avgSessionValue,
    };
  });
  // GET /reports/monthly/export/csv?year=YYYY&month=MM — ADMIN only
  fastify.get("/reports/monthly/export/csv", { schema: reportExtSchemas.monthlyCsv }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const q = request.query as { year?: string; month?: string };
    const year = parseInt(q.year ?? String(new Date().getFullYear()));
    const month = parseInt(q.month ?? String(new Date().getMonth() + 1));

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return reply.code(400).send({ error: "Invalid year or month" });
    }

    const monthStr = String(month).padStart(2, "0");
    const periodStart = `${year}-${monthStr}-01`;
    const periodEnd = `${year}-${monthStr}-31T23:59:59`;

    const allAppts = await db.select().from(appointments);
    const periodAppts = allAppts.filter(
      (a) => a.startTime >= periodStart && a.startTime <= periodEnd
    );

    const allUsers = await db.select().from(users);

    // Build daily breakdown
    const daysInMonth = new Date(year, month, 0).getDate();
    const rows: string[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, "0");
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      const dayAppts = periodAppts.filter((a) => a.startTime.startsWith(dateKey));
      const completed = dayAppts.filter((a) => a.status === "COMPLETED");
      const revenue = completed.reduce((s, a) => s + (a.price ?? 0), 0);
      const newClients = allUsers.filter(
        (u) => u.role === "CLIENT" && u.createdAt.startsWith(dateKey)
      ).length;
      const avgSessionValue = completed.length > 0 ? revenue / completed.length : 0;

      rows.push([
        dateKey,
        dayAppts.length,
        completed.length,
        revenue.toFixed(2),
        newClients,
        avgSessionValue.toFixed(2),
      ].join(","));
    }

    const header = "date,appointments_total,appointments_completed,revenue,new_clients,avg_session_value";
    const csv = [header, ...rows].join("\r\n");
    const filename = `monthly-report-${year}-${monthStr}.csv`;

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send("\uFEFF" + csv);
  });
  // GET /reports/revenue-monthly?year=2026
  fastify.get("/reports/revenue-monthly", { schema: reportSchemas.revenueMonthly }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { year?: string };
    const year = parseInt(q.year ?? String(new Date().getFullYear()));
    if (isNaN(year)) return reply.code(400).send({ error: "Invalid year" });

    const allAppts = rawSqlite.prepare(`
      SELECT start_time, status, price FROM appointments
      WHERE start_time >= ? AND start_time <= ?
    `).all(`${year}-01-01`, `${year}-12-31T23:59:59`) as Array<{start_time: string; status: string; price: number | null}>;

    const allInvoices = rawSqlite.prepare(`
      SELECT created_at, status FROM invoices WHERE created_at >= ? AND created_at <= ?
    `).all(`${year}-01-01`, `${year}-12-31T23:59:59`) as Array<{created_at: string; status: string}>;

    const allClients = rawSqlite.prepare(`
      SELECT created_at FROM users WHERE role = 'CLIENT' AND created_at >= ? AND created_at <= ?
    `).all(`${year}-01-01`, `${year}-12-31T23:59:59`) as Array<{created_at: string}>;

    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthStr = String(month).padStart(2, "0");
      const prefix = `${year}-${monthStr}`;

      const monthAppts = allAppts.filter(a => a.start_time.startsWith(prefix));
      const completed = monthAppts.filter(a => a.status === "COMPLETED");
      const totalRevenue = completed.reduce((s, a) => s + (a.price ?? 0), 0);

      const monthInvoices = allInvoices.filter(inv => inv.created_at.startsWith(prefix));
      const paidInvoices = monthInvoices.filter(inv => inv.status === "PAID").length;
      const pendingInvoices = monthInvoices.filter(inv => ["DRAFT", "SENT"].includes(inv.status)).length;

      const newClients = allClients.filter(u => u.created_at.startsWith(prefix)).length;

      return {
        month,
        monthStr: prefix,
        totalRevenue,
        paidInvoices,
        pendingInvoices,
        newClients,
        completedAppointments: completed.length,
      };
    });

    return { year, months };
  });

  // GET /reports/occupancy-weekly?from=YYYY-MM-DD&to=YYYY-MM-DD
  fastify.get("/reports/occupancy-weekly", { schema: reportSchemas.occupancyWeekly }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };
    const from = q.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = q.to ?? new Date().toISOString().slice(0, 10);

    const appts = rawSqlite.prepare(`
      SELECT start_time, status FROM appointments
      WHERE start_time >= ? AND start_time <= ?
    `).all(from, to + "T23:59:59") as Array<{start_time: string; status: string}>;

    // Group by ISO week
    const weekMap: Record<string, { totalSlots: number; bookedSlots: number }> = {};

    for (const appt of appts) {
      const d = new Date(appt.start_time);
      // Get ISO week start (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const weekKey = monday.toISOString().slice(0, 10);

      if (!weekMap[weekKey]) weekMap[weekKey] = { totalSlots: 0, bookedSlots: 0 };
      weekMap[weekKey].totalSlots++;
      if (!["CANCELLED"].includes(appt.status)) {
        weekMap[weekKey].bookedSlots++;
      }
    }

    const weeks = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        totalSlots: data.totalSlots,
        bookedSlots: data.bookedSlots,
        occupancyRate: data.totalSlots > 0 ? Math.round((data.bookedSlots / data.totalSlots) * 100) : 0,
      }));

    return { from, to, weeks };
  });
  // GET /reports/progress/:clientId — progress report for client (CLIENT sees own, EMPLOYEE/ADMIN see any)
  fastify.get("/reports/progress/:clientId", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const { clientId: clientIdStr } = request.params as { clientId: string };
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) return reply.code(400).send({ error: "Invalid clientId" });

    // Access control
    if (role === "CLIENT" && userId !== clientId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    if (!["CLIENT", "EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    // Employee can only see their own clients
    if (role === "EMPLOYEE") {
      const hasClient = rawSqlite.prepare(`
        SELECT 1 FROM appointments WHERE client_id = ? AND employee_id = ? LIMIT 1
      `).get(clientId, userId);
      if (!hasClient) return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { year?: string; month?: string };
    const now = new Date();
    const year = parseInt(q.year ?? String(now.getFullYear()));
    const month = parseInt(q.month ?? String(now.getMonth() + 1));

    // Get client info
    const clientRow = rawSqlite.prepare(`SELECT id, name, email FROM users WHERE id = ?`).get(clientId) as any;
    if (!clientRow) return reply.code(404).send({ error: "Client not found" });

    // Monthly attendance: last 6 months
    const monthsData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const prefix = `${y}-${m}`;

      const monthAppts = rawSqlite.prepare(`
        SELECT status FROM appointments WHERE client_id = ? AND start_time LIKE ?
      `).all(clientId, `${prefix}%`) as any[];

      const planned = monthAppts.length;
      const attended = monthAppts.filter((a: any) => a.status === "COMPLETED").length;
      const cancelled = monthAppts.filter((a: any) => a.status === "CANCELLED").length;
      const noShow = monthAppts.filter((a: any) => a.status === "NO_SHOW").length;

      return {
        label: d.toLocaleDateString("cs-CZ", { month: "short", year: "2-digit" }),
        month: prefix,
        planned,
        attended,
        cancelled,
        noShow,
        attendanceRate: planned > 0 ? Math.round((attended / planned) * 100) : null,
      };
    });

    // Ratings history (last 6 months) — rating given by client for appointments
    const ratingsData = rawSqlite.prepare(`
      SELECT ar.rating, ar.created_at, ar.comment
      FROM appointment_ratings ar
      JOIN appointments a ON a.id = ar.appointment_id
      WHERE ar.client_id = ?
      ORDER BY ar.created_at ASC
    `).all(clientId) as any[];

    const ratingsPerMonth = monthsData.map((m) => {
      const monthRatings = ratingsData.filter((r: any) => r.created_at.startsWith(m.month));
      const avg = monthRatings.length > 0
        ? Math.round((monthRatings.reduce((s: number, r: any) => s + r.rating, 0) / monthRatings.length) * 10) / 10
        : null;
      return { label: m.label, month: m.month, avgRating: avg, count: monthRatings.length };
    });

    // Therapy reports milestones
    const therapyRpts = rawSqlite.prepare(`
      SELECT id, title, data, status, created_at, therapist_id
      FROM therapy_reports
      WHERE client_id = ?
      ORDER BY created_at ASC
    `).all(clientId) as any[];

    const milestones = therapyRpts.map((r: any) => {
      let parsedData: any = {};
      try { parsedData = JSON.parse(r.data); } catch {}
      return {
        id: r.id,
        title: r.title,
        date: r.created_at.slice(0, 10),
        status: r.status,
      };
    });

    // Latest therapy report recommendation
    const latestReport = therapyRpts[therapyRpts.length - 1];
    let latestRecommendation: string | null = null;
    let latestReportTitle: string | null = null;
    if (latestReport) {
      latestReportTitle = latestReport.title;
      try {
        const d = JSON.parse(latestReport.data);
        // Try common field names for recommendations
        latestRecommendation = d.recommendation ?? d.recommendations ?? d.doporuceni ?? d.doporučení ?? null;
        // If data is an array of sections, search through them
        if (!latestRecommendation && Array.isArray(d)) {
          for (const section of d) {
            if (Array.isArray(section.fields)) {
              for (const field of section.fields) {
                if (field.key && /recommend|doporuc/i.test(field.key)) {
                  latestRecommendation = field.value ?? null;
                }
              }
            }
          }
        }
      } catch {}

      // Also check medical reports
      const latestMedical = rawSqlite.prepare(`
        SELECT recommendations, title FROM medical_reports
        WHERE client_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(clientId) as any;
      if (latestMedical?.recommendations) {
        latestRecommendation = latestRecommendation ?? latestMedical.recommendations;
      }
    } else {
      // Check medical reports only
      const latestMedical = rawSqlite.prepare(`
        SELECT recommendations, title FROM medical_reports
        WHERE client_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(clientId) as any;
      if (latestMedical?.recommendations) {
        latestRecommendation = latestMedical.recommendations;
        latestReportTitle = latestMedical.title;
      }
    }

    // Summary stats
    const totalStats = rawSqlite.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_show
      FROM appointments WHERE client_id = ?
    `).get(clientId) as any;

    const avgRatingAll = rawSqlite.prepare(`
      SELECT ROUND(AVG(ar.rating), 1) as avg, COUNT(*) as n
      FROM appointment_ratings ar WHERE ar.client_id = ?
    `).get(clientId) as any;

    // Current month summary
    const monthStr = String(month).padStart(2, "0");
    const currentMonthPrefix = `${year}-${monthStr}`;
    const currentMonthData = monthsData.find((m) => m.month === currentMonthPrefix) ?? {
      planned: 0, attended: 0, cancelled: 0, noShow: 0, attendanceRate: null
    };

    return {
      client: { id: clientId, name: clientRow.name, email: clientRow.email },
      period: { year, month },
      summary: {
        totalAppointments: totalStats?.total ?? 0,
        completedAppointments: totalStats?.completed ?? 0,
        cancelledAppointments: totalStats?.cancelled ?? 0,
        noShowAppointments: totalStats?.no_show ?? 0,
        totalReports: therapyRpts.length,
        avgRating: avgRatingAll?.avg ?? null,
        ratingsCount: avgRatingAll?.n ?? 0,
      },
      currentMonth: currentMonthData,
      attendance: monthsData,
      ratings: ratingsPerMonth,
      milestones,
      latestRecommendation,
      latestReportTitle,
    };
  });
};

export default reportsRoutes;
