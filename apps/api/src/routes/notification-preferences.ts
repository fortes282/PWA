import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { notificationPrefSchemas } from "../utils/swagger-schemas.js";

const notificationPrefsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /notification-preferences
  fastify.get("/notification-preferences", { schema: notificationPrefSchemas.get }, async (request, reply) => {
    const userId = request.auth!.id;
    let prefs = rawSqlite.prepare(
      `SELECT email_reminders, sms_reminders, push_reminders FROM notification_preferences WHERE user_id = ?`
    ).get(userId) as any;
    if (!prefs) {
      prefs = { email_reminders: 1, sms_reminders: 1, push_reminders: 1 };
    }
    return {
      emailReminders: Boolean(prefs.email_reminders),
      smsReminders: Boolean(prefs.sms_reminders),
      pushReminders: Boolean(prefs.push_reminders),
    };
  });

  // PATCH /notification-preferences
  fastify.patch("/notification-preferences", { schema: notificationPrefSchemas.update }, async (request, reply) => {
    const userId = request.auth!.id;
    const body = request.body as any;
    const email = body.emailReminders !== undefined ? (body.emailReminders ? 1 : 0) : undefined;
    const sms = body.smsReminders !== undefined ? (body.smsReminders ? 1 : 0) : undefined;
    const push = body.pushReminders !== undefined ? (body.pushReminders ? 1 : 0) : undefined;

    // Get existing or defaults
    const existing = rawSqlite.prepare(
      `SELECT email_reminders, sms_reminders, push_reminders FROM notification_preferences WHERE user_id = ?`
    ).get(userId) as any ?? { email_reminders: 1, sms_reminders: 1, push_reminders: 1 };

    const newEmail = email !== undefined ? email : existing.email_reminders;
    const newSms = sms !== undefined ? sms : existing.sms_reminders;
    const newPush = push !== undefined ? push : existing.push_reminders;

    rawSqlite.prepare(
      `INSERT OR REPLACE INTO notification_preferences (user_id, email_reminders, sms_reminders, push_reminders) VALUES (?, ?, ?, ?)`
    ).run(userId, newEmail, newSms, newPush);

    return { emailReminders: Boolean(newEmail), smsReminders: Boolean(newSms), pushReminders: Boolean(newPush) };
  });
};

export default notificationPrefsRoutes;
