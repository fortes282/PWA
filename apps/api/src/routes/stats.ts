import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users, services, rooms } from "../db/schema.js";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stats", async (request, reply) => {
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
    const noShowAppts = filtered.filter((a) => a.status === "NO_SHOW").length;
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

    // ── No-show rate ──────────────────────────────────────────────────────────
    const closedAppts = completedAppts + noShowAppts;
    const noShowRate = closedAppts > 0 ? Math.round((noShowAppts / closedAppts) * 100) : 0;

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
      noShowAppts,
      pendingAppts,
      noShowRate,
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
  fastify.get("/stats/top-clients", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "10"), 1), 50);

    const allAppts = await db.select().from(appointments);
    const allUsers = await db.select().from(users);

    const clientStats: Record<number, { completedCount: number; totalRevenue: number; noShows: number }> = {};
    for (const a of allAppts) {
      if (!clientStats[a.clientId]) {
        clientStats[a.clientId] = { completedCount: 0, totalRevenue: 0, noShows: 0 };
      }
      if (a.status === "COMPLETED") {
        clientStats[a.clientId].completedCount++;
        clientStats[a.clientId].totalRevenue += a.price ?? 0;
      }
      if (a.status === "NO_SHOW") {
        clientStats[a.clientId].noShows++;
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
  fastify.get("/stats/revenue-summary", async (request, reply) => {
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

  /**
   * GET /stats/rooms-utilization
   * Returns per-room utilization stats for the last N days (default 30).
   * Query: ?days=30
   * Response: { rooms: [{ id, name, totalAppointments, completedAppointments, cancelledAppointments, utilizationPct, avgPerDay }] }
   */
  fastify.get("/stats/rooms-utilization", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { days?: string };
    const days = Math.min(Math.max(parseInt(q.days || "30", 10), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const allRooms = await db.select().from(rooms);
    const recentAppts = await db.select().from(appointments);
    const periodAppts = recentAppts.filter((a) => a.startTime >= since);

    // Working hours per day — 12h, 6 days/week → max slots per room
    const maxSlotsPerRoom = days * 0.85; // approximate working days * 1 slot/hour * 8h ~= capacity

    const result = allRooms.map((room) => {
      const roomAppts = periodAppts.filter((a) => a.roomId === room.id);
      const totalAppointments = roomAppts.length;
      const completedAppointments = roomAppts.filter((a) => a.status === "COMPLETED").length;
      const cancelledAppointments = roomAppts.filter((a) => a.status === "CANCELLED").length;
      const confirmedAppointments = roomAppts.filter((a) => a.status === "CONFIRMED").length;

      // Utilization = (completed + confirmed) / expected max slots
      const utilizationPct = maxSlotsPerRoom > 0
        ? Math.min(Math.round(((completedAppointments + confirmedAppointments) / maxSlotsPerRoom) * 100), 100)
        : 0;
      const avgPerDay = days > 0 ? Math.round((totalAppointments / days) * 10) / 10 : 0;

      return {
        id: room.id,
        name: room.name,
        isActive: room.isActive,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        confirmedAppointments,
        utilizationPct,
        avgPerDay,
      };
    });

    // Sort by total appointments descending
    result.sort((a, b) => b.totalAppointments - a.totalAppointments);

    return {
      rooms: result,
      periodDays: days,
      since,
      totalRooms: allRooms.length,
      activeRooms: allRooms.filter((r) => r.isActive).length,
    };
  });

  /**
   * GET /stats/employees-performance
   * Returns per-employee appointment stats for the last N days (default 30).
   * Query: ?days=30
   */
  fastify.get("/stats/employees-performance", async (request, reply) => {
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
      const noShow = empAppts.filter((a) => a.status === "NO_SHOW").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        behaviorScore: emp.behaviorScore,
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
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
};

export default statsRoutes;
