/**
 * GET  /system-settings          — Admin: get all settings as key-value object
 * PUT  /system-settings          — Admin: upsert settings object
 * GET  /system-settings/public   — Any authenticated user: public settings only
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { systemSettings } from "../db/schema.js";
import { eq } from "drizzle-orm";

// Keys that are readable by non-admin roles
const PUBLIC_KEYS = new Set([
  "timezone",
  "currency",
  "language",
  "invoicePrefix",
  "invoiceFooter",
  "dueDays",
]);

const systemSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /system-settings/public — any authenticated user
  fastify.get("/system-settings/public", async (request) => {
    const rows = await db.select().from(systemSettings);
    const result: Record<string, string> = {};
    rows.forEach((r) => {
      if (PUBLIC_KEYS.has(r.key)) {
        result[r.key] = r.value;
      }
    });
    return result;
  });

  // GET /system-settings — admin only
  fastify.get("/system-settings", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const rows = await db.select().from(systemSettings);
    const result: Record<string, string> = {};
    rows.forEach((r) => {
      result[r.key] = r.value;
    });
    return result;
  });

  // PUT /system-settings — admin only, upsert all keys in body
  fastify.put("/system-settings", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as Record<string, unknown>;
    if (typeof body !== "object" || body === null) {
      return reply.code(400).send({ error: "Body must be an object" });
    }

    const now = new Date().toISOString();
    const entries = Object.entries(body).filter(
      ([_, v]) => typeof v === "string" || typeof v === "boolean" || typeof v === "number"
    );

    for (const [key, value] of entries) {
      const strValue = String(value);
      const existing = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({ value: strValue, updatedAt: now })
          .where(eq(systemSettings.key, key));
      } else {
        await db.insert(systemSettings).values({ key, value: strValue, updatedAt: now });
      }
    }

    // Return updated settings
    const rows = await db.select().from(systemSettings);
    const result: Record<string, string> = {};
    rows.forEach((r) => {
      result[r.key] = r.value;
    });
    return result;
  });
};

export default systemSettingsRoutes;
