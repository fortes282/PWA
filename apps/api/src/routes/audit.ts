import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { auditLog } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type { DB } from "../db/index.js";
import { auditSchemas } from "../utils/swagger-schemas.js";

export function logAudit(
  dbInstance: DB,
  userId: number | null,
  action: string,
  opts?: { targetId?: number; targetType?: string; details?: string; ip?: string }
) {
  try {
    return dbInstance.insert(auditLog).values({
      userId: userId ?? undefined,
      action,
      targetId: opts?.targetId,
      targetType: opts?.targetType,
      details: opts?.details,
      ip: opts?.ip,
    }).run();
  } catch {
    // Silently ignore errors (e.g. table not yet created in test env)
  }
}

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /audit?page=1&limit=20&userId=&action=&from=&to= — ADMIN only
  fastify.get("/audit", { schema: auditSchemas.list }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const query = request.query as {
      page?: string;
      limit?: string;
      userId?: string;
      action?: string;
      from?: string;
      to?: string;
    };

    const page = Math.max(1, parseInt(query.page ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20")));

    let rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt));

    if (query.userId) {
      const uid = parseInt(query.userId);
      rows = rows.filter((r) => r.userId === uid);
    }
    if (query.action) {
      rows = rows.filter((r) => r.action === query.action);
    }
    if (query.from) {
      const from = new Date(query.from);
      rows = rows.filter((r) => r.createdAt && r.createdAt >= from);
    }
    if (query.to) {
      const to = new Date(query.to);
      rows = rows.filter((r) => r.createdAt && r.createdAt <= to);
    }

    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit);

    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  });

  // GET /audit/me?page=1&limit=20 — own records (CLIENT+)
  fastify.get("/audit/me", { schema: auditSchemas.me }, async (request) => {
    const { id: userId } = request.auth!;
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, parseInt(query.page ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20")));

    const rows = await db.select().from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt));

    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit);

    return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  });
};

export default auditRoutes;
