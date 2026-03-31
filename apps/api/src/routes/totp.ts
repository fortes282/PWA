/**
 * TOTP 2FA routes
 * POST /auth/2fa/setup              — generate TOTP secret + QR code (authenticated)
 * POST /auth/2fa/verify-setup       — verify token and enable 2FA (authenticated)
 * POST /auth/2fa/disable            — disable 2FA (authenticated, requires current TOTP token)
 * POST /auth/2fa/verify             — verify TOTP token during login (public, uses pendingToken)
 * POST /auth/2fa/use-backup         — use a backup code during login (public, uses pendingToken)
 * POST /auth/2fa/backup-codes/regenerate — regenerate backup codes (authenticated)
 * GET  /auth/2fa/status             — check current user's 2FA status (authenticated)
 */
import type { FastifyPluginAsync } from "fastify";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { rawSqlite, db } from "../db/index.js";
import { users, refreshTokens } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { logAudit } from "./audit.js";

const APP_NAME = "Přístav Radosti";
const REFRESH_TOKEN_DAYS = Number.parseInt(process.env.AUTH_REFRESH_TOKEN_DAYS || "30", 10);

function expiresInToSeconds(expiresIn: string): number {
  const value = expiresIn.trim().toLowerCase();
  const m = value.match(/^(\d+)([smhd])$/);
  if (!m) return 15 * 60;
  const amount = Number.parseInt(m[1], 10);
  const unit = m[2];
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  return amount * 24 * 60 * 60;
}

function hashBackupCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    // Format: XXXX-XXXX-XXXX (12 hex chars grouped)
    const part1 = randomBytes(2).toString("hex").toUpperCase();
    const part2 = randomBytes(2).toString("hex").toUpperCase();
    const part3 = randomBytes(2).toString("hex").toUpperCase();
    codes.push(`${part1}-${part2}-${part3}`);
  }
  return codes;
}

