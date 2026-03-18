import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { servicePackages, clientPackages, creditTransactions, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { packageSchemas } from "../utils/swagger-schemas.js";

const packagesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /packages — list active packages (public + authenticated)
  fastify.get("/packages", { schema: packageSchemas.list }, async (request, reply) => {
    try {
      const packages = await db
        .select()
        .from(servicePackages)
        .where(eq(servicePackages.isActive, true));
      return packages;
    } catch {
      const { rawSqlite } = await import("../db/index.js");
      try {
        return rawSqlite.prepare("SELECT * FROM service_packages WHERE is_active = 1").all();
      } catch {
        return [];
      }
    }
  });

  // POST /packages — create package (ADMIN only)
  fastify.post("/packages", { schema: packageSchemas.create }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as {
      name: string;
      description?: string;
      serviceId?: number;
      sessionsCount: number;
      price: number;
    };

    if (!body.name || !body.sessionsCount || body.price == null) {
      return reply.code(400).send({ error: "name, sessionsCount, price are required" });
    }

    const pkg = await db
      .insert(servicePackages)
      .values({
        name: body.name,
        description: body.description,
        serviceId: body.serviceId,
        sessionsCount: body.sessionsCount,
        price: body.price,
        isActive: true,
      })
      .returning()
      .get();

    return reply.code(201).send(pkg);
  });

  // PATCH /packages/:id — update package (ADMIN only)
  fastify.patch("/packages/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      description: string;
      serviceId: number;
      sessionsCount: number;
      price: number;
      isActive: boolean;
    }>;

    const existing = await db
      .select()
      .from(servicePackages)
      .where(eq(servicePackages.id, parseInt(id)))
      .get();

    if (!existing) return reply.code(404).send({ error: "Package not found" });

    const updated = await db
      .update(servicePackages)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(servicePackages.id, parseInt(id)))
      .returning()
      .get();

    return updated;
  });

  // DELETE /packages/:id — deactivate package (ADMIN only)
  fastify.delete("/packages/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const { id } = request.params as { id: string };

    const existing = await db
      .select()
      .from(servicePackages)
      .where(eq(servicePackages.id, parseInt(id)))
      .get();

    if (!existing) return reply.code(404).send({ error: "Package not found" });

    await db
      .update(servicePackages)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(servicePackages.id, parseInt(id)));

    return { message: "Balíček deaktivován" };
  });

  // POST /packages/:id/purchase — client buys a package
  fastify.post("/packages/:id/purchase", { schema: packageSchemas.purchase }, async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const { id } = request.params as { id: string };

    const pkg = await db
      .select()
      .from(servicePackages)
      .where(and(eq(servicePackages.id, parseInt(id)), eq(servicePackages.isActive, true)))
      .get();

    if (!pkg) return reply.code(404).send({ error: "Package not found" });

    // Create client_packages record
    const cp = await db
      .insert(clientPackages)
      .values({
        clientId: userId,
        packageId: pkg.id,
        sessionsTotal: pkg.sessionsCount,
        sessionsUsed: 0,
        isActive: true,
      })
      .returning()
      .get();

    // Get current credit balance
    const { rawSqlite } = await import("../db/index.js");
    let currentBalance = 0;
    try {
      const row = rawSqlite.prepare(
        "SELECT balance FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1"
      ).get(userId) as { balance: number } | undefined;
      currentBalance = row?.balance ?? 0;
    } catch { /* ignore */ }

    // Add credit transaction (credit sessions as balance)
    try {
      await db.insert(creditTransactions).values({
        userId,
        type: "PURCHASE",
        amount: pkg.sessionsCount,
        balance: currentBalance + pkg.sessionsCount,
        note: `Koupě balíčku: ${pkg.name} (${pkg.sessionsCount} sezení)`,
      });
    } catch { /* ignore if credit_transactions not available */ }

    return reply.code(201).send({ clientPackage: cp, message: "Balíček zakoupen" });
  });

  // GET /clients/:id/packages — packages for a client
  fastify.get("/clients/:id/packages", async (request, reply) => {
    const { id: userId, role } = request.auth!;
    const { id } = request.params as { id: string };
    const targetId = parseInt(id);

    // Only ADMIN/RECEPTION/EMPLOYEE or the client themselves
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role) && userId !== targetId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { rawSqlite } = await import("../db/index.js");
    try {
      const rows = rawSqlite.prepare(`
        SELECT cp.id, cp.sessions_total, cp.sessions_used, cp.purchased_at, cp.expires_at, cp.is_active,
               sp.name as package_name, sp.description, sp.price,
               (cp.sessions_total - cp.sessions_used) as sessions_remaining
        FROM client_packages cp
        JOIN service_packages sp ON sp.id = cp.package_id
        WHERE cp.client_id = ?
        ORDER BY cp.purchased_at DESC
      `).all(targetId);
      return rows;
    } catch {
      return [];
    }
  });
};

export default packagesRoutes;
