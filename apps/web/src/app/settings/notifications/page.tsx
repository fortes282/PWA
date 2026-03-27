"use client";

import Link from "next/link";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Bell, BellOff, ChevronLeft } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, delay: i * 0.07 },
  }),
};

const fetcher = (url: string) => api.get<any>(url);

/** Convert base64url VAPID public key string to Uint8Array.
 *  Real browsers require Uint8Array for applicationServerKey — passing a plain
 *  string works only in some older Chrome builds and fails in Firefox/Safari. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

type PushStatus = "checking" | "unsupported" | "idle" | "loading" | "subscribed" | "error";

function PushSubscribeButton() {
  const shouldReduce = useReducedMotion();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const existing = await reg.pushManager.getSubscription();
        setStatus(existing ? "subscribed" : "idle");
      })
      .catch(() => setStatus("idle"));
  }, []);

  const subscribe = async () => {
    setStatus("loading");
    setErrorMsg(null);
    setTestResult(null);
    try {
      const { publicKey, enabled } = await api.get<{ publicKey: string | null; enabled: boolean }>("/push/vapid-public-key");
      if (!enabled || !publicKey) {
        setStatus("error");
        setErrorMsg("Push notifikace nejsou nakonfigurovány na serveru.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      await api.post("/push/subscribe", subscription.toJSON());
      setStatus("subscribed");
    } catch (err: any) {
      setStatus("error");
      if (err?.name === "NotAllowedError") {
        setErrorMsg("Prohlížeč zablokoval povolení pro notifikace.");
      } else {
        setErrorMsg(err?.message ?? "Aktivace se nezdařila.");
      }
    }
  };

  const unsubscribe = async () => {
    setStatus("loading");
    setErrorMsg(null);
    setTestResult(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      await api.delete("/push/unsubscribe");
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMsg("Odhlášení se nezdařilo.");
    }
  };

  const sendTest = async () => {
    setTestResult(null);
    try {
      const result = await api.post<{ sent: boolean; vapidConfigured: boolean }>("/push/test", {});
      if (result.sent) {
        setTestResult("✓ Testovací notifikace odeslána");
      } else if (!result.vapidConfigured) {
        setTestResult("Server nemá nakonfigurované VAPID klíče.");
      } else {
        setTestResult("Nepodařilo se odeslat — žádná aktivní subscription?");
      }
    } catch {
      setTestResult("Chyba při odesílání testovací notifikace.");
    }
  };

  if (status === "checking") {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Zjišťuji stav…</p>;
  }

  if (status === "unsupported") {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Push notifikace nejsou podporovány v tomto prohlížeči.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              status === "subscribed"
                ? "bg-primary-100 dark:bg-primary-900/30"
                : "bg-gray-100 dark:bg-gray-800"
            }`}
            animate={shouldReduce ? {} : status === "subscribed" ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            key={status}
          >
            <AnimatePresence mode="wait">
              {status === "subscribed" ? (
                <motion.span
                  key="bell-on"
                  initial={shouldReduce ? {} : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={shouldReduce ? {} : { scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <Bell size={16} className="text-primary-600 dark:text-primary-400" />
                </motion.span>
              ) : (
                <motion.span
                  key="bell-off"
                  initial={shouldReduce ? {} : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={shouldReduce ? {} : { scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <BellOff size={16} className="text-gray-500 dark:text-gray-400" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Push notifikace</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Notifikace přímo v prohlížeči / na telefonu</p>
          </div>
        </div>
        <AnimatePresence mode="wait">
          {status === "subscribed" ? (
            <motion.div
              key="subscribed-actions"
              initial={shouldReduce ? {} : { opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, x: 6 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Aktivováno</span>
              <motion.button
                onClick={unsubscribe}
                className="btn-secondary text-xs py-1"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                Odhlásit
              </motion.button>
            </motion.div>
          ) : (
            <motion.button
              key="subscribe-btn"
              onClick={subscribe}
              disabled={status === "loading"}
              className="btn-secondary text-xs py-1"
              initial={shouldReduce ? {} : { opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, x: 6 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              {status === "loading" ? "Aktivuji…" : "Aktivovat"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {status === "error" && errorMsg && (
          <motion.p
            initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="text-xs text-red-500 dark:text-red-400"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === "subscribed" && (
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex flex-wrap items-center gap-2"
          >
            <motion.button
              onClick={sendTest}
              className="btn-secondary text-xs py-1"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              Poslat testovací notifikaci
            </motion.button>
            <AnimatePresence>
              {testResult && (
                <motion.p
                  initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduce ? {} : { opacity: 0, x: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={`text-xs ${testResult.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {testResult}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const shouldReduce = useReducedMotion();
  const { user } = useAuth();
  const { data: me } = useSWR(user ? `/users/${user.id}` : null, fetcher);

  // Notification prefs
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null);
  const [pushReminders, setPushReminders] = useState<boolean | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  useEffect(() => {
    api.get<{ emailReminders: boolean; smsReminders: boolean; pushReminders: boolean }>("/notification-preferences")
      .then((prefs) => {
        setEmailEnabled(prefs.emailReminders);
        setSmsEnabled(prefs.smsReminders);
        setPushReminders(prefs.pushReminders);
      })
      .catch(() => {});
  }, []);

  const handleSaveNotifs = async () => {
    setNotifSaving(true);
    setNotifSuccess(false);
    try {
      await api.patch("/notification-preferences", {
        ...(emailEnabled !== null ? { emailReminders: emailEnabled } : {}),
        ...(smsEnabled !== null ? { smsReminders: smsEnabled } : {}),
        ...(pushReminders !== null ? { pushReminders } : {}),
      });
      setNotifSuccess(true);
      setTimeout(() => setNotifSuccess(false), 3000);
    } finally {
      setNotifSaving(false);
    }
  };

  const effectiveEmail = emailEnabled ?? me?.emailEnabled ?? true;
  const effectiveSms = smsEnabled ?? me?.smsEnabled ?? false;

  return (
    <RouteGuard>
      <Layout>
        <div className="max-w-md mx-auto space-y-4">
          {/* Page header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="mb-6"
          >
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-3 transition"
            >
              <ChevronLeft size={16} />
              Zpět na nastavení
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifikace</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Email, SMS a push notifikace</p>
          </motion.div>

          {/* Notification prefs */}
          <motion.div
            custom={0}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            className="card space-y-4"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Notifikace</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Email notifikace</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Termíny, připomínky, faktury</p>
              </div>
              <motion.button
                type="button"
                onClick={() => { haptics.light(); setEmailEnabled(!effectiveEmail); }}
                whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`relative w-12 h-6 rounded-full transition-colors ${effectiveEmail ? "bg-primary-600 dark:bg-primary-500" : "bg-gray-200 dark:bg-gray-600"}`}
              >
                <motion.span
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                  animate={{ x: effectiveEmail ? 24 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                />
              </motion.button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">SMS notifikace</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rychlé připomínky na mobil</p>
              </div>
              <motion.button
                type="button"
                onClick={() => { haptics.light(); setSmsEnabled(!effectiveSms); }}
                whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`relative w-12 h-6 rounded-full transition-colors ${effectiveSms ? "bg-primary-600 dark:bg-primary-500" : "bg-gray-200 dark:bg-gray-600"}`}
              >
                <motion.span
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                  animate={{ x: effectiveSms ? 24 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                />
              </motion.button>
            </div>

            <AnimatePresence>
              {notifSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm"
                >
                  Nastavení uloženo ✓
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleSaveNotifs}
              disabled={notifSaving}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary w-full"
            >
              {notifSaving ? "Ukládám…" : "Uložit notifikace"}
            </motion.button>
          </motion.div>

          {/* Push notifications */}
          <motion.div
            custom={1}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            className="card"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Push notifikace</h2>
            <PushSubscribeButton />
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
