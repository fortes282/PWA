/**
 * Password reset routes:
 * POST /auth/forgot-password — sends reset token via email
 * POST /auth/reset-password  — validates token, sets new password
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users, passwordResets } from "../db/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { passwordResetSchemas } from "../utils/swagger-schemas.js";
import { hashPassword } from "../utils/hash.js";
import { sendEmail } from "../services/email.js";

const passwordResetRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/forgot-password
  fastify.post<{ Body: { email: string } }>(
    "/auth/forgot-password",
    {
      schema: passwordResetSchemas.forgot,
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string };
      if (!email || typeof email !== "string") {
        return reply.code(400).send({ error: "Email je povinný" });
      }

      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, isActive: users.isActive })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      // Always return 200 to prevent user enumeration
      if (!user || !user.isActive) {
        return { message: "Pokud účet existuje, byl odeslán e-mail s odkazem pro reset hesla." };
      }

      // Invalidate old tokens for this user
      await db
        .delete(passwordResets)
        .where(eq(passwordResets.userId, user.id));

      // Create new reset token (expires in 1 hour)
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await db.insert(passwordResets).values({ userId: user.id, token, expiresAt });

      // Send email
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: "Reset hesla — Přístav Radosti",
        html: `
          <p>Dobrý den, ${user.name},</p>
          <p>Obdrželi jsme žádost o reset hesla pro váš účet.</p>
          <p><a href="${resetUrl}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Resetovat heslo</a></p>
          <p>Odkaz je platný 1 hodinu. Pokud jste žádost nepodali, ignorujte tento e-mail.</p>
          <p>S pozdravem,<br>Tým Přístav Radosti</p>
        `,
        text: `Odkaz pro reset hesla: ${resetUrl}\n\nOdkaz je platný 1 hodinu.`,
      });

      return { message: "Pokud účet existuje, byl odeslán e-mail s odkazem pro reset hesla." };
    }
  );

  // POST /auth/reset-password
  fastify.post<{ Body: { token: string; password: string } }>(
    "/auth/reset-password",
    {
      schema: passwordResetSchemas.reset,
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
      const { token, password } = request.body as { token: string; password: string };

      if (!token || !password) {
        return reply.code(400).send({ error: "Token a nové heslo jsou povinné" });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: "Heslo musí mít alespoň 8 znaků" });
      }

      const now = new Date().toISOString();
      const [resetRecord] = await db
        .select()
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.token, token),
            gt(passwordResets.expiresAt, now)
          )
        )
        .limit(1);

      if (!resetRecord) {
        return reply.code(400).send({ error: "Odkaz pro reset hesla je neplatný nebo vypršel" });
      }

      // Update password
      const passwordHash = hashPassword(password);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date().toISOString() })
        .where(eq(users.id, resetRecord.userId));

      // Invalidate token
      await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));

      // Invalidate all refresh tokens for this user
      const { refreshTokens } = await import("../db/schema.js");
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, resetRecord.userId));

      return { message: "Heslo bylo úspěšně změněno. Přihlaste se prosím znovu." };
    }
  );

  // GET /auth/reset-password/validate?token= — check if token is valid (for frontend pre-validation)
  fastify.get<{ Querystring: { token: string } }>(
    "/auth/reset-password/validate",
    async (request, reply) => {
      const { token } = request.query as { token: string };
      if (!token) return reply.code(400).send({ valid: false, error: "Token chybí" });

      const now = new Date().toISOString();
      const [record] = await db
        .select({ id: passwordResets.id })
        .from(passwordResets)
        .where(and(eq(passwordResets.token, token), gt(passwordResets.expiresAt, now)))
        .limit(1);

      return { valid: !!record };
    }
  );
};

export default passwordResetRoutes;
