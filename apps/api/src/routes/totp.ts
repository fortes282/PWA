/**
 * TOTP 2FA routes
 * POST /auth/2fa/setup          — generate TOTP secret + QR code
 * POST /auth/2fa/verify-setup   — verify token and enable 2FA
 * POST /auth/2fa/disable        — disable 2FA (requires current TOTP token)
 * POST /auth/2fa/verify         — verify TOTP token during login
 * GET  /auth/2fa/backup-codes   — regenerate backup codes
 * POST /auth/2fa/use-backup     — use a backup code
 */
import type { FastifyPluginAsync } from "fastify";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { rawSqlite } from "../db/index.js";
import { createHash, randomBytes } from "crypto";

const APP_NAME = "Přístav Radosti";

function hashBackupCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"
    codes.push(code);
  }
  return codes;
}

const totpRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/2fa/setup — generate secret + QR, does not enable 2FA yet
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

      return {
        ok: true,
        backupCodes, // Return plaintext codes ONCE — never again
      };
    }
  );

  // POST /auth/2fa/disable
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

      return { ok: true };
    }
  );

  // POST /auth/2fa/verify — verify token (used during login flow)
  // This is called with a temporary session token after password login
  fastify.post<{ Body: { userId: number; token: string } }>(
    "/auth/2fa/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { userId, token } = request.body;

      const user = rawSqlite.prepare(`SELECT id, totp_secret, email, totp_enabled FROM users WHERE id = ?`).get(userId) as any;
      if (!user || !user.totp_enabled || !user.totp_secret) {
        return reply.code(400).send({ error: "2FA není aktivní pro tento účet." });
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

      return { ok: true, userId };
    }
  );

  // POST /auth/2fa/use-backup — use a one-time backup code
  fastify.post<{ Body: { userId: number; backupCode: string } }>(
    "/auth/2fa/use-backup",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { userId, backupCode } = request.body;

      const user = rawSqlite.prepare(`SELECT id, totp_backup_codes, totp_enabled FROM users WHERE id = ?`).get(userId) as any;
      if (!user || !user.totp_enabled || !user.totp_backup_codes) {
        return reply.code(400).send({ error: "Záložní kódy nejsou dostupné." });
      }

      const codes: string[] = JSON.parse(user.totp_backup_codes);
      const inputHash = hashBackupCode(backupCode.toUpperCase().trim());
      const idx = codes.indexOf(inputHash);

      if (idx === -1) {
        return reply.code(401).send({ error: "Neplatný záložní kód." });
      }

      // Remove used code (one-time use)
      codes.splice(idx, 1);
      rawSqlite.prepare(`UPDATE users SET totp_backup_codes = ? WHERE id = ?`)
        .run(JSON.stringify(codes), userId);

      return { ok: true, remainingCodes: codes.length };
    }
  );

  // GET /auth/2fa/backup-codes — regenerate backup codes (requires active 2FA)
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
    const { id: userId } = request.auth!;
    const user = rawSqlite.prepare(`SELECT totp_enabled, totp_backup_codes FROM users WHERE id = ?`).get(userId) as any;
    const backupCodesRemaining = user?.totp_backup_codes
      ? JSON.parse(user.totp_backup_codes).length
      : 0;
    return {
      enabled: Boolean(user?.totp_enabled),
      backupCodesRemaining,
    };
  });
};

export default totpRoutes;
