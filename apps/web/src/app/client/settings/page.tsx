"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Smartphone, Save, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientNotificationSettings() {
  const shouldReduceMotion = useReducedMotion();
  const { data: prefs, mutate } = useSWR("/notification-preferences", fetcher);
  const { data: pushInfo } = useSWR("/push/vapid-public-key", fetcher);

  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [push, setPush] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<"idle" | "subscribing" | "subscribed" | "error">("idle");

  useEffect(() => {
    if (prefs) {
      setEmail(prefs.emailReminders ?? true);
      setSms(prefs.smsReminders ?? false);
      setPush(prefs.pushReminders ?? false);
    }
  }, [prefs]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch("/notification-preferences", {
        emailReminders: email,
        smsReminders: sms,
        pushReminders: push,
      });
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const handlePushSubscribe = async () => {
    if (!pushInfo?.publicKey) return;
    setPushStatus("subscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushInfo.publicKey) as BufferSource,
      });
      await api.post("/push/subscribe", sub.toJSON());
      setPush(true);
      setPushStatus("subscribed");
    } catch (e: any) {
      setPushStatus("error");
      setError("Nepodařilo se aktivovat push notifikace: " + (e?.message ?? ""));
    }
  };

  const handlePushUnsubscribe = async () => {
    try {
      await api.delete("/push/unsubscribe");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setPush(false);
      setPushStatus("idle");
    } catch {
      setError("Nepodařilo se deaktivovat push notifikace");
    }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-xl mx-auto">
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={shouldReduceMotion ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <motion.div
              initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
            >
              <Bell size={24} className="text-primary-600 dark:text-primary-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nastavení notifikací</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Vyberte, jak vás chceme informovat o termínech</p>
            </div>
          </motion.div>

          <motion.div
            className="card space-y-5"
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 }}
          >
            {/* Email */}
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(e) => setEmail(e.target.checked)}
                  className="w-5 h-5 rounded accent-primary-600"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-blue-500 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">E-mail</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Připomínka 24 hodin a 2 hodiny před termínem na váš e-mail.
                </p>
              </div>
            </label>

            <hr className="border-gray-100 dark:border-gray-700" />

            {/* SMS */}
            <label className="flex items-start gap-4 cursor-pointer">
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={sms}
                  onChange={(e) => setSms(e.target.checked)}
                  className="w-5 h-5 rounded accent-primary-600"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-green-500 dark:text-green-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">SMS</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Připomínka 24 hodin a 2 hodiny před termínem jako SMS na vaše telefonní číslo.
                </p>
              </div>
            </label>

            <hr className="border-gray-100 dark:border-gray-700" />

            {/* Push */}
            <div className="flex items-start gap-4">
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={push}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handlePushSubscribe();
                    } else {
                      handlePushUnsubscribe();
                    }
                  }}
                  disabled={!pushInfo?.enabled || pushStatus === "subscribing"}
                  className="w-5 h-5 rounded accent-primary-600"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Smartphone size={18} className="text-purple-500 dark:text-purple-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Push notifikace</span>
                  {!pushInfo?.enabled && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Nedostupné</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Připomínka přímo v prohlížeči nebo na telefonu, i když nemáte otevřenou stránku.
                </p>
                {pushStatus === "subscribing" && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Aktivuji…</p>
                )}
                {pushStatus === "subscribed" && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Push notifikace aktivovány ✓</p>
                )}
                {pushStatus === "error" && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Nelze aktivovat push notifikace</p>
                )}
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2 text-red-700 dark:text-red-400 text-sm"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {saved && (
              <motion.div
                key="saved"
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-green-700 dark:text-green-400 text-sm"
              >
                <CheckCircle size={16} />
                Nastavení uloženo ✓
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <Save size={16} />
            {saving ? "Ukládám…" : "Uložit nastavení"}
          </motion.button>
        </div>
      </Layout>
    </RouteGuard>
  );
}

// Helper: convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
