"use client";

import Image from "next/image";
import Link from "next/link";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, ShieldOff, ChevronRight } from "lucide-react";

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
  const [status, setStatus] = useState<PushStatus>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Detect support and existing subscription on mount
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
    return <p className="text-xs text-gray-400">Zjišťuji stav…</p>;
  }

  if (status === "unsupported") {
    return <p className="text-xs text-gray-400">Push notifikace nejsou podporovány v tomto prohlížeči.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Push notifikace</p>
          <p className="text-xs text-gray-400">Notifikace přímo v prohlížeči / na telefonu</p>
        </div>
        {status === "subscribed" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 font-medium">✓ Aktivováno</span>
            <button onClick={unsubscribe} className="btn-secondary text-xs py-1">
              Odhlásit
            </button>
          </div>
        ) : (
          <button onClick={subscribe} disabled={status === "loading"} className="btn-secondary text-xs py-1">
            {status === "loading" ? "Aktivuji…" : "Aktivovat"}
          </button>
        )}
      </div>

      {status === "error" && errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

      {status === "subscribed" && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sendTest} className="btn-secondary text-xs py-1">
            Poslat testovací notifikaci
          </button>
          {testResult && (
            <p className={`text-xs ${testResult.startsWith("✓") ? "text-green-600" : "text-gray-500"}`}>
              {testResult}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { data: me, mutate } = useSWR(user ? `/users/${user.id}` : null, fetcher);

  // 2FA status
  const [twoFAStatus, setTwoFAStatus] = useState<{ enabled: boolean; mandatory: boolean; backupCodesRemaining: number } | null>(null);
  useEffect(() => {
    api.get<{ enabled: boolean; mandatory: boolean; backupCodesRemaining: number }>("/auth/2fa/status")
      .then(setTwoFAStatus)
      .catch(() => {});
  }, []);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Notification prefs
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null);
  const [pushReminders, setPushReminders] = useState<boolean | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  // Load notification preferences from API on mount
  useEffect(() => {
    api.get<{ emailReminders: boolean; smsReminders: boolean; pushReminders: boolean }>("/notification-preferences")
      .then((prefs) => {
        setEmailEnabled(prefs.emailReminders);
        setSmsEnabled(prefs.smsReminders);
        setPushReminders(prefs.pushReminders);
      })
      .catch(() => { /* use defaults */ });
  }, []);

  // Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Vyberte prosím obrázek (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Obrázek je příliš velký (max 2 MB)");
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const avatar = reader.result as string;
        await api.patch("/users/me/avatar", { avatar });
        await mutate();
        await refreshUser();
      } catch (err: any) {
        setAvatarError(err?.message ?? "Chyba při nahrávání obrázku");
      } finally {
        setAvatarUploading(false);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await api.delete("/users/me/avatar");
      await mutate();
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err?.message ?? "Chyba");
    } finally {
      setAvatarUploading(false);
    }
  };

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

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {me?.avatarUrl ? (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${me.avatarUrl}`}
                    alt="Avatar"
                    width={64}
                    height={64}
                    unoptimized
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center border-2 border-gray-200">
                    <span className="text-2xl font-bold text-primary-600">
                      {(me?.name || user?.name || "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-input"
                />
                <div className="flex gap-2">
                  <label
                    htmlFor="avatar-input"
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1.5 rounded-lg cursor-pointer transition"
                  >
                    {me?.avatarUrl ? "Změnit foto" : "Nahrát foto"}
                  </label>
                  {me?.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      disabled={avatarUploading}
                      className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
                    >
                      Odstranit
                    </button>
                  )}
                </div>
                {avatarError && <p className="text-xs text-red-500 mt-1">{avatarError}</p>}
                <p className="text-xs text-gray-400 mt-1">Max 2 MB · JPEG, PNG, WebP</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-500 mb-2">
              <p><span className="font-medium text-gray-700">Email:</span> {user?.email}</p>
              <p><span className="font-medium text-gray-700">Role:</span> {user?.role}</p>
            </div>

            <div>
              <label className="label" htmlFor="profile-name">Jméno</label>
              <input
                id="profile-name"
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

          {/* Password change */}
          <form
            className="card space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setPwError(null);
              setPwSuccess(false);
              if (newPassword !== confirmPassword) {
                setPwError("Hesla se neshodují");
                return;
              }
              if (newPassword.length < 8) {
                setPwError("Heslo musí mít alespoň 8 znaků");
                return;
              }
              setPwSaving(true);
              try {
                await api.patch(`/users/${user!.id}/password`, {
                  currentPassword,
                  newPassword,
                });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPwSuccess(true);
                setTimeout(() => setPwSuccess(false), 3000);
              } catch (err: any) {
                setPwError(err?.message ?? "Chyba při změně hesla");
              } finally {
                setPwSaving(false);
              }
            }}
          >
            <h2 className="font-semibold text-gray-900">Změna hesla</h2>
            <div>
              <label className="label" htmlFor="current-password">Aktuální heslo</label>
              <input id="current-password" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="new-password">Nové heslo</label>
              <input id="new-password" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">Potvrzení hesla</label>
              <input id="confirm-password" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            </div>
            {pwSuccess && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">Heslo změněno ✓</div>}
            {pwError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{pwError}</div>}
            <button type="submit" disabled={pwSaving} className="btn-primary w-full">
              {pwSaving ? "Měním heslo…" : "Změnit heslo"}
            </button>
          </form>

          {/* 2FA Security */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Zabezpečení účtu</h2>
            <Link
              href="/settings/2fa"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition -mx-1"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                twoFAStatus?.enabled ? "bg-green-100" : "bg-gray-100"
              }`}>
                {twoFAStatus?.enabled
                  ? <ShieldCheck className="text-green-600" size={20} />
                  : <ShieldOff className="text-gray-400" size={20} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">Dvoufaktorové ověření (2FA)</p>
                <p className="text-xs text-gray-500">
                  {twoFAStatus === null
                    ? "Načítám…"
                    : twoFAStatus.enabled
                      ? `Aktivní · ${twoFAStatus.backupCodesRemaining} záložních kódů`
                      : twoFAStatus.mandatory
                        ? "Neaktivní — povinné pro vaši roli"
                        : "Neaktivní — doporučujeme aktivovat"
                  }
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
            </Link>
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
