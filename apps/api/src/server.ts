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

  return fastify;
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
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}
