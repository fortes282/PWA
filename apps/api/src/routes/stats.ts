import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { appointments, users, services, auditLog, notifications } from "../db/schema.js";
import { desc } from "drizzle-orm";
import { statsSchemas } from "../utils/swagger-schemas.js";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stats", { schema: statsSchemas.overview }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };

    const allAppts = await db.select().from(appointments);
    const allUsers = await db.select().from(users);
    const allServices = await db.select().from(services);

    const filtered = allAppts.filter((a) => {
      if (q.from && a.startTime < q.from) return false;
      if (q.to && a.startTime > q.to) return false;
      return true;
    });

    // ── Basic counts ──────────────────────────────────────────────────────────
    const totalAppts = filtered.length;
    const confirmedAppts = filtered.filter(
      (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
    ).length;
    const cancelledAppts = filtered.filter((a) => a.status === "CANCELLED").length;
    const completedAppts = filtered.filter((a) => a.status === "COMPLETED").length;
    const pendingAppts = filtered.filter((a) => a.status === "PENDING").length;

    const revenue = filtered
      .filter((a) => a.status === "COMPLETED" && a.price)
      .reduce((sum, a) => sum + (a.price ?? 0), 0);

    // ── User stats ────────────────────────────────────────────────────────────
    const totalClients = allUsers.filter((u) => u.role === "CLIENT").length;
    const activeClients = allUsers.filter((u) => u.role === "CLIENT" && u.isActive).length;
    const totalEmployees = allUsers.filter(
      (u) => u.role === "EMPLOYEE"
    ).length;

    // ── Occupancy by day (last 14 days) ───────────────────────────────────────
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentAppts = allAppts.filter((a) => new Date(a.startTime) >= twoWeeksAgo);
    const occupancyByDay: Record<string, number> = {};
    recentAppts.forEach((a) => {
      if (a.status === "CANCELLED") return;
      const day = a.startTime.slice(0, 10);
      occupancyByDay[day] = (occupancyByDay[day] ?? 0) + 1;
    });

    // ── Top services ──────────────────────────────────────────────────────────
    const serviceStats: Record<number, { name: string; count: number; revenue: number }> = {};
    allServices.forEach((s) => {
      serviceStats[s.id] = { name: s.name, count: 0, revenue: 0 };
    });
    filtered.forEach((a) => {
      if (!serviceStats[a.serviceId]) {
        serviceStats[a.serviceId] = { name: `#${a.serviceId}`, count: 0, revenue: 0 };
      }
      serviceStats[a.serviceId]!.count += 1;
      if (a.status === "COMPLETED" && a.price) {
        serviceStats[a.serviceId]!.revenue += a.price;
      }
    });
    const topServices = Object.values(serviceStats)
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Top employees (by completed appointments) ─────────────────────────────
    const employeeStats: Record<number, { name: string; completed: number }> = {};
    allUsers
      .filter((u) => u.role === "EMPLOYEE")
      .forEach((u) => {
        employeeStats[u.id] = { name: u.name, completed: 0 };
      });
    filtered
      .filter((a) => a.status === "COMPLETED")
      .forEach((a) => {
        if (!employeeStats[a.employeeId]) {
          employeeStats[a.employeeId] = { name: `#${a.employeeId}`, completed: 0 };
        }
        employeeStats[a.employeeId]!.completed += 1;
      });
    const topEmployees = Object.values(employeeStats)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);

    // ── Revenue by month (last 12 months) ────────────────────────────────────
    const revenueByMonth: Record<string, number> = {};
    const now12 = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now12.getFullYear(), now12.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      revenueByMonth[key] = 0;
    }
    allAppts.forEach((a) => {
      if (a.status === "COMPLETED" && a.price && a.startTime) {
        const month = a.startTime.slice(0, 7);
        if (month in revenueByMonth) {
          revenueByMonth[month] = (revenueByMonth[month] ?? 0) + a.price;
        }
      }
    });

    return {
      totalAppts,
      confirmedAppts,
      cancelledAppts,
      completedAppts,
      pendingAppts,
      revenue,
      totalClients,
      activeClients,
      totalEmployees,
      occupancyByDay,
      revenueByMonth,
      topServices,
      topEmployees,
    };
  });

  // GET /stats/top-clients?limit=N — top clients by completed appointments (ADMIN/RECEPTION)
  fastify.get("/stats/top-clients", { schema: statsSchemas.topClients }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "10"), 1), 50);

    const allAppts = await db.select().from(appointments);
    const allUsers = await db.select().from(users);

    const clientStats: Record<number, { completedCount: number; totalRevenue: number }> = {};
    for (const a of allAppts) {
      if (!clientStats[a.clientId]) {
        clientStats[a.clientId] = { completedCount: 0, totalRevenue: 0 };
      }
      if (a.status === "COMPLETED") {
        clientStats[a.clientId].completedCount++;
        clientStats[a.clientId].totalRevenue += a.price ?? 0;
      }
    }

    const clientMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
    const topClients = Object.entries(clientStats)
      .map(([clientId, stats]) => ({
        clientId: parseInt(clientId),
        clientName: clientMap[parseInt(clientId)]?.name,
        clientEmail: clientMap[parseInt(clientId)]?.email,
        behaviorScore: clientMap[parseInt(clientId)]?.behaviorScore,
        ...stats,
      }))
      .filter((c) => c.completedCount > 0)
      .sort((a, b) => b.completedCount - a.completedCount || b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return topClients;
  });
  // GET /stats/revenue-summary — quick financial summary (ADMIN/RECEPTION)
  fastify.get("/stats/revenue-summary", { schema: statsSchemas.revenueSummary }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const allAppts = await db.select().from(appointments);
    const completed = allAppts.filter((a) => a.status === "COMPLETED");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const totalRevenue = completed.reduce((s, a) => s + (a.price ?? 0), 0);
    const monthRevenue = completed
      .filter((a) => a.startTime >= startOfMonth)
      .reduce((s, a) => s + (a.price ?? 0), 0);
    const weekRevenue = completed
      .filter((a) => a.startTime >= startOfWeek)
      .reduce((s, a) => s + (a.price ?? 0), 0);
    const avgPerSession = completed.length > 0 ? totalRevenue / completed.length : 0;

    return {
      totalRevenue,
      monthRevenue,
      weekRevenue,
      avgPerSession,
      completedSessions: completed.length,
    };
  });

  // rooms-utilization endpoint removed — rooms feature deprecated

  /**
   * GET /stats/employees-performance
   * Returns per-employee appointment stats for the last N days (default 30).
   * Query: ?days=30
   */
  fastify.get("/stats/employees-performance", { schema: statsSchemas.employeesPerformance }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { days?: string };
    const days = Math.min(Math.max(parseInt(q.days || "30", 10), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const employees = await db
      .select()
      .from(users)
      .then((rows) => rows.filter((u) => u.role === "EMPLOYEE" && u.isActive));

    const recentAppts = await db.select().from(appointments);
    const periodAppts = recentAppts.filter((a) => a.startTime >= since);

    const result = employees.map((emp) => {
      const empAppts = periodAppts.filter((a) => a.employeeId === emp.id);
      const total = empAppts.length;
      const completed = empAppts.filter((a) => a.status === "COMPLETED").length;
      const cancelled = empAppts.filter((a) => a.status === "CANCELLED").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        behaviorScore: emp.behaviorScore,
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        completionRate,
        avgPerDay: days > 0 ? Math.round((total / days) * 10) / 10 : 0,
      };
    });

    result.sort((a, b) => b.totalAppointments - a.totalAppointments);

    return {
      employees: result,
      periodDays: days,
    };
  });

  /**
   * GET /stats/activity-feed?limit=20
   * Returns recent system activity: appointments, new users, invoices, audit events.
   * Combines data from multiple tables into a chronological feed.
   * ADMIN/RECEPTION only.
   */
  fastify.get("/stats/activity-feed", { schema: statsSchemas.activityFeed }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "20"), 1), 100);

    const allUsers = await db.select().from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

    const feed: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      userId?: number;
      userName?: string;
      icon: string;
    }> = [];

    // Recent appointments (last 7 days, status changes)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentAppts = (await db.select().from(appointments))
      .filter((a) => a.updatedAt >= weekAgo || a.startTime >= weekAgo)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 30);

    for (const a of recentAppts) {
      const client = userMap[a.clientId];
      const employee = userMap[a.employeeId];
      const statusLabels: Record<string, string> = {
        PENDING: "Nový termín čeká na potvrzení",
        CONFIRMED: "Termín potvrzen",
        COMPLETED: "Termín dokončen",
        CANCELLED: "Termín zrušen",
      };
      const icons: Record<string, string> = {
        PENDING: "🕐",
        CONFIRMED: "✅",
        COMPLETED: "🎉",
        CANCELLED: "❌",
      };
      feed.push({
        id: `appt-${a.id}`,
        type: "appointment",
        title: statusLabels[a.status] ?? `Termín #${a.id}`,
        description: `${client?.name ?? "Klient"} → ${employee?.name ?? "Terapeut"} (${a.startTime.slice(0, 16).replace("T", " ")})`,
        timestamp: a.updatedAt,
        userId: a.clientId,
        userName: client?.name,
        icon: icons[a.status] ?? "📅",
      });
    }

    // New users (last 30 days)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const newUsers = allUsers
      .filter((u) => u.createdAt >= monthAgo)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    for (const u of newUsers) {
      const roleLabels: Record<string, string> = {
        CLIENT: "klient",
        EMPLOYEE: "terapeut",
        RECEPTION: "recepce",
        ADMIN: "admin",
      };
      feed.push({
        id: `user-${u.id}`,
        type: "new_user",
        title: `Nový ${roleLabels[u.role] ?? "uživatel"}: ${u.name}`,
        description: u.email,
        timestamp: u.createdAt,
        userId: u.id,
        userName: u.name,
        icon: "👤",
      });
    }

    // Recent audit log entries (last 3 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    try {
      const auditEntries = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
      const recentAudit = auditEntries
        .filter((a) => a.createdAt && a.createdAt >= threeDaysAgo)
        .slice(0, 20);

      for (const entry of recentAudit) {
        const actor = entry.userId ? userMap[entry.userId] : null;
        feed.push({
          id: `audit-${entry.id}`,
          type: "audit",
          title: entry.action,
          description: entry.details ?? (entry.targetType ? `${entry.targetType} #${entry.targetId}` : ""),
          timestamp: entry.createdAt?.toISOString() ?? new Date().toISOString(),
          userId: entry.userId ?? undefined,
          userName: actor?.name,
          icon: "📋",
        });
      }
    } catch {
      // audit_log might not exist in test environments
    }

    // Sort all by timestamp descending, take limit
    feed.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const items = feed.slice(0, limit);

    return { items, total: feed.length };
  });

  /**
   * GET /stats/quick-summary
   * Quick dashboard summary: today's appointments, pending actions, unread notifications count.
   * ADMIN/RECEPTION only.
   */
  fastify.get("/stats/quick-summary", { schema: statsSchemas.quickSummary }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const allAppts = await db.select().from(appointments);
    const todayAppts = allAppts.filter((a) => a.startTime.startsWith(today));

    const todayCompleted = todayAppts.filter((a) => a.status === "COMPLETED").length;
    const todayPending = todayAppts.filter((a) => a.status === "PENDING").length;
    const todayConfirmed = todayAppts.filter((a) => a.status === "CONFIRMED").length;
    const todayCancelled = todayAppts.filter((a) => a.status === "CANCELLED").length;
    const todayRevenue = todayAppts
      .filter((a) => a.status === "COMPLETED" && a.price)
      .reduce((s, a) => s + (a.price ?? 0), 0);

    // Upcoming appointments (next 2 hours)
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const nowStr = new Date().toISOString();
    const upcoming = allAppts
      .filter((a) => a.startTime >= nowStr && a.startTime <= twoHoursLater && ["CONFIRMED", "PENDING"].includes(a.status))
      .length;

    // Total pending across all days
    const allPending = allAppts.filter((a) => a.status === "PENDING").length;

    return {
      today: {
        total: todayAppts.length,
        completed: todayCompleted,
        pending: todayPending,
        confirmed: todayConfirmed,
        cancelled: todayCancelled,
        revenue: todayRevenue,
      },
      upcomingNext2h: upcoming,
      totalPendingAll: allPending,
    };
  });
};

export default statsRoutes;
