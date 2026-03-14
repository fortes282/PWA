import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { mkdirSync } from "fs";
import { join } from "path";

import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import appointmentsRoutes from "./routes/appointments.js";
import servicesRoutes from "./routes/services.js";
import roomsRoutes from "./routes/rooms.js";
import creditsRoutes from "./routes/credits.js";
import notificationsRoutes from "./routes/notifications.js";
import waitlistRoutes from "./routes/waitlist.js";
import medicalRoutes from "./routes/medical.js";
import behaviorRoutes from "./routes/behavior.js";
import statsRoutes from "./routes/stats.js";
import invoicesRoutes from "./routes/invoices.js";
import workingHoursRoutes from "./routes/working-hours.js";
import pdfRoutes from "./routes/pdf.js";
import fioRoutes from "./routes/fio.js";
import pushRoutes from "./routes/push.js";
import reminderRoutes from "./routes/reminders.js";
import healthRecordsRoutes from "./routes/health-records.js";
import systemSettingsRoutes from "./routes/system-settings.js";
import creditRequestRoutes from "./routes/credit-requests.js";

export async function buildApp(opts?: FastifyServerOptions): Promise<FastifyInstance> {
  const fastify = Fastify(opts ?? {
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Security
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // CORS
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  });

  // Cookies
  await fastify.register(fastifyCookie);

  // JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not set!");
  }
  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: "accessToken",
      signed: false,
    },
  });

  // Auth middleware
  await fastify.register(authPlugin);

  // Health check
  fastify.get("/health", async () => ({
    status: "ok",
    time: new Date().toISOString(),
    version: "2.0.0",
  }));

  // Routes
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(appointmentsRoutes);
  await fastify.register(servicesRoutes);
  await fastify.register(roomsRoutes);
  await fastify.register(creditsRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(waitlistRoutes);
  await fastify.register(medicalRoutes);
  await fastify.register(behaviorRoutes);
  await fastify.register(statsRoutes);
  await fastify.register(invoicesRoutes);
  await fastify.register(workingHoursRoutes);
  await fastify.register(pdfRoutes);
  await fastify.register(fioRoutes);
  await fastify.register(pushRoutes);
  await fastify.register(reminderRoutes);
  await fastify.register(healthRecordsRoutes);
  await fastify.register(systemSettingsRoutes);
  await fastify.register(creditRequestRoutes);

  return fastify;
}

// ── Built-in reminder scheduler ──────────────────────────────────────────────
// Runs every hour; sends email/SMS/push/in-app reminders for upcoming appointments.
// Extracted so it can be called directly without HTTP overhead.

async function runReminderScheduler(log: { info: (m: string) => void; error: (m: string, e?: unknown) => void }) {
  try {
    const { db } = await import("./db/index.js");
    const { appointments, users, services, notifications } = await import("./db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { sendEmail, appointmentReminderEmail } = await import("./services/email.js");
    const { sendSms, appointmentReminderSms } = await import("./services/sms.js");

    const reminderHours = parseInt(process.env.REMINDER_HOURS ?? "24");
    const now = new Date();
    const windowStart = new Date(now.getTime() + (reminderHours - 1) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (reminderHours + 1) * 60 * 60 * 1000);

    const upcoming = (await db.select().from(appointments)).filter(
      (a) =>
        a.status === "CONFIRMED" &&
        a.startTime >= windowStart.toISOString() &&
        a.startTime <= windowEnd.toISOString(),
    );

    if (upcoming.length === 0) {
      log.info("[reminders] No upcoming appointments in window — skipping");
      return;
    }

    let emailSent = 0, smsSent = 0, inApp = 0;

    for (const appt of upcoming) {
      const [client] = await db.select().from(users).where(eq(users.id, appt.clientId)).limit(1);
      const [svc] = await db.select().from(services).where(eq(services.id, appt.serviceId)).limit(1);
      if (!client) continue;

      const dateStr = new Date(appt.startTime).toLocaleString("cs-CZ");
      const svcName = svc?.name ?? "Termín";

      // In-app notification
      await db.insert(notifications).values({
        userId: client.id,
        type: "APPOINTMENT_REMINDER",
        title: "Připomínka termínu",
        message: `Váš termín ${svcName} je naplánován na ${dateStr}.`,
      });
      inApp++;

      // Email reminder
      if (client.emailEnabled && client.email) {
        const payload = appointmentReminderEmail(client.name, dateStr, svcName);
        payload.to = client.email;
        await sendEmail(payload);
        emailSent++;
      }

      // SMS reminder
      if (client.smsEnabled && client.phone) {
        const payload = appointmentReminderSms(dateStr, svcName);
        await sendSms(client.phone, payload);
        smsSent++;
      }
    }

    log.info(
      `[reminders] Done — ${upcoming.length} appointments, inApp=${inApp}, email=${emailSent}, sms=${smsSent}`,
    );
  } catch (err) {
    log.error("[reminders] Scheduler error", err);
  }
}

// Main entry — only runs when executed directly
const isDirectRun = process.argv[1]?.includes("server");
if (isDirectRun) {
  // Ensure data dir exists
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  buildApp().then(async (app) => {
    const port = parseInt(process.env.PORT || "3001");
    const host = process.env.HOST || "0.0.0.0";
    try {
      await app.listen({ port, host });
      app.log.info(`🚀 API running on ${host}:${port}`);

      // Start hourly reminder scheduler (runs immediately once, then every hour)
      const reminderIntervalMs = 60 * 60 * 1000; // 1 hour
      const logShim = {
        info: (m: string) => app.log.info(m),
        error: (m: string, e?: unknown) => app.log.error({ err: e }, m),
      };
      // Initial run after 1 minute (give DB time to be ready)
      setTimeout(() => {
        runReminderScheduler(logShim);
        setInterval(() => runReminderScheduler(logShim), reminderIntervalMs);
      }, 60_000);

      app.log.info("⏰ Reminder scheduler started (hourly)");
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}
