import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { behaviorEvents, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const BEHAVIOR_WEIGHTS = {
  NO_SHOW: -20,
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
    const events = await db.select().from(behaviorEvents).where(eq(behaviorEvents.userId, userId));
    const [user] = await db.select({ score: users.behaviorScore }).from(users).where(eq(users.id, userId)).limit(1);

    return {
      userId,
      score: user?.score ?? 100,
      events,
    };
  });

  fastify.post("/behavior/record", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { userId, type, note } = request.body as {
      userId: number;
      type: keyof typeof BEHAVIOR_WEIGHTS;
      note?: string;
    };

    const points = BEHAVIOR_WEIGHTS[type] ?? 0;

    // Get current score
    const [user] = await db.select({ behaviorScore: users.behaviorScore }).from(users).where(eq(users.id, userId)).limit(1);
    const newScore = Math.min(100, Math.max(0, (user?.behaviorScore ?? 100) + points));

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
