/**
 * Web Push notification route.
 * Requires VAPID keys: npx web-push generate-vapid-keys
 * Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY env vars.
 *
 * VAPID state is read lazily per-request so tests can control it via env vars.
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { pushSchemas } from "../utils/swagger-schemas.js";

// Keep track of last-configured VAPID public key to avoid redundant setVapidDetails calls
let _lastVapidPublicKey: string | undefined;

/**
 * Returns true if VAPID env vars are set (lazy check — re-reads env each call).
 * Also (re-)initialises webpush when the keys appear for the first time or change.
 */
function isVapidConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;

  // (Re-)initialise only when key changes to avoid duplicate calls in tests
  if (pub !== _lastVapidPublicKey) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@pristav-radosti.cz",
        pub,
        priv
      );
      _lastVapidPublicKey = pub;
    } catch {
      return false;
    }
  }
  return true;
}

export async function sendPushNotification(
  userId: number,
  notification: { title: string; body: string; icon?: string; url?: string }
): Promise<boolean> {
  if (!isVapidConfigured()) return false;

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
  fastify.get("/push/vapid-public-key", { schema: pushSchemas.vapidKey }, async () => {
    const configured = isVapidConfigured();
    return {
      publicKey: configured ? (process.env.VAPID_PUBLIC_KEY ?? null) : null,
      enabled: configured,
    };
  });

  // POST /push/subscribe — save push subscription for current user
  fastify.post("/push/subscribe", { schema: pushSchemas.subscribe }, async (request, reply) => {
    const { id } = request.auth!;
    const subscription = request.body as object;

    if (!isVapidConfigured()) {
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
  fastify.delete("/push/unsubscribe", { schema: pushSchemas.unsubscribe }, async (request) => {
    const { id } = request.auth!;
    await db.update(users)
      .set({ pushSubscription: null, pushEnabled: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id));
    return { ok: true };
  });

  // POST /push/test — send test push to self (for testing)
  fastify.post("/push/test", { schema: pushSchemas.test }, async (request) => {
    const { id } = request.auth!;
    const configured = isVapidConfigured();
    const sent = configured
      ? await sendPushNotification(id, {
          title: "Test notifikace",
          body: "Push notifikace funguje správně! ✓",
          url: "/",
        })
      : false;
    return { sent, vapidConfigured: configured };
  });
};

export default pushRoutes;
