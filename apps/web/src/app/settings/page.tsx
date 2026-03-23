"use client";

import Image from "next/image";
import Link from "next/link";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, ShieldOff, ChevronRight, Bell, BellOff } from "lucide-react";
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

export default function SettingsPage() {
  const shouldReduce = useReducedMotion();
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

  useEffect(() => {
    api.get<{ emailReminders: boolean; smsReminders: boolean; pushReminders: boolean }>("/notification-preferences")
      .then((prefs) => {
        setEmailEnabled(prefs.emailReminders);
        setSmsEnabled(prefs.smsReminders);
        setPushReminders(prefs.pushReminders);
      })
      .catch(() => {});
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
    haptics.medium();
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
      haptics.success();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      haptics.error();
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
          {/* Page header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nastavení</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Profil, notifikace a zabezpečení</p>
          </motion.div>

          {/* Profile edit */}
          <motion.form
            custom={0}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleSaveProfile}
            className="card space-y-4"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Profil</h2>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {me?.avatarUrl ? (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_API_URL || "/api"}${me.avatarUrl}`}
                    alt="Avatar"
                    width={64}
                    height={64}
                    unoptimized
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {(me?.name || user?.name || "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 rounded-full flex items-center justify-center">
                    <motion.div
                      animate={shouldReduce ? {} : { rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-600 dark:border-primary-400 border-t-transparent rounded-full"
                    />
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
                    className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded-lg cursor-pointer transition"
                  >
                    {me?.avatarUrl ? "Změnit foto" : "Nahrát foto"}
                  </label>
                  {me?.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      disabled={avatarUploading}
                      className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      Odstranit
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {avatarError && (
                    <motion.p
                      initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="text-xs text-red-500 dark:text-red-400 mt-1"
                    >
                      {avatarError}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 2 MB · JPEG, PNG, WebP</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
              <p><span className="font-medium text-gray-700 dark:text-gray-200">Email:</span> {user?.email}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-200">Role:</span> {user?.role}</p>
            </div>

            <div>
              <label className="label dark:text-gray-300" htmlFor="profile-name">Jméno</label>
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
              <label className="label dark:text-gray-300">Telefon</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+420 123 456 789"
                type="tel"
              />
            </div>

            <AnimatePresence>
              {profileSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm"
                >
                  Profil uložen ✓
                </motion.div>
              )}
              {profileError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm"
                >
                  {profileError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={profileSaving}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary w-full"
            >
              {profileSaving ? "Ukládám…" : "Uložit profil"}
            </motion.button>
          </motion.form>

          {/* Notification prefs */}
          <motion.div
            custom={1}
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
                  animate={{ x: effectiveEmail ? 28 : 4 }}
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
                  animate={{ x: effectiveSms ? 28 : 4 }}
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

          {/* Password change */}
          <motion.form
            custom={2}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
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
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Změna hesla</h2>
            <div>
              <label className="label dark:text-gray-300" htmlFor="current-password">Aktuální heslo</label>
              <input id="current-password" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label dark:text-gray-300" htmlFor="new-password">Nové heslo</label>
              <input id="new-password" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label className="label dark:text-gray-300" htmlFor="confirm-password">Potvrzení hesla</label>
              <input id="confirm-password" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            </div>
            <AnimatePresence>
              {pwSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm"
                >
                  Heslo změněno ✓
                </motion.div>
              )}
              {pwError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm"
                >
                  {pwError}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              type="submit"
              disabled={pwSaving}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary w-full"
            >
              {pwSaving ? "Měním heslo…" : "Změnit heslo"}
            </motion.button>
          </motion.form>

          {/* 2FA Security */}
          <motion.div
            custom={3}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            className="card"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Zabezpečení účtu</h2>
            <motion.div whileTap={shouldReduce ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
              <Link
                href="/settings/2fa"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition -mx-1"
              >
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    twoFAStatus?.enabled
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                  animate={shouldReduce ? {} : twoFAStatus?.enabled ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  key={String(twoFAStatus?.enabled)}
                >
                  {twoFAStatus?.enabled
                    ? <ShieldCheck className="text-green-600 dark:text-green-400" size={20} />
                    : <ShieldOff className="text-gray-500 dark:text-gray-400" size={20} />
                  }
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Dvoufaktorové ověření (2FA)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
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
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Push notifications */}
          <motion.div
            custom={4}
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
