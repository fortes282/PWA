import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { behaviorEvents, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { behaviorSchemas } from "../utils/swagger-schemas.js";

const BEHAVIOR_WEIGHTS = {
  LATE_CANCEL: -10,
  TIMELY_CANCEL: -3,
  ON_TIME: +5,
  POSITIVE_FEEDBACK: +10,
} as const;

const behaviorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { userId: string } }>("/behavior/:userId", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const userId = parseInt(request.params.userId);

    // Behavior score is only tracked for CLIENT role users
    const [targetUser] = await db.select({ role: users.role, score: users.behaviorScore }).from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser || targetUser.role !== "CLIENT") {
      return reply.code(400).send({ error: "Behavior score is only tracked for clients" });
    }

    const events = await db.select().from(behaviorEvents).where(eq(behaviorEvents.userId, userId));

    return {
      userId,
      score: targetUser.score ?? 100,
      events,
    };
  });

  fastify.post("/behavior/record", { schema: behaviorSchemas.record }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { userId, type, note } = request.body as {
      userId: number;
      type: keyof typeof BEHAVIOR_WEIGHTS;
      note?: string;
    };

    // Behavior score is only tracked for CLIENT role users
    const [targetUser] = await db.select({ behaviorScore: users.behaviorScore, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser || targetUser.role !== "CLIENT") {
      return reply.code(400).send({ error: "Behavior score is only tracked for clients" });
    }

    const points = BEHAVIOR_WEIGHTS[type] ?? 0;

    // Get current score
    const newScore = Math.min(100, Math.max(0, (targetUser.behaviorScore ?? 100) + points));

    // Record event
    const [event] = await db.insert(behaviorEvents).values({
      userId,
      type,
      points,
      note: note ?? null,
    }).returning();

    // Update user score
    await db.update(users).set({ behaviorScore: newScore, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    reply.code(201);
    return { event, newScore };
  });
};

export default behaviorRoutes;
