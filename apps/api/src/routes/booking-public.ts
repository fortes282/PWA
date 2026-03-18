import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { pendingBookings, notifications, users } from "../db/schema.js";
import { inArray } from "drizzle-orm";

const bookingPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /booking/public — anonymous user submits a booking request
  fastify.post("/booking/public", async (request, reply) => {
    const body = request.body as {
      serviceId?: number;
      slotDate: string;
      slotTime: string;
      name: string;
      email: string;
      phone?: string;
      note?: string;
    };

    if (!body.slotDate || !body.slotTime || !body.name || !body.email) {
      return reply.code(400).send({ error: "slotDate, slotTime, name, email are required" });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return reply.code(400).send({ error: "Invalid email format" });
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
  fastify.get("/booking/public/pending", async (request, reply) => {
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
