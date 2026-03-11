import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users, creditTransactions } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/stats", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };

    const allAppts = await db.select().from(appointments);
    const filtered = allAppts.filter((a) => {
      if (q.from && a.startTime < q.from) return false;
      if (q.to && a.startTime > q.to) return false;
      return true;
    });

    const totalAppts = filtered.length;
    const confirmedAppts = filtered.filter((a) => a.status === "CONFIRMED" || a.status === "COMPLETED").length;
    const cancelledAppts = filtered.filter((a) => a.status === "CANCELLED").length;
    const noShowAppts = filtered.filter((a) => a.status === "NO_SHOW").length;
    const revenue = filtered
      .filter((a) => a.status === "COMPLETED" && a.price)
      .reduce((sum, a) => sum + (a.price ?? 0), 0);

    const allUsers = await db.select().from(users);
    const totalClients = allUsers.filter((u) => u.role === "CLIENT").length;

    // Occupancy by day (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentAppts = allAppts.filter((a) => new Date(a.startTime) >= weekAgo);
    const byDay: Record<string, number> = {};
    recentAppts.forEach((a) => {
      const day = a.startTime.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    });

    return {
      totalAppts,
      confirmedAppts,
      cancelledAppts,
      noShowAppts,
      revenue,
      totalClients,
      occupancyByDay: byDay,
    };
  });
};

export default statsRoutes;
