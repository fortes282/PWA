import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../utils/hash.js";
import { randomBytes } from "crypto";
import { LoginSchema } from "@pristav/shared";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login — stricter rate limit: 10 req/min per IP
  fastify.post("/auth/login", {
    config: {
      rateLimit: {
        max: Number.parseInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || "10", 10),
        timeWindow: process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW || "1 minute",
      },
    },
  }, async (request, reply) => {
    const result = LoginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.flatten() });
    }
    const { email, password } = result.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: "Neplatné přihlašovací údaje" });
    }
    if (!user.isActive) {
      return reply.code(403).send({ error: "Účet je deaktivován" });
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = fastify.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN || "15m" });

    // Refresh token
    const refreshToken = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({ userId: user.id, token: refreshToken, expiresAt });

    reply.setCookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/auth/refresh",
      maxAge: 7 * 24 * 60 * 60,
    });

    return { accessToken, user: payload };
  });

  // POST /auth/refresh — stricter rate limit: 30 req/min per IP
  fastify.post("/auth/refresh", {
    config: {
      rateLimit: {
        max: Number.parseInt(process.env.AUTH_REFRESH_RATE_LIMIT_MAX || "30", 10),
        timeWindow: process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW || "1 minute",
      },
    },
  }, async (request, reply) => {
    const token = request.cookies?.refreshToken;
    if (!token) return reply.code(401).send({ error: "No refresh token" });

    const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1);
    if (!stored || new Date(stored.expiresAt) < new Date()) {
      return reply.code(401).send({ error: "Refresh token expired or invalid" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "User not found" });
    }

    // Rotate refresh token
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    const newRefreshToken = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(refreshTokens).values({ userId: user.id, token: newRefreshToken, expiresAt });

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = fastify.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN || "15m" });

    reply.setCookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/auth/refresh",
      maxAge: 7 * 24 * 60 * 60,
    });

    return { accessToken, user: payload };
  });

  // GET /auth/me
  fastify.get("/auth/me", async (request, reply) => {
    if (!request.auth) return reply.code(401).send({ error: "Unauthorized" });
    const [user] = await db.select().from(users).where(eq(users.id, request.auth.id)).limit(1);
    if (!user) return reply.code(404).send({ error: "User not found" });
    const { passwordHash, pushSubscription, ...safe } = user;
    return safe;
  });

  // POST /auth/logout
  fastify.post("/auth/logout", async (request, reply) => {
    const token = request.cookies?.refreshToken;
    if (token) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    }
    reply.clearCookie("refreshToken", { path: "/auth/refresh" });
    return { ok: true };
  });
};

export default authRoutes;
