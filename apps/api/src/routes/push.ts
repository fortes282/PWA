/**
 * Web Push notification route.
 * Requires VAPID keys: npx web-push generate-vapid-keys
 * Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY env vars.
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import webpush from "web-push";

let vapidConfigured = false;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@pristav-radosti.cz",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
  console.log("[push] VAPID configured, push notifications enabled");
} else {
  console.log("[push] VAPID not configured — push notifications disabled (set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY)");
}

export async function sendPushNotification(
  userId: number,
  notification: { title: string; body: string; icon?: string; url?: string }
): Promise<boolean> {
  if (!vapidConfigured) return false;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.pushEnabled || !user?.pushSubscription) return false;

  try {
    const subscription = JSON.parse(user.pushSubscription);
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon ?? "/icons/icon-192.png",
        url: notification.url ?? "/",
      })
    );
    return true;
  } catch (err) {
    console.error(`[push] Error sending to user ${userId}:`, err);
    // If subscription is gone, clear it
    if ((err as any)?.statusCode === 410) {
      await db.update(users)
        .set({ pushSubscription: null, pushEnabled: false })
        .where(eq(users.id, userId));
    }
    return false;
  }
}

const pushRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /push/vapid-public-key — return VAPID public key for frontend
  fastify.get("/push/vapid-public-key", async () => {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      enabled: vapidConfigured,
    };
  });

  // POST /push/subscribe — save push subscription for current user
  fastify.post("/push/subscribe", async (request, reply) => {
    const { id } = request.auth!;
    const subscription = request.body as object;

    if (!vapidConfigured) {
      return reply.code(503).send({ error: "Push notifications not configured" });
    }

    await db.update(users)
      .set({
        pushSubscription: JSON.stringify(subscription),
        pushEnabled: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));

    return { ok: true };
  });

  // DELETE /push/unsubscribe
  fastify.delete("/push/unsubscribe", async (request) => {
    const { id } = request.auth!;
    await db.update(users)
      .set({ pushSubscription: null, pushEnabled: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id));
    return { ok: true };
  });

  // POST /push/test — send test push to self (for testing)
  fastify.post("/push/test", async (request, reply) => {
    const { id } = request.auth!;
    const sent = await sendPushNotification(id, {
      title: "Test notifikace",
      body: "Push notifikace funguje správně! ✓",
      url: "/",
    });
    return { sent, vapidConfigured };
  });
};

export default pushRoutes;