const totpRoutes: FastifyPluginAsync = async (fastify) => {
  const accessTokenExpiresIn = process.env.JWT_EXPIRES_IN || "15m";
  const accessTokenMaxAge = expiresInToSeconds(accessTokenExpiresIn);

  // POST /auth/2fa/setup — generate secret + QR, does not enable 2FA yet
  // Requires: authenticated user
  fastify.post("/auth/2fa/setup", async (request, reply) => {
    const { id: userId, email } = request.auth!;

    // Generate a new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const otpAuthUrl = totp.toString();
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    // Store secret (not yet enabled — user must verify first)
    rawSqlite.prepare(`UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`)
      .run(secret.base32, userId);

    return {
      secret: secret.base32,
      otpAuthUrl,
      qrCode, // data:image/png;base64,...
    };
  });

  // POST /auth/2fa/verify-setup — verify token and enable 2FA + return backup codes
  // Requires: authenticated user
  fastify.post<{ Body: { token: string } }>(
    "/auth/2fa/verify-setup",
    async (request, reply) => {
      const { id: userId } = request.auth!;
      const { token } = request.body;

      const user = rawSqlite.prepare(`SELECT totp_secret, email FROM users WHERE id = ?`).get(userId) as any;
      if (!user?.totp_secret) {
        return reply.code(400).send({ error: "2FA setup not initiated. Call /auth/2fa/setup first." });
      }

      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      });

      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return reply.code(400).send({ error: "Neplatný kód. Zkuste to znovu." });
      }

      // Generate backup codes
      const backupCodes = generateBackupCodes();
      const hashedCodes = backupCodes.map(hashBackupCode);

      rawSqlite.prepare(`UPDATE users SET totp_enabled = 1, totp_backup_codes = ? WHERE id = ?`)
        .run(JSON.stringify(hashedCodes), userId);

      logAudit(db, userId, "2FA_ENABLED");

      return {
        ok: true,
        backupCodes, // Return plaintext codes ONCE — never again
      };
    }
  );

  // POST /auth/2fa/disable
  // Requires: authenticated user (CLIENT/RECEPTION only — ADMIN/EMPLOYEE cannot disable)
  fastify.post<{ Body: { token: string } }>(
    "/auth/2fa/disable",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      const { token } = request.body;

      // Admin and Employee cannot disable 2FA (it's mandatory for them)
      if (["ADMIN", "EMPLOYEE"].includes(role)) {
        return reply.code(403).send({ error: "2FA je povinné pro tuto roli a nelze jej vypnout." });
      }

      const user = rawSqlite.prepare(`SELECT totp_secret, email FROM users WHERE id = ?`).get(userId) as any;
      if (!user?.totp_secret) {
        return reply.code(400).send({ error: "2FA není aktivní." });
      }

      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      });

      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return reply.code(400).send({ error: "Neplatný kód." });
      }

      rawSqlite.prepare(`UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_backup_codes = NULL WHERE id = ?`)
        .run(userId);

      logAudit(db, userId, "2FA_DISABLED");

      return { ok: true };
    }
  );

  // POST /auth/2fa/verify — verify TOTP during login and issue full JWT
  // PUBLIC endpoint — uses pendingToken (issued by /auth/login when 2FA required)
  fastify.post<{ Body: { pendingToken: string; token: string } }>(
    "/auth/2fa/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { pendingToken, token } = request.body;

      // Verify pending token
      let pendingPayload: { sub: number; scope: string };
      try {
        pendingPayload = fastify.jwt.verify<{ sub: number; scope: string }>(pendingToken);
      } catch {
        return reply.code(401).send({ error: "Neplatný nebo expirovaný přihlašovací token." });
      }

      if (pendingPayload.scope !== "2fa_pending") {
        return reply.code(401).send({ error: "Neplatný token." });
      }

      const userId = pendingPayload.sub;
      const user = rawSqlite.prepare(`SELECT id, totp_secret, email, totp_enabled, name, role, is_active FROM users WHERE id = ?`).get(userId) as any;

      if (!user || !user.totp_enabled || !user.totp_secret) {
        return reply.code(400).send({ error: "2FA není aktivní pro tento účet." });
      }

      if (!user.is_active) {
        return reply.code(403).send({ error: "Účet je deaktivován." });
      }

      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      });

      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return reply.code(401).send({ error: "Neplatný 2FA kód." });
      }

      // Issue full tokens
      const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
      const accessToken = fastify.jwt.sign(payload, { expiresIn: accessTokenExpiresIn });

      const refreshToken = randomBytes(40).toString("hex");
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(refreshTokens).values({ userId: user.id, token: refreshToken, expiresAt });

      reply.setCookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "strict",
        path: "/",
        maxAge: accessTokenMaxAge,
      });

      reply.setCookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "strict",
        path: "/",
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
      });

      logAudit(db, user.id, "USER_LOGIN_2FA");

      return { accessToken, user: payload };
    }
  );

  // POST /auth/2fa/use-backup — use a one-time backup code during login
  // PUBLIC endpoint — uses pendingToken
  fastify.post<{ Body: { pendingToken: string; backupCode: string } }>(
    "/auth/2fa/use-backup",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { pendingToken, backupCode } = request.body;

      // Verify pending token
      let pendingPayload: { sub: number; scope: string };
      try {
        pendingPayload = fastify.jwt.verify<{ sub: number; scope: string }>(pendingToken);
      } catch {
        return reply.code(401).send({ error: "Neplatný nebo expirovaný přihlašovací token." });
      }

      if (pendingPayload.scope !== "2fa_pending") {
        return reply.code(401).send({ error: "Neplatný token." });
      }

      const userId = pendingPayload.sub;
      const user = rawSqlite.prepare(`SELECT id, totp_backup_codes, totp_enabled, email, name, role, is_active FROM users WHERE id = ?`).get(userId) as any;

      if (!user || !user.totp_enabled || !user.totp_backup_codes) {
        return reply.code(400).send({ error: "Záložní kódy nejsou dostupné." });
      }

      if (!user.is_active) {
        return reply.code(403).send({ error: "Účet je deaktivován." });
      }

      const codes: string[] = JSON.parse(user.totp_backup_codes);
      const inputHash = hashBackupCode(backupCode.toUpperCase().replace(/\s/g, "").trim());
      const idx = codes.indexOf(inputHash);

      if (idx === -1) {
        return reply.code(401).send({ error: "Neplatný záložní kód." });
      }

      // Remove used code (one-time use)
      codes.splice(idx, 1);
      rawSqlite.prepare(`UPDATE users SET totp_backup_codes = ? WHERE id = ?`)
        .run(JSON.stringify(codes), userId);

      // Issue full tokens
      const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
      const accessToken = fastify.jwt.sign(payload, { expiresIn: accessTokenExpiresIn });

      const refreshToken = randomBytes(40).toString("hex");
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await db.insert(refreshTokens).values({ userId: user.id, token: refreshToken, expiresAt });

      reply.setCookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "strict",
        path: "/",
        maxAge: accessTokenMaxAge,
      });

      reply.setCookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "strict",
        path: "/",
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
      });

      logAudit(db, user.id, "USER_LOGIN_BACKUP_CODE", { details: String(codes.length) });

      return { accessToken, user: payload, remainingCodes: codes.length };
    }
  );

  // POST /auth/2fa/backup-codes/regenerate — regenerate backup codes (authenticated)
  fastify.post<{ Body: { token: string } }>(
    "/auth/2fa/backup-codes/regenerate",
    async (request, reply) => {
      const { id: userId } = request.auth!;
      const { token } = request.body;

      const user = rawSqlite.prepare(`SELECT totp_secret, email, totp_enabled FROM users WHERE id = ?`).get(userId) as any;
      if (!user?.totp_enabled || !user.totp_secret) {
        return reply.code(400).send({ error: "2FA není aktivní." });
      }

      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      });

      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return reply.code(400).send({ error: "Neplatný kód." });
      }

      const backupCodes = generateBackupCodes();
      const hashedCodes = backupCodes.map(hashBackupCode);
      rawSqlite.prepare(`UPDATE users SET totp_backup_codes = ? WHERE id = ?`)
        .run(JSON.stringify(hashedCodes), userId);

      return { ok: true, backupCodes };
    }
  );

  // GET /auth/2fa/status — check current user's 2FA status
  fastify.get("/auth/2fa/status", async (request) => {
    const { id: userId, role } = request.auth!;
    const user = rawSqlite.prepare(`SELECT totp_enabled, totp_backup_codes FROM users WHERE id = ?`).get(userId) as any;
    const backupCodesRemaining = user?.totp_backup_codes
      ? JSON.parse(user.totp_backup_codes).length
      : 0;
    const mandatory = ["ADMIN", "EMPLOYEE"].includes(role);
    return {
      enabled: Boolean(user?.totp_enabled),
      mandatory,
      backupCodesRemaining,
    };
  });
};

export default totpRoutes;
