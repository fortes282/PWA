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
  // Klientské rušení termínů (zobrazí se v portálu — tlačítko Zrušit podle pravidel)
  "clientSelfCancelAllowed",
  "clientSelfCancelMinHours",
  "clientSelfCancelLateReasonHours",
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
  /**
   * POST /system-settings/email/test — send test email (ADMIN only)
   * Body: { to: string }
   */
  fastify.post<{ Body: { to: string } }>("/system-settings/email/test", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const { to } = request.body as { to: string };
    if (!to || !to.includes("@")) {
      return reply.code(400).send({ error: "Neplatná e-mailová adresa" });
    }

    const { sendEmail } = await import("../services/email.js");
    const sent = await sendEmail({
      to,
      subject: "Test e-mailu — Přístav Radosti",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
          <h2 style="color:#3b82f6">✓ Testovací e-mail</h2>
          <p>Tento e-mail byl odeslán z administrace systému Přístav Radosti.</p>
          <p>Pokud jste jej obdrželi, SMTP konfigurace funguje správně.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px">Přístav Radosti · ${new Date().toLocaleString("cs-CZ")}</p>
        </div>
      `,
      text: `Testovací e-mail z Přístav Radosti. SMTP konfigurace funguje správně. Odesláno: ${new Date().toLocaleString("cs-CZ")}`,
    });

    if (!sent) {
      return reply.code(503).send({
        error: "E-mail se nepodařilo odeslat. Zkontrolujte SMTP konfiguraci (SMTP_HOST, SMTP_USER, SMTP_PASS).",
        configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      });
    }

    return { ok: true, to, message: "Testovací e-mail byl odeslán." };
  });

  /**
   * GET /system-settings/smtp/status — check if SMTP is configured (ADMIN only)
   */
  fastify.get("/system-settings/smtp/status", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    return {
      configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? "587",
      from: process.env.SMTP_FROM ?? null,
    };
  });
};

export default systemSettingsRoutes;
