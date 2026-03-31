import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { widenReply } from "../utils/widen-reply.js";
import { createHash } from "crypto";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";
};

declare module "fastify" {
  interface FastifyContextConfig {
    requiredScopes?: string[];
  }
  interface FastifyRequest {
    auth?: AuthUser;
    authScopes?: string[];
    authViaApiKey?: boolean;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    // Skip auth for not-found handler (404 routes marked config.public = true)
    if ((request as any).routeOptions?.config?.public) return;

    const publicRoutes = [
      { method: "POST", url: "/auth/login" },
      { method: "POST", url: "/auth/refresh" },
      { method: "POST", url: "/auth/logout" },
      { method: "POST", url: "/auth/forgot-password" },
      { method: "POST", url: "/auth/reset-password" },
      { method: "GET", url: "/auth/reset-password/validate" },
      // 2FA step-2 (uses pendingToken, not JWT)
      { method: "POST", url: "/auth/2fa/verify" },
      { method: "POST", url: "/auth/2fa/use-backup" },
      { method: "GET", url: "/health" },
      { method: "GET", url: "/health/ping" },
      { method: "GET", url: "/health/detailed" },
      { method: "GET", url: "/docs" },
      { method: "POST", url: "/booking/public" },
      { method: "GET", url: "/packages" },
      // Video signaling — authenticated via video token (not JWT)
      { method: "POST", url: "/video/signal" },
      { method: "GET", url: "/video/signal" },
      { method: "DELETE", url: "/video/signal" },
      // Public voucher check + off-peak check
      { method: "GET", url: "/vouchers/check" },
      { method: "GET", url: "/off-peak/check" },
    ];

    const requestPath = request.url.split("?")[0] ?? request.url;
    const isPublic = publicRoutes.some((r) => {
      if (r.method !== request.method) return false;
      if (r.url === "/docs") {
        return requestPath === "/docs" || requestPath.startsWith("/docs/");
      }
      return requestPath === r.url;
    });

    if (isPublic) return;

    // Try JWT first
    try {
      const payload = await request.jwtVerify<AuthUser>();
      request.auth = payload;
      return;
    } catch {
      // JWT failed — try API key
    }

    // Try API key auth (X-API-Key header)
    const apiKey = request.headers["x-api-key"] as string | undefined;
    if (apiKey) {
      try {
        const keyHash = createHash("sha256").update(apiKey).digest("hex");
        // Dynamic import to avoid circular deps — rawSqlite is available
        const { rawSqlite } = await import("../db/index.js");
        const row = rawSqlite
          .prepare(
            `SELECT ak.id, ak.scopes, ak.expires_at, ak.created_by, u.id as user_id, u.email, u.name, u.role
             FROM api_keys ak JOIN users u ON ak.created_by = u.id
             WHERE ak.key_hash = ? AND ak.is_active = 1`
          )
          .get(keyHash) as {
            id: number; scopes: string; expires_at: string | null;
            created_by: number; user_id: number; email: string; name: string; role: string;
          } | undefined;

        if (row) {
          // Check expiry
          if (row.expires_at && new Date(row.expires_at) < new Date()) {
            return widenReply(reply).code(401).send({ error: "API key expired" });
          }
          // Update last_used_at
          rawSqlite.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
          // Set auth from the key creator
          request.auth = { id: row.user_id, email: row.email, name: row.name, role: row.role as AuthUser["role"] };
          request.authViaApiKey = true;
          request.authScopes = row.scopes ? JSON.parse(row.scopes) : [];
          return;
        }
      } catch {
        // API key check failed — fall through to 401
      }
    }

    return widenReply(reply).code(401).send({ error: "Unauthorized" });
  });

  // Scope guard for API key authenticated requests.
  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.authViaApiKey) return;
    const requiredScopes = (request.routeOptions?.config as { requiredScopes?: string[] } | undefined)?.requiredScopes;
    if (!requiredScopes || requiredScopes.length === 0) return;

    const keyScopes = request.authScopes ?? [];
    if (keyScopes.includes("*")) return;

    const hasAnyRequiredScope = requiredScopes.some((scope) => keyScopes.includes(scope));
    if (!hasAnyRequiredScope) {
      return widenReply(reply).code(403).send({
        error: "Forbidden",
        message: "API key missing required scope",
        requiredScopes,
      });
    }
  });
};

export default fp(authPlugin);
