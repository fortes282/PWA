"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";

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
  const { user, refreshUser } = useAuth();
  const { data: me, mutate } = useSWR(user ? `/users/${user.id}` : null, fetcher);

  // Notification prefs
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  // Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Init profile fields from loaded data
  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

  const handleSaveNotifs = async () => {
    setNotifSaving(true);
    setNotifSuccess(false);
    try {
      await api.patch(`/users/${user!.id}`, {
        ...(emailEnabled !== null ? { emailEnabled } : {}),
        ...(smsEnabled !== null ? { smsEnabled } : {}),
      });
      await mutate();
      setNotifSuccess(true);
      setTimeout(() => setNotifSuccess(false), 3000);
    } finally {
      setNotifSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError(null);
    try {
      await api.patch(`/users/${user!.id}`, {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      await mutate();
      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message ?? "Chyba při ukládání");
    } finally {
      setProfileSaving(false);
    }
  };

  const effectiveEmail = emailEnabled ?? me?.emailEnabled ?? true;
  const effectiveSms = smsEnabled ?? me?.smsEnabled ?? false;

  return (
    <RouteGuard>
      <Layout>
        <div className="max-w-md mx-auto space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Nastavení</h1>

          {/* Profile edit */}
          <form onSubmit={handleSaveProfile} className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Profil</h2>

            <div className="space-y-2 text-sm text-gray-500 mb-2">
              <p><span className="font-medium text-gray-700">Email:</span> {user?.email}</p>
              <p><span className="font-medium text-gray-700">Role:</span> {user?.role}</p>
            </div>

            <div>
              <label className="label">Jméno</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vaše celé jméno"
                minLength={2}
                required
              />
            </div>

            <div>
              <label className="label">Telefon</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+420 123 456 789"
                type="tel"
              />
            </div>

            {profileSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                Profil uložen ✓
              </div>
            )}
            {profileError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {profileError}
              </div>
            )}

            <button type="submit" disabled={profileSaving} className="btn-primary w-full">
              {profileSaving ? "Ukládám…" : "Uložit profil"}
            </button>
          </form>

          {/* Notification prefs */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Notifikace</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Email notifikace</p>
                <p className="text-xs text-gray-400">Termíny, připomínky, faktury</p>
              </div>
              <button
                type="button"
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
                type="button"
                onClick={() => setSmsEnabled(!effectiveSms)}
                className={`relative w-12 h-6 rounded-full transition-colors ${effectiveSms ? "bg-primary-600" : "bg-gray-200"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${effectiveSms ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>

            {notifSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
                Nastavení uloženo ✓
              </div>
            )}

            <button onClick={handleSaveNotifs} disabled={notifSaving} className="btn-primary w-full">
              {notifSaving ? "Ukládám…" : "Uložit notifikace"}
            </button>
          </div>

          {/* Push notifications */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Push notifikace</h2>
            <PushSubscribeButton />
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
