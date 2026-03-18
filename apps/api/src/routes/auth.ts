import type { FastifyPluginAsync } from "fastify";
import { db, rawSqlite } from "../db/index.js";
import { users, refreshTokens, loginHistory } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword, isLegacyHash, hashPassword } from "../utils/hash.js";
import { randomBytes } from "crypto";
import { LoginSchema } from "@pristav/shared";
import { logAudit } from "./audit.js";
import { authSchemas } from "../utils/swagger-schemas.js";

// In-memory account lockout tracker (per email)
const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkLockout(email: string): { locked: boolean; remainingMs?: number } {
  const entry = loginAttempts.get(email);
  if (!entry || !entry.lockedUntil) return { locked: false };
  if (Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(email);
    return { locked: false };
  }
  return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
}

function recordFailedLogin(email: string): void {
  const entry = loginAttempts.get(email) ?? { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(email, entry);
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login — stricter rate limit: 10 req/min per IP
  fastify.post("/auth/login", {
    schema: authSchemas.login,
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

    // Account lockout check
    const lockout = checkLockout(email);
    if (lockout.locked) {
      const mins = Math.ceil((lockout.remainingMs ?? 0) / 60_000);
      return reply.code(429).send({ error: `Účet je dočasně zablokován. Zkuste to za ${mins} minut.` });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailedLogin(email);
      // Record failed login attempt
      if (user) {
        try { await db.insert(loginHistory).values({ userId: user.id, ip: request.ip, userAgent: request.headers["user-agent"] ?? null, success: false }); } catch { /* ignore */ }
      }
      return reply.code(401).send({ error: "Neplatné přihlašovací údaje" });
    }
    if (!user.isActive) {
      return reply.code(403).send({ error: "Účet je deaktivován" });
    }

    // Clear lockout on successful login
    clearLoginAttempts(email);

    // Record successful login
    try { await db.insert(loginHistory).values({ userId: user.id, ip: request.ip, userAgent: request.headers["user-agent"] ?? null, success: true }); } catch { /* ignore */ }

    // Transparent hash upgrade: re-hash legacy SHA-256 passwords with scrypt
    if (isLegacyHash(user.passwordHash)) {
      const newHash = hashPassword(password);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
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

    // Audit log
    logAudit(db, user.id, "USER_LOGIN", { ip: request.ip });

    return { accessToken, user: payload };
  });

  // POST /auth/refresh — stricter rate limit: 30 req/min per IP
  fastify.post("/auth/refresh", {
    schema: authSchemas.refresh,
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
  fastify.get("/auth/me", { schema: authSchemas.me }, async (request, reply) => {
    if (!request.auth) return reply.code(401).send({ error: "Unauthorized" });
    const [user] = await db.select().from(users).where(eq(users.id, request.auth.id)).limit(1);
    if (!user) return reply.code(404).send({ error: "User not found" });
    const { passwordHash, pushSubscription, ...safe } = user;
    return safe;
  });

  // POST /auth/logout
  fastify.post("/auth/logout", { schema: authSchemas.logout }, async (request, reply) => {
    const token = request.cookies?.refreshToken;
    let userId: number | null = null;
    if (token) {
      const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1);
      userId = stored?.userId ?? null;
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    }
    reply.clearCookie("refreshToken", { path: "/auth/refresh" });
    if (userId) logAudit(db, userId, "USER_LOGOUT");
    return { ok: true };
  });
};

export default authRoutes;
