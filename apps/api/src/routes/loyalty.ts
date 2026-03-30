/**
 * Loyalty Points — NOC 15/3
 * +10 on appointment COMPLETED, +5 on invoice PAID
 * GET /loyalty/points → balance + history (CLIENT: own, ADMIN/RECEPTION: ?userId=)
 * GET /loyalty/leaderboard?limit=10 → top clients (ADMIN/RECEPTION)
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { loyaltySchemas } from "../utils/swagger-schemas.js";

export async function addLoyaltyPoints(userId: number, points: number, reason: string): Promise<void> {
  try {
    rawSqlite.prepare(
      "INSERT INTO loyalty_points (user_id, points, reason) VALUES (?, ?, ?)"
    ).run(userId, points, reason);
  } catch {
    // Table might not exist yet in some test scenarios
  }
}

const loyaltyRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /loyalty/points — own balance + history (CLIENT), or ?userId= (ADMIN/RECEPTION)
  fastify.get("/loyalty/points", { schema: loyaltySchemas.points }, async (request, reply) => {
    const { id, role } = request.auth!;
    const q = request.query as { userId?: string };

    let targetId = id;
    if (["ADMIN", "RECEPTION"].includes(role) && q.userId) {
      targetId = parseInt(q.userId);
    } else if (role === "CLIENT") {
      targetId = id;
    } else {
      // EMPLOYEE or other non-CLIENT roles cannot access their own loyalty points
      return reply.code(403).send({ error: "Loyalty points are only available for clients" });
    }

    const history = rawSqlite
      .prepare("SELECT * FROM loyalty_points WHERE user_id = ? ORDER BY id DESC LIMIT 50")
      .all(targetId) as Array<{ id: number; user_id: number; points: number; reason: string; created_at: string }>;

    const balance = history.reduce((sum, row) => sum + row.points, 0);

    return { balance, history };
  });

  // GET /loyalty/leaderboard?limit=10 — top clients (ADMIN/RECEPTION)
  fastify.get("/loyalty/leaderboard", { schema: loyaltySchemas.leaderboard }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { limit?: string };
    const limit = Math.min(parseInt(q.limit ?? "10"), 50);

    const rows = rawSqlite.prepare(`
      SELECT lp.user_id, u.name, u.email, SUM(lp.points) as total_points
      FROM loyalty_points lp
      JOIN users u ON u.id = lp.user_id
      GROUP BY lp.user_id
      ORDER BY total_points DESC
      LIMIT ?
    `).all(limit) as Array<{ user_id: number; name: string; email: string; total_points: number }>;

    return rows;
  });
};

export default loyaltyRoutes;
