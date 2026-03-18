import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
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
import dashboardRoutes from "./routes/dashboard.js";
import batchRoutes from "./routes/batch.js";
import auditRoutes from "./routes/audit.js";
import passwordResetRoutes from "./routes/password-reset.js";
import appointmentSeriesRoutes from "./routes/appointment-series.js";
import searchRoutes from "./routes/search.js";
import timeOffRoutes from "./routes/time-off.js";
import reportsRoutes from "./routes/reports.js";
import loyaltyRoutes from "./routes/loyalty.js";
import appointmentTemplatesRoutes from "./routes/appointment-templates.js";
import healthGoalsRoutes from "./routes/health-goals.js";
import messagesRoutes from "./routes/messages.js";
import ratingsRoutes from "./routes/ratings.js";
import clientStaffNotesRoutes from "./routes/client-staff-notes.js";

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
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
  });

  // Security headers (helmet)
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // CSP can break API JSON responses; configure per-project
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

  // Static files — avatar serving
  const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
  const avatarDir = join(dataDir, "avatars");
  mkdirSync(avatarDir, { recursive: true });
  await fastify.register(fastifyStatic, {
    root: avatarDir,
    prefix: "/avatars/",
    decorateReply: false,
  });

  // Auth middleware
  await fastify.register(authPlugin);

  // Health check
  fastify.get("/health", async () => ({
    status: "ok",
    time: new Date().toISOString(),
    version: "2.0.0",
  }));

  // Ultra-lightweight ping for uptime monitoring
  fastify.get("/health/ping", async (_, reply) => {
    reply.header("Cache-Control", "no-cache");
    return { pong: true };
  });

  // Detailed health check — unauthenticated, for monitoring/uptime
  fastify.get("/health/detailed", async () => {
    const start = Date.now();
    let dbOk = false;
    let dbMs = -1;
    let dbSize = 0;
    const tableStats: Record<string, number> = { users: 0, appointments: 0, invoices: 0 };
    let pendingReminders = 0;

    try {
      const { rawSqlite } = await import("./db/index.js");
      rawSqlite.prepare("SELECT 1").get();
      dbMs = Date.now() - start;
      dbOk = true;

      // DB file size in MB (returns 0 for :memory:)
      try {
        const dbPath = process.env.DATABASE_PATH || "";
        if (dbPath && dbPath !== ":memory:") {
          const { statSync } = await import("fs");
          dbSize = parseFloat((statSync(dbPath).size / (1024 * 1024)).toFixed(2));
        }
      } catch { /* ignore */ }

      // Table row counts
      try {
        tableStats.users = (rawSqlite.prepare("SELECT COUNT(*) as n FROM users").get() as any).n ?? 0;
        tableStats.appointments = (rawSqlite.prepare("SELECT COUNT(*) as n FROM appointments").get() as any).n ?? 0;
        tableStats.invoices = (rawSqlite.prepare("SELECT COUNT(*) as n FROM invoices").get() as any).n ?? 0;
      } catch { /* ignore */ }

      // Pending reminders in next 24h (CONFIRMED appointments)
      try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        pendingReminders = (rawSqlite.prepare(`
          SELECT COUNT(*) as n FROM appointments
          WHERE status = 'CONFIRMED' AND start_time > ? AND start_time <= ?
        `).get(now.toISOString(), in24h.toISOString()) as any).n ?? 0;
      } catch { /* ignore */ }
    } catch {
      dbMs = Date.now() - start;
    }

    const reminderHours = parseInt(process.env.REMINDER_HOURS ?? "24");
    const features = {
      email: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      sms: !!process.env.SMSAPI_TOKEN,
      push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      fio: !!process.env.FIO_API_KEY,
    };

    return {
      status: dbOk ? "ok" : "degraded",
      version: "2.0.0",
      time: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      db: { ok: dbOk, latencyMs: dbMs },
      dbSize,
      tableStats,
      pendingReminders,
      features,
      config: { reminderHours },
    };
  });

  // In-memory rate limiter for /auth/login (supplementary, 10 req/min per IP)
  const loginRateMap = new Map<string, { count: number; windowStart: number }>();
  const LOGIN_RATE_MAX = 10;
  const LOGIN_RATE_WINDOW_MS = 60 * 1000; // 1 minute

  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method === "POST" && request.url === "/auth/login") {
      const ip = request.ip;
      const now = Date.now();
      const entry = loginRateMap.get(ip);

      if (!entry || now - entry.windowStart > LOGIN_RATE_WINDOW_MS) {
        loginRateMap.set(ip, { count: 1, windowStart: now });
      } else {
        entry.count++;
        if (entry.count > LOGIN_RATE_MAX) {
          return reply.code(429).send({
            error: "Too Many Requests",
            message: "Příliš mnoho pokusů o přihlášení. Zkuste to znovu za minutu.",
            retryAfter: Math.ceil((entry.windowStart + LOGIN_RATE_WINDOW_MS - now) / 1000),
          });
        }
      }
    }
  });

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
  await fastify.register(dashboardRoutes);
  await fastify.register(batchRoutes);
  await fastify.register(auditRoutes);
  await fastify.register(passwordResetRoutes);
  await fastify.register(appointmentSeriesRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(timeOffRoutes);
  await fastify.register(reportsRoutes);
  await fastify.register(loyaltyRoutes);
  await fastify.register(appointmentTemplatesRoutes);
  await fastify.register(healthGoalsRoutes);
  await fastify.register(messagesRoutes);
  await fastify.register(ratingsRoutes);
  await fastify.register(clientStaffNotesRoutes);

  // Apply runtime migrations lazily on first request (safe for tests where
  // tables are created after buildApp() via rawSqlite.exec(MIGRATION_SQL))
  const { applyRuntimeMigrations } = await import("./db/index.js");
  let _migrationsRan = false;
  fastify.addHook("onRequest", async () => {
    if (!_migrationsRan) {
      _migrationsRan = true;
      applyRuntimeMigrations();
    }
  });

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
