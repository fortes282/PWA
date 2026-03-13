import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { workingHours, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

const workingHoursRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /working-hours?employeeId=X
  fastify.get("/working-hours", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { employeeId?: string };

    // Load employees list for context
    const employees = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "EMPLOYEE" as any));

    if (q.employeeId) {
      const empId = parseInt(q.employeeId);
      const rows = await db
        .select()
        .from(workingHours)
        .where(eq(workingHours.employeeId, empId));
      return rows;
    }

    // Return all grouped by employee
    const all = await db.select().from(workingHours);
    const grouped: Record<number, { employee: { id: number; name: string }; hours: typeof all }> = {};

    for (const emp of employees) {
      grouped[emp.id] = { employee: emp, hours: [] };
    }
    for (const row of all) {
      if (grouped[row.employeeId]) {
        grouped[row.employeeId].hours.push(row);
      }
    }

    return Object.values(grouped);
  });

  // GET /working-hours/employees - list employees with their working hours
  fastify.get("/working-hours/employees", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const employees = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.role, "EMPLOYEE" as any));

    const allHours = await db.select().from(workingHours);

    return employees.map((emp) => ({
      ...emp,
      workingHours: allHours
        .filter((wh) => wh.employeeId === emp.id)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    }));
  });

  // PUT /working-hours/:employeeId - upsert all working hours for employee
  fastify.put<{ Params: { employeeId: string } }>(
    "/working-hours/:employeeId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const empId = parseInt(request.params.employeeId);
      const body = request.body as Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isActive: boolean;
      }>;

      // Delete existing, insert new
      await db.delete(workingHours).where(eq(workingHours.employeeId, empId));

      if (body.length > 0) {
        await db.insert(workingHours).values(
          body.map((row) => ({
            employeeId: empId,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
            isActive: row.isActive,
          }))
        );
      }

      const updated = await db
        .select()
        .from(workingHours)
        .where(eq(workingHours.employeeId, empId));

      return updated;
    }
  );

  // PATCH /working-hours/:id - toggle or update single entry
  fastify.patch<{ Params: { id: string } }>(
    "/working-hours/:id",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "RECEPTION"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const id = parseInt(request.params.id);
      const body = request.body as Partial<{
        startTime: string;
        endTime: string;
        isActive: boolean;
      }>;

      const [updated] = await db
        .update(workingHours)
        .set(body as any)
        .where(eq(workingHours.id, id))
        .returning();

      if (!updated) return reply.code(404).send({ error: "Not found" });
      return updated;
    }
  );
};

export default workingHoursRoutes;
