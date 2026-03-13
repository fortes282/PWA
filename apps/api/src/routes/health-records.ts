import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { healthRecords, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const healthRecordsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /health-records/:clientId — get health record for a specific client
  fastify.get<{ Params: { clientId: string } }>(
    "/health-records/:clientId",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      const clientId = parseInt(request.params.clientId);

      // CLIENT can only see their own record
      if (role === "CLIENT" && clientId !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      if (!["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const [record] = await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.clientId, clientId))
        .limit(1);

      if (!record) {
        // Return empty record shape so frontend can tell it doesn't exist yet
        return reply.code(404).send({ error: "Not found" });
      }
      return record;
    }
  );

  // PUT /health-records/:clientId — create or update health record (upsert)
  fastify.put<{ Params: { clientId: string } }>(
    "/health-records/:clientId",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;

      // Only RECEPTION, EMPLOYEE, ADMIN can write
      if (!["RECEPTION", "EMPLOYEE", "ADMIN"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const clientId = parseInt(request.params.clientId);
      const body = request.body as {
        bloodType?: string;
        allergies?: string;
        contraindications?: string;
        medications?: string;
        chronicConditions?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
        emergencyContactRelation?: string;
        primaryDiagnosis?: string;
        functionalStatus?: string;
        rehabGoals?: string;
        notes?: string;
      };

      const [existing] = await db
        .select({ id: healthRecords.id })
        .from(healthRecords)
        .where(eq(healthRecords.clientId, clientId))
        .limit(1);

      const now = new Date().toISOString();

      if (existing) {
        const [updated] = await db
          .update(healthRecords)
          .set({
            bloodType: body.bloodType ?? null,
            allergies: body.allergies ?? null,
            contraindications: body.contraindications ?? null,
            medications: body.medications ?? null,
            chronicConditions: body.chronicConditions ?? null,
            emergencyContactName: body.emergencyContactName ?? null,
            emergencyContactPhone: body.emergencyContactPhone ?? null,
            emergencyContactRelation: body.emergencyContactRelation ?? null,
            primaryDiagnosis: body.primaryDiagnosis ?? null,
            functionalStatus: body.functionalStatus ?? null,
            rehabGoals: body.rehabGoals ?? null,
            notes: body.notes ?? null,
            lastUpdatedBy: userId,
            updatedAt: now,
          })
          .where(eq(healthRecords.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(healthRecords)
          .values({
            clientId,
            bloodType: body.bloodType ?? null,
            allergies: body.allergies ?? null,
            contraindications: body.contraindications ?? null,
            medications: body.medications ?? null,
            chronicConditions: body.chronicConditions ?? null,
            emergencyContactName: body.emergencyContactName ?? null,
            emergencyContactPhone: body.emergencyContactPhone ?? null,
            emergencyContactRelation: body.emergencyContactRelation ?? null,
            primaryDiagnosis: body.primaryDiagnosis ?? null,
            functionalStatus: body.functionalStatus ?? null,
            rehabGoals: body.rehabGoals ?? null,
            notes: body.notes ?? null,
            lastUpdatedBy: userId,
          })
          .returning();
        reply.code(201);
        return created;
      }
    }
  );

  // GET /health-records — list all (RECEPTION/ADMIN only, with client info)
  fastify.get("/health-records", async (request, reply) => {
    const { role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const records = await db
      .select({
        id: healthRecords.id,
        clientId: healthRecords.clientId,
        clientName: users.name,
        clientEmail: users.email,
        primaryDiagnosis: healthRecords.primaryDiagnosis,
        allergies: healthRecords.allergies,
        updatedAt: healthRecords.updatedAt,
      })
      .from(healthRecords)
      .leftJoin(users, eq(healthRecords.clientId, users.id))
      .orderBy(healthRecords.updatedAt);

    return records;
  });
};

export default healthRecordsRoutes;
