import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { randomBytes, createHash } from "crypto";
import { logAudit } from "./audit.js";

/**
 * API Key management routes.
 * Keys are stored as SHA-256 hashes — the raw key is shown only once at creation.
 */

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/api-keys — list API keys (ADMIN only)
  fastify.get("/admin/api-keys", {
    schema: { tags: ["System"], summary: "List API keys" },
  }, async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const rows = rawSqlite
      .prepare(
        `SELECT id, name, prefix, scopes, last_used_at, created_at, expires_at, is_active
         FROM api_keys ORDER BY created_at DESC`
      )
      .all() as Array<{
        id: number;
        name: string;
        prefix: string;
        scopes: string;
        last_used_at: string | null;
        created_at: string;
        expires_at: string | null;
        is_active: number;
      }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      scopes: r.scopes ? JSON.parse(r.scopes) : [],
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      isActive: !!r.is_active,
    }));
  });

  // POST /admin/api-keys — create a new API key (ADMIN only)
  fastify.post("/admin/api-keys", {
    schema: {
      tags: ["System"],
      summary: "Create API key",
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          scopes: { type: "array", items: { type: "string" } },
          expiresInDays: { type: "integer", minimum: 1, maximum: 365 },
        },
      },
    },
  }, async (request, reply) => {
    const { role, id: userId } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const { name, scopes, expiresInDays } = request.body as {
      name: string;
      scopes?: string[];
      expiresInDays?: number;
    };

    // Generate key: pr_live_<random32hex>
    const rawKey = `pr_live_${randomBytes(32).toString("hex")}`;
    const prefix = rawKey.slice(0, 12); // pr_live_XXXX for display
    const keyHash = hashApiKey(rawKey);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    rawSqlite
      .prepare(
        `INSERT INTO api_keys (name, key_hash, prefix, scopes, expires_at, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(name, keyHash, prefix, JSON.stringify(scopes ?? []), expiresAt, userId);

    const inserted = rawSqlite.prepare("SELECT last_insert_rowid() as id").get() as { id: number };

    logAudit(null as any, userId, "API_KEY_CREATED", { details: JSON.stringify({ name, keyId: inserted.id }) });

    return {
      id: inserted.id,
      name,
      key: rawKey, // Only shown once!
      prefix,
      scopes: scopes ?? [],
      expiresAt,
      warning: "Uložte si klíč — nebude znovu zobrazen!",
    };
  });

  // DELETE /admin/api-keys/:id — revoke an API key (ADMIN only)
  fastify.delete("/admin/api-keys/:id", {
    schema: { tags: ["System"], summary: "Revoke API key" },
  }, async (request, reply) => {
    const { role, id: userId } = request.auth!;
    if (role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden", message: "Admin only", statusCode: 403 });
    }

    const { id } = request.params as { id: string };
    const result = rawSqlite.prepare("UPDATE api_keys SET is_active = 0 WHERE id = ?").run(Number(id));

    if (result.changes === 0) {
      return reply.code(404).send({ error: "API key not found" });
    }

    logAudit(null as any, userId, "API_KEY_REVOKED", { details: JSON.stringify({ keyId: Number(id) }) });

    return { success: true, message: "API key revoked" };
  });
};

export default apiKeysRoutes;
