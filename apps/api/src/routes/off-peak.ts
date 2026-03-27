import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { offPeakRules } from "../db/schema.js";
import { eq } from "drizzle-orm";

const offPeakRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /off-peak/rules — list all rules (ADMIN)
  fastify.get("/off-peak/rules", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return db.select().from(offPeakRules).where(eq(offPeakRules.isActive, true));
  });

  // POST /off-peak/rules — create rule (ADMIN)
  fastify.post("/off-peak/rules", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      discountPercent: number;
    };

    if (body.dayOfWeek < 0 || body.dayOfWeek > 6) {
      return reply.code(400).send({ error: "dayOfWeek must be 0-6" });
    }
    if (!body.startTime || !body.endTime) {
      return reply.code(400).send({ error: "startTime and endTime are required (HH:MM)" });
    }
    if (!body.discountPercent || body.discountPercent <= 0 || body.discountPercent > 100) {
      return reply.code(400).send({ error: "discountPercent must be 1-100" });
    }

    const [rule] = await db.insert(offPeakRules).values({
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      discountPercent: body.discountPercent,
    }).returning();

    reply.code(201);
    return rule;
  });

  // DELETE /off-peak/rules/:id — delete rule (ADMIN)
  fastify.delete<{ Params: { id: string } }>("/off-peak/rules/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const ruleId = parseInt(request.params.id);
    const [existing] = await db.select().from(offPeakRules)
      .where(eq(offPeakRules.id, ruleId)).limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Rule not found" });
    }

    await db.update(offPeakRules)
      .set({ isActive: false })
      .where(eq(offPeakRules.id, ruleId));

    return { ok: true };
  });

  // GET /off-peak/check?date=YYYY-MM-DD&time=HH:MM — check discount (PUBLIC)
  fastify.get("/off-peak/check", async (request, reply) => {
    const q = request.query as { date?: string; time?: string };

    if (!q.date || !q.time) {
      return reply.code(400).send({ error: "date (YYYY-MM-DD) and time (HH:MM) are required" });
    }

    const dayOfWeek = new Date(q.date + "T12:00:00").getDay();
    const rules = await db.select().from(offPeakRules)
      .where(eq(offPeakRules.isActive, true));

    const matchingRule = rules.find((r) =>
      r.dayOfWeek === dayOfWeek &&
      r.startTime <= q.time! &&
      r.endTime > q.time!
    );

    return {
      offPeak: !!matchingRule,
      discountPercent: matchingRule?.discountPercent ?? 0,
      ruleId: matchingRule?.id ?? null,
    };
  });
};

export default offPeakRoutes;
