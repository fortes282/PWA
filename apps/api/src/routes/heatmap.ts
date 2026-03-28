import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const heatmapRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /heatmap/therapists?from=YYYY-MM-DD&to=YYYY-MM-DD
  // Aggregate appointments by therapist and hour-of-day (ADMIN/RECEPTION)
  fastify.get("/heatmap/therapists", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { from?: string; to?: string };
    if (!q.from || !q.to) {
      return reply.code(400).send({ error: "from and to (YYYY-MM-DD) are required" });
    }

    const fromDate = q.from;
    const toDate = q.to + "T23:59:59";

    const allTherapists = await db.select().from(users).where(eq(users.role, "EMPLOYEE"));
    const allAppts = (await db.select().from(appointments))
      .filter((a) =>
        a.employeeId !== null &&
        a.startTime >= fromDate &&
        a.startTime <= toDate &&
        a.status !== "CANCELLED"
      );

    // Build matrix: therapist x hour (0-23) -> count
    const matrix: Array<{
      therapistId: number;
      therapistName: string;
      hours: Record<number, number>;
      total: number;
    }> = [];

    for (const therapist of allTherapists) {
      const hours: Record<number, number> = {};
      for (let h = 0; h < 24; h++) {
        hours[h] = 0;
      }

      const therapistAppts = allAppts.filter((a) => a.employeeId === therapist.id);
      for (const appt of therapistAppts) {
        const hour = new Date(appt.startTime).getHours();
        hours[hour] = (hours[hour] ?? 0) + 1;
      }

      matrix.push({
        therapistId: therapist.id,
        therapistName: therapist.name,
        hours,
        total: therapistAppts.length,
      });
    }

    return {
      from: q.from,
      to: q.to,
      therapists: matrix,
    };
  });
};

export default heatmapRoutes;
