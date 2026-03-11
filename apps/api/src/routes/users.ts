import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users, profileLog } from "../db/schema.js";
import { eq, like, and, ne } from "drizzle-orm";
import { UpdateUserSchema } from "@pristav/shared";

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users — Admin/Reception only
  fastify.get("/users", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const query = (request.query as { search?: string; role?: string });
    let allUsers = await db.select().from(users);

    if (query.search) {
      allUsers = allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(query.search!.toLowerCase()) ||
          u.email.toLowerCase().includes(query.search!.toLowerCase())
      );
    }
    if (query.role) {
      allUsers = allUsers.filter((u) => u.role === query.role);
    }

    return allUsers.map(({ passwordHash, pushSubscription, ...u }) => u);
  });

  // GET /users/:id
  fastify.get<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    // Clients can only view themselves
    if (role === "CLIENT" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!user) return reply.code(404).send({ error: "User not found" });

    const { passwordHash, pushSubscription, ...safe } = user;
    return safe;
  });

  // PATCH /users/:id
  fastify.patch<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    if (role === "CLIENT" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const result = UpdateUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.flatten() });
    }

    // Log changes
    const [current] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!current) return reply.code(404).send({ error: "User not found" });

    const changes = result.data;
    const logEntries = Object.entries(changes)
      .filter(([key, val]) => current[key as keyof typeof current] !== val)
      .map(([field, newValue]) => ({
        userId: targetId,
        changedBy: id,
        field,
        oldValue: String(current[field as keyof typeof current] ?? ""),
        newValue: String(newValue),
      }));

    if (logEntries.length > 0) {
      await db.insert(profileLog).values(logEntries);
    }

    const updated = await db
      .update(users)
      .set({ ...changes, updatedAt: new Date().toISOString() })
      .where(eq(users.id, targetId))
      .returning();

    const { passwordHash, pushSubscription, ...safe } = updated[0]!;
    return safe;
  });

  // GET /users/:id/profile-log
  fastify.get<{ Params: { id: string } }>("/users/:id/profile-log", async (request, reply) => {
    const targetId = parseInt(request.params.id);
    const { id, role } = request.auth!;

    if (role === "CLIENT" && id !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return db.select().from(profileLog).where(eq(profileLog.userId, targetId));
  });

  // PATCH /users/:id/role — Admin only
  fastify.patch<{ Params: { id: string } }>("/users/:id/role", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const { role } = request.body as { role: string };
    const valid = ["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"];
    if (!valid.includes(role)) {
      return reply.code(400).send({ error: "Invalid role" });
    }

    await db.update(users).set({ role: role as any, updatedAt: new Date().toISOString() })
      .where(eq(users.id, parseInt(request.params.id)));

    return { ok: true };
  });

  // DELETE /users/:id — Admin only (soft delete)
  fastify.delete<{ Params: { id: string } }>("/users/:id", async (request, reply) => {
    if (request.auth!.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    await db.update(users).set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, parseInt(request.params.id)));
    return { ok: true };
  });
};

export default usersRoutes;
