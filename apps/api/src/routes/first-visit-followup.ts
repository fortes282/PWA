import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { firstVisitFollowups, appointments, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Creates a follow-up entry when an appointment is COMPLETED
 * and it is the client's FIRST appointment ever.
 * Intended to be called from the scheduler/cron or appointment status change handler.
 */
export async function createFollowupIfFirstVisit(appointmentId: number): Promise<boolean> {
  const [appt] = await db.select().from(appointments)
    .where(eq(appointments.id, appointmentId)).limit(1);

  if (!appt || appt.status !== "COMPLETED") return false;

  // Check if this is the client's first completed appointment
  const completedAppts = (await db.select().from(appointments))
    .filter((a) => a.clientId === appt.clientId && a.status === "COMPLETED");

  if (completedAppts.length !== 1) return false; // not the first

  // Schedule follow-up 3 days after the appointment
  const scheduledAt = new Date(
    new Date(appt.endTime).getTime() + 3 * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.insert(firstVisitFollowups).values({
    appointmentId: appt.id,
    clientId: appt.clientId,
    therapistId: appt.employeeId,
    scheduledAt,
  });

  return true;
}

const firstVisitFollowupRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /followups/pending — list pending follow-ups for the therapist (EMPLOYEE)
  fastify.get("/followups/pending", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const all = await db.select().from(firstVisitFollowups);
    let pending = all.filter((f) => f.status === "PENDING");

    // EMPLOYEE sees only their own follow-ups
    if (role === "EMPLOYEE") {
      pending = pending.filter((f) => f.therapistId === id);
    }

    // Sort by scheduled date ascending (earliest first)
    pending.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    // Enrich with client name
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

    return pending.map((f) => ({
      ...f,
      clientName: userMap[f.clientId] ?? null,
      therapistName: userMap[f.therapistId] ?? null,
    }));
  });

  // PATCH /followups/:id — mark as SENT or SKIPPED (EMPLOYEE)
  fastify.patch<{ Params: { id: string } }>("/followups/:id", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["EMPLOYEE", "ADMIN"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const followupId = parseInt(request.params.id);
    const body = request.body as { status: "SENT" | "SKIPPED" };

    if (!["SENT", "SKIPPED"].includes(body.status)) {
      return reply.code(400).send({ error: "status must be SENT or SKIPPED" });
    }

    const [followup] = await db.select().from(firstVisitFollowups)
      .where(eq(firstVisitFollowups.id, followupId)).limit(1);

    if (!followup) {
      return reply.code(404).send({ error: "Follow-up not found" });
    }

    // EMPLOYEE can only update their own follow-ups
    if (role === "EMPLOYEE" && followup.therapistId !== id) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const sentAt = body.status === "SENT" ? new Date().toISOString() : null;

    await db.update(firstVisitFollowups)
      .set({ status: body.status, sentAt })
      .where(eq(firstVisitFollowups.id, followupId));

    return { ok: true, id: followupId, status: body.status };
  });
};

export default firstVisitFollowupRoutes;
