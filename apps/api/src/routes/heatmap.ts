import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, rooms } from "../db/schema.js";
import { eq } from "drizzle-orm";

const heatmapRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /heatmap/rooms?from=YYYY-MM-DD&to=YYYY-MM-DD
  // Aggregate appointments by room and hour-of-day (ADMIN/RECEPTION)
  fastify.get("/heatmap/rooms", async (request, reply) => {
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

    const allRooms = await db.select().from(rooms).where(eq(rooms.isActive, true));
    const allAppts = (await db.select().from(appointments))
      .filter((a) =>
        a.roomId !== null &&
        a.startTime >= fromDate &&
        a.startTime <= toDate &&
        a.status !== "CANCELLED"
      );

    // Build matrix: room x hour (0-23) -> count
    const matrix: Array<{
      roomId: number;
      roomName: string;
      hours: Record<number, number>;
      total: number;
    }> = [];

    for (const room of allRooms) {
      const hours: Record<number, number> = {};
      for (let h = 0; h < 24; h++) {
        hours[h] = 0;
      }

      const roomAppts = allAppts.filter((a) => a.roomId === room.id);
      for (const appt of roomAppts) {
        const hour = new Date(appt.startTime).getHours();
        hours[hour] = (hours[hour] ?? 0) + 1;
      }

      matrix.push({
        roomId: room.id,
        roomName: room.name,
        hours,
        total: roomAppts.length,
      });
    }

    return {
      from: q.from,
      to: q.to,
      rooms: matrix,
    };
  });
};

export default heatmapRoutes;
