"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Smartphone, Save, CheckCircle, AlertCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientNotificationSettings() {
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
          <div className="flex items-center gap-3 mb-6">
            <Bell size={24} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nastavení notifikací</h1>
              <p className="text-sm text-gray-500">Vyberte, jak vás chceme informovat o termínech</p>
            </div>
          </div>

          <div className="card space-y-5">
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
                  <Mail size={18} className="text-blue-500" />
                  <span className="font-medium text-gray-900">E-mail</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Připomínka 24 hodin a 2 hodiny před termínem na váš e-mail.
                </p>
              </div>
            </label>

            <hr className="border-gray-100" />

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
                  <MessageSquare size={18} className="text-green-500" />
                  <span className="font-medium text-gray-900">SMS</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Připomínka 24 hodin a 2 hodiny před termínem jako SMS na vaše telefonní číslo.
                </p>
              </div>
            </label>

            <hr className="border-gray-100" />

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
                  <Smartphone size={18} className="text-purple-500" />
                  <span className="font-medium text-gray-900">Push notifikace</span>
                  {!pushInfo?.enabled && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Nedostupné</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Připomínka přímo v prohlížeči nebo na telefonu, i když nemáte otevřenou stránku.
                </p>
                {pushStatus === "subscribing" && (
                  <p className="text-xs text-blue-600 mt-1">Aktivuji…</p>
                )}
                {pushStatus === "subscribed" && (
                  <p className="text-xs text-green-600 mt-1">Push notifikace aktivovány ✓</p>
                )}
                {pushStatus === "error" && (
                  <p className="text-xs text-red-600 mt-1">Nelze aktivovat push notifikace</p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {saved && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle size={16} />
              Nastavení uloženo ✓
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {saving ? "Ukládám…" : "Uložit nastavení"}
          </button>
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
