/**
 * GDPR compliance routes
 * POST /gdpr/consent           — grant/revoke health data consent (any authenticated user for self)
 * GET  /gdpr/consent/:userId   — get consent status (self or ADMIN)
 * GET  /gdpr/access-log/:clientId — ADMIN: get health record access log
 * POST /gdpr/erasure           — ADMIN: anonymize/delete client data
 * GET  /gdpr/erasure-requests  — ADMIN: list erasure requests
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { logAudit } from "./audit.js";

const gdprRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /gdpr/consent — grant or revoke health data consent
  fastify.post<{ Body: { granted: boolean; consentType?: string } }>(
    "/gdpr/consent",
    async (request, reply) => {
      const { id: userId } = request.auth!;
      const { granted, consentType = "health_data" } = request.body;

      const now = new Date().toISOString();
      const existing = rawSqlite.prepare(
        `SELECT id FROM gdpr_consents WHERE user_id = ? AND consent_type = ?`
      ).get(userId, consentType) as any;

      if (existing) {
        rawSqlite.prepare(`
          UPDATE gdpr_consents SET
            granted = ?,
            granted_at = CASE WHEN ? = 1 THEN ? ELSE granted_at END,
            revoked_at = CASE WHEN ? = 0 THEN ? ELSE NULL END,
            updated_at = ?
          WHERE user_id = ? AND consent_type = ?
        `).run(
          granted ? 1 : 0,
          granted ? 1 : 0, now,
          granted ? 0 : 1, now,
          now,
          userId, consentType
        );
      } else {
        rawSqlite.prepare(`
          INSERT INTO gdpr_consents (user_id, consent_type, granted, granted_at, revoked_at, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId, consentType, granted ? 1 : 0,
          granted ? now : null,
          !granted ? now : null,
          request.ip,
          request.headers["user-agent"] ?? ""
        );
      }

      // Also update the shortcut column in users
      rawSqlite.prepare(`
        UPDATE users SET gdpr_health_consent_granted = ?, gdpr_health_consent_at = ?, updated_at = ?
        WHERE id = ?
      `).run(granted ? 1 : 0, granted ? now : null, now, userId);

      return { ok: true, granted, consentType, at: now };
    }
  );

  // GET /gdpr/consent/:userId
  fastify.get<{ Params: { userId: string } }>(
    "/gdpr/consent/:userId",
    async (request, reply) => {
      const { id: reqUserId, role } = request.auth!;
      const targetId = parseInt(request.params.userId);

      if (role !== "ADMIN" && reqUserId !== targetId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const consents = rawSqlite.prepare(
        `SELECT consent_type, granted, granted_at, revoked_at, updated_at FROM gdpr_consents WHERE user_id = ?`
      ).all(targetId) as any[];

      return { userId: targetId, consents };
    }
  );

  // GET /gdpr/access-log/:clientId — ADMIN only
  fastify.get<{ Params: { clientId: string }; Querystring: { limit?: string } }>(
    "/gdpr/access-log/:clientId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["ADMIN", "EMPLOYEE"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const clientId = parseInt(request.params.clientId);
      const limit = Math.min(parseInt(request.query.limit ?? "100"), 500);

      const logs = rawSqlite.prepare(`
        SELECT l.*, u.name as accessor_name, u.role as accessor_role
        FROM health_record_access_log l
        LEFT JOIN users u ON u.id = l.accessor_id
        WHERE l.client_id = ?
        ORDER BY l.created_at DESC
        LIMIT ?
      `).all(clientId, limit) as any[];

      return { clientId, logs };
    }
  );

  // POST /gdpr/erasure — ADMIN: anonymize client data
  fastify.post<{ Body: { clientId: number; notes?: string } }>(
    "/gdpr/erasure",
    async (request, reply) => {
      const { id: adminId, role } = request.auth!;
      if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

      const { clientId, notes } = request.body;
      const now = new Date().toISOString();

      // Log the erasure request
      const result = rawSqlite.prepare(`
        INSERT INTO gdpr_erasure_requests (client_id, requested_by, status, notes)
        VALUES (?, ?, 'PENDING', ?)
      `).run(clientId, adminId, notes ?? null);

      // Anonymize user data
      const anon = `anon_${clientId}_${Date.now()}`;
      rawSqlite.prepare(`
        UPDATE users SET
          name = 'Anonymní uživatel',
          email = ? || '@anonymized.local',
          phone = NULL,
          avatar_url = NULL,
          push_subscription = NULL,
          totp_secret = NULL,
          totp_backup_codes = NULL,
          gdpr_anonymized_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(anon, now, now, clientId);

      // Delete health records
      rawSqlite.prepare(`DELETE FROM health_records WHERE client_id = ?`).run(clientId);
      rawSqlite.prepare(`DELETE FROM medical_reports WHERE client_id = ?`).run(clientId);

      // Mark erasure as complete
      rawSqlite.prepare(`
        UPDATE gdpr_erasure_requests SET status = 'COMPLETED', completed_at = ?, completed_by = ?
        WHERE id = ?
      `).run(now, adminId, result.lastInsertRowid);

      // Audit log
      await logAudit(fastify, {
        userId: adminId,
        action: "GDPR_ERASURE",
        targetId: clientId,
        targetType: "user",
        details: JSON.stringify({ notes, requestId: result.lastInsertRowid }),
        ip: request.ip,
      });

      return { ok: true, clientId, completedAt: now };
    }
  );

  // GET /gdpr/erasure-requests — ADMIN only
  fastify.get(
    "/gdpr/erasure-requests",
    async (request, reply) => {
      const { role } = request.auth!;
      if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

      const requests = rawSqlite.prepare(`
        SELECT r.*, u.name as client_name, a.name as admin_name
        FROM gdpr_erasure_requests r
        LEFT JOIN users u ON u.id = r.client_id
        LEFT JOIN users a ON a.id = r.requested_by
        ORDER BY r.created_at DESC
        LIMIT 100
      `).all() as any[];

      return { requests };
    }
  );
};

export default gdprRoutes;
