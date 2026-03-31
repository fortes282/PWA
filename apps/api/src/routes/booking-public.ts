import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { pendingBookings, notifications, users } from "../db/schema.js";
import { inArray } from "drizzle-orm";
import { bookingPublicSchemas } from "../utils/swagger-schemas.js";

const bookingPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /booking/public — anonymous user submits a booking request
  fastify.post("/booking/public", {
    schema: bookingPublicSchemas.create,
    config: {
      rateLimit: {
        max: process.env.CI === "true" ? 1_000_000 : Number.parseInt(process.env.PUBLIC_BOOKING_RATE_LIMIT_MAX || "8", 10),
        timeWindow: process.env.PUBLIC_BOOKING_RATE_LIMIT_WINDOW || "10 minutes",
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      serviceId?: number;
      slotDate: string;
      slotTime: string;
      name: string;
      email: string;
      phone?: string;
      note?: string;
      website?: string;
      formStartedAt?: number;
    };

    if (!body.slotDate || !body.slotTime || !body.name || !body.email) {
      return reply.code(400).send({ error: "slotDate, slotTime, name, email are required" });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return reply.code(400).send({ error: "Invalid email format" });
    }

    // Honeypot (bots usually fill hidden fields)
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return reply.code(400).send({ error: "Invalid request" });
    }

    // Very fast submissions are suspicious
    if (typeof body.formStartedAt === "number") {
      const formAgeMs = Date.now() - body.formStartedAt;
      if (formAgeMs >= 0 && formAgeMs < 1200) {
        return reply.code(429).send({ error: "Příliš rychlé odeslání formuláře" });
      }
    }

    const booking = await db
      .insert(pendingBookings)
      .values({
        serviceId: body.serviceId,
        slotDate: body.slotDate,
        slotTime: body.slotTime,
        name: body.name,
        email: body.email,
        phone: body.phone,
        note: body.note,
        status: "PENDING",
      })
      .returning()
      .get();

    // Send in-app notification to all ADMIN + RECEPTION users
    try {
      const adminReceptionUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role, ["ADMIN", "RECEPTION"]));

      for (const u of adminReceptionUsers) {
        await db.insert(notifications).values({
          userId: u.id,
          type: "GENERAL",
          title: "Nová online rezervace",
          message: `${body.name} (${body.email}) žádá o termín ${body.slotDate} ${body.slotTime}.`,
        });
      }
    } catch { /* ignore notification errors */ }

    return reply.code(201).send({ id: booking.id, message: "Rezervace přijata" });
  });

  // GET /booking/public/pending — ADMIN/RECEPTION see pending bookings
  fastify.get("/booking/public/pending", { schema: bookingPublicSchemas.pending }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { rawSqlite } = await import("../db/index.js");
    try {
      const rows = rawSqlite.prepare(`
        SELECT pb.*, s.name as service_name
        FROM pending_bookings pb
        LEFT JOIN services s ON s.id = pb.service_id
        ORDER BY pb.created_at DESC
      `).all();
      return rows;
    } catch {
      return [];
    }
  });
};

export default bookingPublicRoutes;
