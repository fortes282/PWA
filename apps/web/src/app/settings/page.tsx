"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

function PushSubscribeButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "subscribed" | "error">("idle");
  const [supported, setSupported] = useState(true);

  const subscribe = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    setStatus("loading");
    try {
      // Get VAPID public key
      const { publicKey, enabled } = await api.get<{ publicKey: string | null; enabled: boolean }>("/push/vapid-public-key");
      if (!enabled || !publicKey) {
        setStatus("error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const subscription = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });
      await api.post("/push/subscribe", subscription.toJSON());
      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  };

  if (!supported) return <p className="text-xs text-gray-400">Push notifikace nejsou podporovány v tomto prohlížeči.</p>;

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">Push notifikace</p>
        <p className="text-xs text-gray-400">Notifikace přímo v prohlížeči / na telefonu</p>
      </div>
      {status === "subscribed" ? (
        <span className="text-xs text-green-600 font-medium">✓ Aktivováno</span>
      ) : (
        <button
          onClick={subscribe}
          disabled={status === "loading"}
          className="btn-secondary text-xs py-1"
        >
          {status === "loading" ? "Aktivuji…" : status === "error" ? "Není dostupné" : "Aktivovat"}
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: me, mutate } = useSWR(user ? `/users/${user.id}` : null, fetcher);

  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await api.patch(`/users/${user!.id}`, {
        ...(emailEnabled !== null ? { emailEnabled } : {}),
        ...(smsEnabled !== null ? { smsEnabled } : {}),
      });
      await mutate();
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  const effectiveEmail = emailEnabled ?? me?.emailEnabled ?? true;
  const effectiveSms = smsEnabled ?? me?.smsEnabled ?? false;

  return (
    <RouteGuard>
      <Layout>
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Nastavení</h1>

          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Notifikace</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Email notifikace</p>
                <p className="text-xs text-gray-400">Termíny, připomínky, faktury</p>
              </div>
              <button
                onClick={() => setEmailEnabled(!effectiveEmail)}
                className={`relative w-12 h-6 rounded-full transition-colors ${effectiveEmail ? "bg-primary-600" : "bg-gray-200"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${effectiveEmail ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">SMS notifikace</p>
                <p className="text-xs text-gray-400">Rychlé připomínky na mobil</p>
              </div>
              <button
                onClick={() => setSmsEnabled(!effectiveSms)}
                className={`relative w-12 h-6 rounded-full transition-colors ${effectiveSms ? "bg-primary-600" : "bg-gray-200"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${effectiveSms ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                Nastavení uloženo ✓
              </div>
            )}

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? "Ukládám…" : "Uložit nastavení"}
            </button>
          </div>

          {/* Push notifications */}
          <div className="card mt-4">
            <h2 className="font-semibold text-gray-900 mb-3">Push notifikace</h2>
            <PushSubscribeButton />
          </div>

          {/* Profile info */}
          <div className="card mt-4">
            <h2 className="font-semibold text-gray-900 mb-3">Profil</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Jméno</span>
                <span className="font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Role</span>
                <span className="font-medium">{user?.role}</span>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
