import type { FastifyPluginAsync } from "fastify";
import {
  SlotRecoveryProfileSchema,
  SlotRecoveryResponseSchema,
} from "@pristav/shared";
import {
  ensureSlotRecoverySchema,
  getClientRecoveryHistory,
  getClientRecoveryProfile,
  getSlotRecoveryAdminSettings,
  listRecoveryEvents,
  listRecoveryDeliveryLogs,
  listRecoveryOffers,
  respondToRecoveryOffer,
  runSlotRecoveryEngine,
  updateSlotRecoveryAdminSettings,
  updateClientRecoveryProfile,
} from "../services/slot-recovery.js";

const slotRecoveryRoutes: FastifyPluginAsync = async (fastify) => {
  ensureSlotRecoverySchema();

  // Client profile
  fastify.get("/slot-recovery/me/profile", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") return reply.code(403).send({ error: "Forbidden" });
    return getClientRecoveryProfile(id);
  });

  fastify.put("/slot-recovery/me/profile", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") return reply.code(403).send({ error: "Forbidden" });

    const parsed = SlotRecoveryProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    updateClientRecoveryProfile(id, parsed.data);
    return getClientRecoveryProfile(id);
  });

  fastify.get("/slot-recovery/me/history", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") return reply.code(403).send({ error: "Forbidden" });
    return getClientRecoveryHistory(id);
  });

  fastify.post("/slot-recovery/respond", async (request, reply) => {
    const { id, role } = request.auth!;
    if (role !== "CLIENT") return reply.code(403).send({ error: "Forbidden" });

    const parsed = SlotRecoveryResponseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      return respondToRecoveryOffer(id, parsed.data.offerId, parsed.data.action);
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Response failed" });
    }
  });

  // Admin controls/monitoring
  fastify.get("/slot-recovery/admin/events", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    return listRecoveryEvents(200);
  });

  fastify.get("/slot-recovery/admin/offers", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    return listRecoveryOffers(400);
  });

  fastify.get("/slot-recovery/admin/delivery-logs", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    return listRecoveryDeliveryLogs(1000);
  });

  fastify.get("/slot-recovery/admin/settings", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    return getSlotRecoveryAdminSettings();
  });

  fastify.put("/slot-recovery/admin/settings", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    return updateSlotRecoveryAdminSettings({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      mode: body.mode === "full-auto" || body.mode === "dry-run" ? body.mode : undefined,
      pushOnly: typeof body.pushOnly === "boolean" ? body.pushOnly : undefined,
      batchSize: typeof body.batchSize === "number" ? body.batchSize : undefined,
      offerExpirationMin: typeof body.offerExpirationMin === "number" ? body.offerExpirationMin : undefined,
      discountHours: typeof body.discountHours === "number" ? body.discountHours : undefined,
      maxOffersPerEvent: typeof body.maxOffersPerEvent === "number" ? body.maxOffersPerEvent : undefined,
      maxOffersPerClientDay: typeof body.maxOffersPerClientDay === "number" ? body.maxOffersPerClientDay : undefined,
      clientCooldownHours: typeof body.clientCooldownHours === "number" ? body.clientCooldownHours : undefined,
      defaultDiscountPercent: typeof body.defaultDiscountPercent === "number" ? body.defaultDiscountPercent : undefined,
      maxDiscountPercent: typeof body.maxDiscountPercent === "number" ? body.maxDiscountPercent : undefined,
    });
  });

  fastify.post("/slot-recovery/admin/run", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const logShim = {
      info: (m: string, d?: unknown) => fastify.log.info({ data: d }, m),
      error: (m: string, e?: unknown) => fastify.log.error({ err: e }, m),
    };
    return runSlotRecoveryEngine(logShim);
  });
};

export default slotRecoveryRoutes;
