/**
 * Gamification — Badge / Achievement System
 * Badge definitions, user badges, badge evaluation, and leaderboard.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

function ensureGamificationTables() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS badge_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon_url TEXT,
      category TEXT NOT NULL,
      threshold INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      badge_id INTEGER NOT NULL,
      earned_at TEXT NOT NULL,
      notified INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
  `);
}

const gamificationRoutes: FastifyPluginAsync = async (fastify) => {
  ensureGamificationTables();

  // GET /gamification/badges — list all badge definitions (ALL authenticated)
  fastify.get("/gamification/badges", async (request, reply) => {
    const { role } = request.auth!;
    if (!role) return reply.code(401).send({ error: "Unauthorized" });

    const rows = rawSqlite.prepare(
      "SELECT * FROM badge_definitions WHERE is_active = 1 ORDER BY category, threshold"
    ).all();
    return rows;
  });

  // GET /gamification/my-badges — badges earned by current user (CLIENT)
  fastify.get("/gamification/my-badges", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    if (role !== "CLIENT") {
      return reply.code(403).send({ error: "Forbidden — client only" });
    }

    const rows = rawSqlite.prepare(
      `SELECT ub.id, ub.earned_at, ub.notified,
              bd.key, bd.name, bd.description, bd.icon_url, bd.category, bd.threshold
       FROM user_badges ub
       JOIN badge_definitions bd ON bd.id = ub.badge_id
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC`
    ).all(userId);
    return rows;
  });

  // POST /gamification/check — evaluate badge rules for a user (ADMIN)
  fastify.post("/gamification/check", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden — admin only" });
    }

    const { userId } = request.body as any;
    if (!userId) return reply.code(400).send({ error: "userId is required" });

    // Gather user stats
    const appointmentCount = (rawSqlite.prepare(
      "SELECT COUNT(*) as n FROM appointments WHERE client_id = ? AND status = 'COMPLETED'"
    ).get(userId) as any)?.n ?? 0;

    const homeworkCount = (rawSqlite.prepare(
      "SELECT COUNT(*) as n FROM homework WHERE client_id = ? AND status = 'COMPLETED'"
    ).get(userId) as any)?.n ?? 0;

    const loyaltyTotal = (rawSqlite.prepare(
      "SELECT COALESCE(SUM(points), 0) as n FROM loyalty_points WHERE user_id = ?"
    ).get(userId) as any)?.n ?? 0;

    const behaviorScore = (rawSqlite.prepare(
      "SELECT behavior_score FROM users WHERE id = ?"
    ).get(userId) as any)?.behavior_score ?? 0;

    const stats: Record<string, number> = {
      ATTENDANCE: appointmentCount,
      HOMEWORK: homeworkCount,
      LOYALTY: loyaltyTotal,
      PROGRESS: behaviorScore,
    };

    // Already-earned badge IDs for this user
    const earned = rawSqlite.prepare(
      "SELECT badge_id FROM user_badges WHERE user_id = ?"
    ).all(userId) as { badge_id: number }[];
    const earnedIds = new Set(earned.map((r) => r.badge_id));

    // All active badge definitions
    const badges = rawSqlite.prepare(
      "SELECT * FROM badge_definitions WHERE is_active = 1"
    ).all() as any[];

    const now = new Date().toISOString();
    const newlyAwarded: any[] = [];

    for (const badge of badges) {
      if (earnedIds.has(badge.id)) continue;

      const userStat = stats[badge.category] ?? 0;
      if (userStat >= badge.threshold) {
        rawSqlite.prepare(
          "INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)"
        ).run(userId, badge.id, now);

        // In-app notification
        rawSqlite.prepare(
          "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'BADGE', ?, ?)"
        ).run(userId, `Nový odznak: ${badge.name}`, badge.description);

        newlyAwarded.push({ badgeId: badge.id, key: badge.key, name: badge.name });
      }
    }

    return { userId, stats, newlyAwarded };
  });

  // GET /gamification/leaderboard — top 10 by badge count (ALL authenticated)
  fastify.get("/gamification/leaderboard", async (request, reply) => {
    const { role } = request.auth!;
    if (!role) return reply.code(401).send({ error: "Unauthorized" });

    const isAdmin = role === "ADMIN";

    const rows = rawSqlite.prepare(
      `SELECT ub.user_id, COUNT(*) as badge_count, u.name
       FROM user_badges ub
       JOIN users u ON u.id = ub.user_id
       GROUP BY ub.user_id
       ORDER BY badge_count DESC
       LIMIT 10`
    ).all() as any[];

    return rows.map((r: any, index: number) => ({
      rank: index + 1,
      badgeCount: r.badge_count,
      // Anonymize name for non-admin users
      name: isAdmin ? r.name : `Uživatel #${r.user_id}`,
      userId: isAdmin ? r.user_id : undefined,
    }));
  });
};

export default gamificationRoutes;
