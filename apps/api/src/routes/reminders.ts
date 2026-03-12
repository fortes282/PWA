/**
 * Reminder system — sends appointment reminders via email/SMS/push.
 * Call POST /reminders/run from a cron job (e.g. every hour).
 * Only ADMIN can trigger. Also supports upcoming reminder check.
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { appointments, users, services, notifications } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { sendEmail, appointmentReminderEmail } from "../services/email.js";
import { sendSms, appointmentReminderSms } from "../services/sms.js";
import { sendPushNotification } from "./push.js";

const reminderRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /reminders/upcoming — check upcoming appointments in next 24h
  fastify.get("/reminders/upcoming", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = (await db.select().from(appointments))
      .filter((a) =>
        a.status === "CONFIRMED" &&
        a.startTime > now.toISOString() &&
        a.startTime <= in24h.toISOString()
      );

    return {
      count: upcoming.length,
      appointments: upcoming.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        startTime: a.startTime,
      })),
    };
  });

  // POST /reminders/run — send all pending reminders
  fastify.post("/reminders/run", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    const reminderHours = parseInt(process.env.REMINDER_HOURS ?? "24");
    const now = new Date();
    const windowStart = new Date(now.getTime() + (reminderHours - 1) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (reminderHours + 1) * 60 * 60 * 1000);

    const upcoming = (await db.select().from(appointments))
      .filter((a) =>
        a.status === "CONFIRMED" &&
        a.startTime >= windowStart.toISOString() &&
        a.startTime <= windowEnd.toISOString()
      );

    const results = { total: upcoming.length, emailSent: 0, smsSent: 0, pushSent: 0, inApp: 0 };

    for (const appt of upcoming) {
      const [client] = await db.select().from(users).where(eq(users.id, appt.clientId)).limit(1);
      const [svc] = await db.select().from(services).where(eq(services.id, appt.serviceId)).limit(1);

      if (!client) continue;

      const dateStr = new Date(appt.startTime).toLocaleString("cs-CZ");
      const svcName = svc?.name ?? "Termín";

      // In-app
      await db.insert(notifications).values({
        userId: client.id,
        type: "APPOINTMENT_REMINDER",
        title: "Připomínka termínu",
        message: `Váš termín ${svcName} je zítra ${dateStr}.`,
      });
      results.inApp++;

      // Email
      if (client.emailEnabled && client.email) {
        const payload = appointmentReminderEmail(client.name, dateStr, svcName);
        payload.to = client.email;
        const ok = await sendEmail(payload);
        if (ok) results.emailSent++;
      }

      // SMS
      if (client.smsEnabled && client.phone) {
        const msg = appointmentReminderSms(dateStr, svcName);
        const ok = await sendSms(client.phone, msg);
        if (ok) results.smsSent++;
      }

      // Push
      const pushOk = await sendPushNotification(client.id, {
        title: "Připomínka termínu",
        body: `${svcName} — ${dateStr}`,
        url: "/client/appointments",
      });
      if (pushOk) results.pushSent++;
    }

    return results;
  });
};

export default reminderRoutes;
