/**
 * Video / Telehealth routes
 *
 * POST /video/token/:appointmentId      — issue one-time token for video room
 * POST /video/signal/:appointmentId     — push a WebRTC signal message
 * GET  /video/signal/:appointmentId     — poll for signal messages (for this user)
 * DELETE /video/signal/:appointmentId   — leave room, clear messages
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

// ─── In-memory token store ────────────────────────────────────────────────────
interface VideoToken {
  appointmentId: number;
  userId: number;
  expiresAt: number;
}
const videoTokens = new Map<string, VideoToken>();

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [k, v] of videoTokens) {
    if (v.expiresAt < now) videoTokens.delete(k);
  }
}

// ─── In-memory signaling queue ────────────────────────────────────────────────
interface SignalMsg {
  id: string;
  fromUserId: number;
  toUserId?: number; // undefined = broadcast
  type: string;
  payload: unknown;
  ts: number;
}

// appointmentId → messages
const signalQueues = new Map<number, SignalMsg[]>();

function pushSignal(appointmentId: number, msg: SignalMsg) {
  if (!signalQueues.has(appointmentId)) signalQueues.set(appointmentId, []);
  const q = signalQueues.get(appointmentId)!;
  q.push(msg);
  // Keep only last 200 messages per room
  if (q.length > 200) q.splice(0, q.length - 200);
}

function pollSignals(appointmentId: number, forUserId: number, since: number): SignalMsg[] {
  const q = signalQueues.get(appointmentId) ?? [];
  return q.filter(
    (m) =>
      m.ts > since &&
      m.fromUserId !== forUserId &&
      (m.toUserId === undefined || m.toUserId === forUserId)
  );
}

// Periodic cleanup of old signal queues (>2h old)
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, msgs] of signalQueues) {
    const fresh = msgs.filter((m) => m.ts > cutoff);
    if (fresh.length === 0) signalQueues.delete(k);
    else signalQueues.set(k, fresh);
  }
}, 5 * 60 * 1000);

// ─── Helper: verify token from Authorization header or query ─────────────────
function resolveToken(request: any): VideoToken | null {
  // Try Authorization: Bearer <token>
  const auth = request.headers?.authorization as string | undefined;
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    const entry = videoTokens.get(t);
    if (entry && entry.expiresAt > Date.now()) return entry;
  }
  // Try query param ?token=...
  const qt = (request.query as any)?.token as string | undefined;
  if (qt) {
    const entry = videoTokens.get(qt);
    if (entry && entry.expiresAt > Date.now()) return entry;
  }
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────
const videoRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /video/token/:appointmentId
   * Authenticated with normal JWT. Returns a short-lived video token.
   */
  fastify.post<{ Params: { appointmentId: string } }>(
    "/video/token/:appointmentId",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      const appointmentId = parseInt(request.params.appointmentId);
      if (Number.isNaN(appointmentId)) return reply.code(400).send({ error: "Invalid id" });

      const [appt] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (!appt) return reply.code(404).send({ error: "Appointment not found" });

      // Check access: client or employee of the appointment, or ADMIN/RECEPTION
      const isClient = role === "CLIENT" && appt.clientId === userId;
      const isEmployee = (role === "EMPLOYEE") && appt.employeeId === userId;
      const isStaff = role === "ADMIN" || role === "RECEPTION";

      if (!isClient && !isEmployee && !isStaff) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      // Must be an online appointment
      if (!(appt as any).isOnline) {
        return reply.code(400).send({ error: "Not an online appointment" });
      }

      cleanExpiredTokens();

      const token = randomBytes(32).toString("hex");
      videoTokens.set(token, {
        appointmentId,
        userId,
        expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
      });

      return { token, appointmentId, userId };
    }
  );

  /**
   * POST /video/signal/:appointmentId
   * Push a WebRTC signaling message. Authenticated with video token.
   * Body: { type: "offer"|"answer"|"ice-candidate"|"chat"|"recording-consent", payload, toUserId? }
   */
  fastify.post<{ Params: { appointmentId: string } }>(
    "/video/signal/:appointmentId",
    async (request, reply) => {
      const entry = resolveToken(request);
      if (!entry) return reply.code(401).send({ error: "Invalid video token" });

      const appointmentId = parseInt(request.params.appointmentId);
      if (entry.appointmentId !== appointmentId) return reply.code(403).send({ error: "Token mismatch" });

      const body = request.body as any;
      if (!body?.type) return reply.code(400).send({ error: "type required" });

      const msg: SignalMsg = {
        id: randomBytes(8).toString("hex"),
        fromUserId: entry.userId,
        toUserId: body.toUserId != null ? parseInt(body.toUserId) : undefined,
        type: body.type,
        payload: body.payload ?? null,
        ts: Date.now(),
      };

      pushSignal(appointmentId, msg);
      return { ok: true, id: msg.id };
    }
  );

  /**
   * GET /video/signal/:appointmentId?since=<ms>&token=<videoToken>
   * Poll for messages since timestamp (ms). Returns messages not from self.
   */
  fastify.get<{ Params: { appointmentId: string } }>(
    "/video/signal/:appointmentId",
    async (request, reply) => {
      const entry = resolveToken(request);
      if (!entry) return reply.code(401).send({ error: "Invalid video token" });

      const appointmentId = parseInt(request.params.appointmentId);
      if (entry.appointmentId !== appointmentId) return reply.code(403).send({ error: "Token mismatch" });

      const since = parseInt((request.query as any).since ?? "0") || 0;
      const msgs = pollSignals(appointmentId, entry.userId, since);

      return {
        messages: msgs,
        serverTime: Date.now(),
      };
    }
  );

  /**
   * DELETE /video/signal/:appointmentId
   * Leave room (optional cleanup).
   */
  fastify.delete<{ Params: { appointmentId: string } }>(
    "/video/signal/:appointmentId",
    async (request, reply) => {
      const entry = resolveToken(request);
      if (!entry) return reply.code(401).send({ error: "Invalid video token" });

      const appointmentId = parseInt(request.params.appointmentId);
      if (entry.appointmentId !== appointmentId) return reply.code(403).send({ error: "Token mismatch" });

      // Send "peer-left" signal
      pushSignal(appointmentId, {
        id: randomBytes(8).toString("hex"),
        fromUserId: entry.userId,
        type: "peer-left",
        payload: { userId: entry.userId },
        ts: Date.now(),
      });

      return { ok: true };
    }
  );
};

export default videoRoutes;
