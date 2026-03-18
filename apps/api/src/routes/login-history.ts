import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { loginHistory, users } from "../db/schema.js";
import { eq, desc, and, sql } from "drizzle-orm";

const loginHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /login-history — own login history (any authenticated user)
  fastify.get("/login-history", {
    schema: {
      tags: ["Auth"],
      summary: "Get own login history",
      querystring: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { role, id: userId } = request.auth!;
    const q = request.query as { limit?: number };
    const limit = Math.min(q.limit ?? 20, 100);

    const rows = rawSqlite
      .prepare(
        `SELECT id, ip, user_agent, success, created_at FROM login_history
         WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(userId, limit) as Array<{
        id: number;
        ip: string | null;
        user_agent: string | null;
        success: number;
        created_at: string;
      }>;

    return rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      userAgent: r.user_agent,
      success: !!r.success,
      createdAt: r.created_at,
    }));
  });

  // GET /admin/login-history — all login history (ADMIN only)
  fastify.get("/admin/login-history", {
    schema: {
      tags: ["System"],
      summary: "Get all login history (admin)",
      querystring: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 500, default: 50 },
          userId: { type: "integer" },
          success: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const q = request.query as { limit?: number; userId?: number; success?: boolean };
    const limit = Math.min(q.limit ?? 50, 500);

    let sql = `SELECT lh.id, lh.user_id, u.name as user_name, u.email as user_email, u.role as user_role,
               lh.ip, lh.user_agent, lh.success, lh.created_at
               FROM login_history lh LEFT JOIN users u ON lh.user_id = u.id`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (q.userId != null) {
      conditions.push("lh.user_id = ?");
      params.push(q.userId);
    }
    if (q.success != null) {
      conditions.push("lh.success = ?");
      params.push(q.success ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY lh.created_at DESC LIMIT ?";
    params.push(limit);

    const rows = rawSqlite.prepare(sql).all(...params) as Array<{
      id: number;
      user_id: number;
      user_name: string | null;
      user_email: string | null;
      user_role: string | null;
      ip: string | null;
      user_agent: string | null;
      success: number;
      created_at: string;
    }>;

    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userEmail: r.user_email,
        userRole: r.user_role,
        ip: r.ip,
        userAgent: r.user_agent,
        success: !!r.success,
        createdAt: r.created_at,
      })),
      total: rows.length,
    };
  });

  // GET /admin/active-sessions — list active refresh tokens (ADMIN only)
  fastify.get("/admin/active-sessions", {
    schema: {
      tags: ["System"],
      summary: "List active user sessions (admin)",
    },
  }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const rows = rawSqlite
      .prepare(
        `SELECT rt.id, rt.user_id, u.name, u.email, u.role, rt.created_at, rt.expires_at
         FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
         WHERE rt.expires_at > datetime('now')
         ORDER BY rt.created_at DESC`
      )
      .all() as Array<{
        id: number;
        user_id: number;
        name: string;
        email: string;
        role: string;
        created_at: string;
        expires_at: string;
      }>;

    return rows.map((r) => ({
      sessionId: r.id,
      userId: r.user_id,
      userName: r.name,
      userEmail: r.email,
      userRole: r.role,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }));
  });

  // DELETE /admin/active-sessions/:id — revoke a session (ADMIN only)
  fastify.delete("/admin/active-sessions/:id", {
    schema: {
      tags: ["System"],
      summary: "Revoke a user session (admin)",
    },
  }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const { id } = request.params as { id: string };
    const result = rawSqlite.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(Number(id));

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return { success: true, message: "Session revoked" };
  });

  // DELETE /admin/active-sessions/user/:userId — revoke all sessions for a user (ADMIN only)
  fastify.delete("/admin/active-sessions/user/:userId", {
    schema: {
      tags: ["System"],
      summary: "Revoke all sessions for a user (admin)",
    },
  }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const { userId } = request.params as { userId: string };
    const result = rawSqlite.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(Number(userId));

    return { success: true, revoked: result.changes };
  });
};

export default loginHistoryRoutes;
