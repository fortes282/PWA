import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users, services } from "../db/schema.js";

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
      topServices,
      topEmployees,
    };
  });
};

export default statsRoutes;
