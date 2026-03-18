import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users, invoices, creditTransactions } from "../db/schema.js";

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /reports/monthly?year=YYYY&month=MM — ADMIN only
  fastify.get("/reports/monthly", async (request, reply) => {
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
  fastify.get("/reports/monthly/export/csv", async (request, reply) => {
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
};

export default reportsRoutes;
